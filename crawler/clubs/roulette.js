// Roulette Intermedium (509 Atlantic Ave, Downtown Brooklyn) — the city's
// experimental/creative-music anchor since 1978. WordPress, server-rendered:
//   /group/music/ (upcoming music events, 10/page, /page/2/ etc.)
//   <div class="event">
//     <h2 class="event-title"><a href="/event/slug/">Jim Staley with …</a></h2>
//     <div class="event-time">Thursday, August 20, 2026. 8:00 pm</div>
//     <div class="event-price">Tickets $25</div>
import { fetchText, makeEvent, htmlToText, monthNum, isoDate, normalizeTime, sleep } from '../lib.js';

const BASE = 'https://roulette.org';
const PAGES = 3; // 10 events/page; 3 pages ≈ their posted horizon

export function parse(html) {
  const events = [];
  const re = /event-title[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?event-time[^>]*>([\s\S]*?)<\/div>([\s\S]*?)(?=event-title|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, url, rawTitle, rawTime, tail] = m;
    const title = htmlToText(rawTitle);
    // "Thursday, August 20, 2026. 8:00 pm"
    const dm = htmlToText(rawTime).match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\.?\s*(\d{1,2}(?::\d{2})?\s*[ap]m)?/i);
    if (!title || !dm || !monthNum(dm[1])) continue;
    const time = dm[4] ? normalizeTime(dm[4]) : null;
    const price = htmlToText(tail.match(/event-price[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const desc = htmlToText(tail.match(/event-desc[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    events.push(makeEvent({
      clubId: 'roulette',
      title,
      date: isoDate(Number(dm[3]), monthNum(dm[1]), Number(dm[2])),
      sets: time ? [time] : [],
      url,
      details: desc.slice(0, 300) || null,
      priceText: price.replace(/^Tickets\s*/i, '') || null,
    }));
  }
  return events;
}

export async function crawl() {
  const out = [];
  for (let p = 1; p <= PAGES; p++) {
    const url = p === 1 ? `${BASE}/group/music/` : `${BASE}/group/music/page/${p}/`;
    let batch = [];
    try {
      batch = parse(await fetchText(url));
    } catch {
      break; // past the last page (404) or transient error — keep what we have
    }
    if (batch.length === 0) break;
    out.push(...batch);
    await sleep(150);
  }
  return out;
}
