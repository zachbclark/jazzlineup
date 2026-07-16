// Cafe OTO (18-22 Ashwin St, Dalston) — London's church of experimental
// and improvised music. Server-rendered /events/ listing: each event links
// to /events/<slug>/ near a header line like
//   "THURSDAY 16 JULY 2026, 7.30PM".
// Programming spans improv/free jazz/noise/global; DJ bar nights are
// skipped, the rest counts (same spirit as Elastic Arts — this IS the
// city's improvised-music home).
import {
  fetchText, makeEvent, applyLateNight, monthNum, isoDate, htmlToText, cleanText,
} from '../lib.js';

const BASE = 'https://www.cafeoto.co.uk';
const URL_ = `${BASE}/events/`;
const SKIP_RE = /\bDJ\b|OTO BAR|record fair|listening party/i;

export function parse(html) {
  const events = [];
  const seen = new Set();
  // one .each-activity block per event: date header FIRST
  // ("Thursday 16 July 2026, 7.30pm"), then image link, then title link
  const blocks = html.match(/class="each-activity[\s\S]*?(?=class="each-activity|$)/gi) ?? [];
  for (const block of blocks) {
    const dm = block.match(/(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:[,\s]+(\d{1,2})[.:](\d{2})\s*([ap]m))?/i);
    if (!dm) continue;
    const [, day, monName, year, hh, mm, ap] = dm;
    const month = monthNum(monName);
    if (!month) continue;
    // the anchor WITH text is the title (the image anchor wraps only <img>)
    const link = block.match(/<a[^>]*href="(\/events\/(?!day\/|archive|calendar)[a-z0-9-]{4,})\/?"[^>]*>\s*([^<\s][^<]{2,150})</i);
    if (!link) continue;
    const title = cleanText(htmlToText(link[2]));
    if (!title || SKIP_RE.test(title)) continue;
    let time = null;
    if (hh) {
      let h = Number(hh);
      if (/pm/i.test(ap ?? '') && h < 12) h += 12;
      time = `${String(h).padStart(2, '0')}:${mm}`;
    }
    const ev = makeEvent(applyLateNight({
      clubId: 'cafeoto',
      title,
      date: isoDate(Number(year), month, Number(day)),
      sets: time ? [time] : [],
      url: BASE + link[1] + '/',
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
