// 606 Club (90 Lots Road, Chelsea) — Steve Rubie's basement, jazz nightly
// since 1976, musicians-only license history and all. Homemade site;
// /events/?d=YYYY-MM-DD serves a week at a time, server-rendered:
//   <a … class="banner smaller">Mon 13<sup>th</sup> Jul - 8:00pm</a>
//   <p class="h4">Phil Mulford's 'Thunderthumbs'</p>
// All jazz — no filter.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, inferYear,
  isoDate, htmlToText, cleanText, sleep,
} from '../lib.js';

const BASE = 'https://www.606club.co.uk';

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  const re = /<a[^>]*href="(\/events\/view\/[^"]+)"[^>]*class="banner[^"]*"[^>]*>\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2})\s*(?:<sup>[a-z]{2}<\/sup>)?\s*([A-Za-z]{3,})\s*[-–]\s*([\d:. ]+[ap]m)[\s\S]*?class="h4"[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, href, day, monName, timeStr, rawTitle] = m;
    const month = monthNum(monName);
    if (!month) continue;
    const title = cleanText(htmlToText(rawTitle));
    if (!title) continue;
    const time = normalizeTime(timeStr.replace('.', ':'));
    const ev = makeEvent(applyLateNight({
      clubId: 'club606',
      title,
      date: isoDate(inferYear(month, Number(day), today), month, Number(day)),
      sets: time ? [time] : [],
      url: BASE + href,
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl(ctx = {}) {
  const today = ctx.today ?? new Date();
  const out = [];
  const seen = new Set();
  for (let w = 0; w < 5; w++) {
    const d = new Date(today.getTime() + w * 7 * 86400000).toISOString().slice(0, 10);
    try {
      for (const e of parse(await fetchText(`${BASE}/events/?d=${d}`), today)) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    } catch (err) {
      if (w === 0) throw err;
      break;
    }
    await sleep(300);
  }
  return out;
}
