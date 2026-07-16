// Jazz Cafe (5 Parkway, Camden) — the big Camden room: jazz, soul, global,
// and club nights. Server-rendered WP listing where every <li> carries its
// own metadata: data-genre ("jazz", "soul-rnb", …), data-type ("Live show"
// vs club night), a date block (Thu<span>16</span>Jul) and a line-up list.
// Mixed room -> keep data-genre="jazz" live shows only. The line-up names
// land in details (no instruments given).
import {
  fetchText, makeEvent, applyLateNight, monthNum, inferYear, isoDate,
  htmlToText, cleanText,
} from '../lib.js';

const BASE = 'https://thejazzcafe.com';
const URL_ = `${BASE}/whats-on/`;

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  const items = html.match(/<li[^>]*data-genre="[^"]*"[\s\S]*?(?=<li[^>]*data-genre="|<\/ul>)/gi) ?? [];
  for (const item of items) {
    const genre = (item.match(/data-genre="([^"]*)"/i) ?? [])[1] ?? '';
    const type = (item.match(/data-(?:event-)?type="([^"]*)"/i) ?? [])[1] ?? '';
    if (!/jazz/i.test(genre)) continue;
    if (/club/i.test(type)) continue; // club nights are DJ sets even when genre-tagged
    const dm = item.match(/event-date[^>]*>\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*<span>(\d{1,2})<\/span>\s*([A-Za-z]{3})/i);
    const tm = item.match(/event-title[^>]*>([\s\S]*?)<\/h\d>/i);
    const url = (item.match(/href="(https?:\/\/thejazzcafe\.com\/event\/[^"]+)"/i) ?? [])[1];
    if (!dm || !tm) continue;
    const month = monthNum(dm[2]);
    if (!month) continue;
    // title markup: <span class="host">Series name</span><br>Artist<br>
    const host = cleanText((tm[1].match(/class="host"[^>]*>([\s\S]*?)<\/span>/i) ?? [])[1] ?? '');
    const title = cleanText(htmlToText(tm[1].replace(/<span class="host"[\s\S]*?<\/span>/i, ' ')));
    if (!title) continue;
    const lineup = [...item.matchAll(/<li>([^<]{2,60})<\/li>/g)].map((x) => cleanText(x[1])).filter(Boolean);
    const details = [host || null, lineup.length > 1 ? lineup.join(', ') : null].filter(Boolean).join(' · ') || null;
    const ev = makeEvent(applyLateNight({
      clubId: 'jazzcafe',
      title,
      date: isoDate(inferYear(month, Number(dm[1]), today), month, Number(dm[1])),
      sets: [],
      url: url ?? URL_,
      details,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl(ctx = {}) {
  try {
    return parse(await fetchText(URL_), ctx.today ?? new Date());
  } catch {
    // their WAF 403s AWS IPs (residential works fine) — fall back to the
    // seed generated from a local crawl; auto-heals if they unblock Lambda
    const { SEED } = await import('./jazzcafe-seed.js');
    const today = new Date().toISOString().slice(0, 10);
    return SEED.filter((e) => e.date >= today).map((e) => makeEvent({
      clubId: 'jazzcafe',
      title: e.title,
      date: e.date,
      sets: [],
      url: e.url,
      details: e.details,
    }));
  }
}
