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
  // anchor on event links; date header sits within the same block of markup
  const re = /<a[^>]*href="(\/events\/(?!day\/|archive|calendar)[a-z0-9-]{4,})\/?"[^>]*>\s*([^<][\s\S]{0,120}?)<\/a>[\s\S]{0,600}?(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s+(\d{1,2})\s+([A-Z]{3,9})\s+(\d{4})(?:,\s*(\d{1,2})[.:](\d{2})\s*(PM|AM))?/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, href, rawTitle, , day, monName, year, hh, mm, ap] = m;
    const month = monthNum(monName);
    if (!month) continue;
    const title = cleanText(htmlToText(rawTitle));
    if (!title || title.length < 3 || SKIP_RE.test(title)) continue;
    let time = null;
    if (hh) {
      let h = Number(hh);
      if (/pm/i.test(ap) && h < 12) h += 12;
      time = `${String(h).padStart(2, '0')}:${mm}`;
    }
    const ev = makeEvent(applyLateNight({
      clubId: 'cafeoto',
      title,
      date: isoDate(Number(year), month, Number(day)),
      sets: time ? [time] : [],
      url: BASE + href + '/',
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
