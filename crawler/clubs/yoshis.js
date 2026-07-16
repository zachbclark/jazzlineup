// Yoshi's (510 Embarcadero W, Jack London Square, Oakland) — the East Bay
// institution since 1972. /events/calendar is server-rendered, but NOT the
// way a browser shows it: the `li.event-indv` list you see in devtools is
// rebuilt client-side by their JS. What the server actually sends (verified
// 2026-07-16 against the raw response) is plain <li> rows of .event-cell
// divs where each buy link's aria-label packs everything:
//   <a aria-label="Tickets PETER WHITE July 16, 2026 - 7:30 PM" href="…/buy-tickets/peter-white-11/detail">
// Every show appears twice (a "Buy Tickets" image link and a "Tickets"
// button); two shows a night are separate rows; both dedupe/merge here by
// (date, title) into sets[]. A <p class="price">$39 - $79</p> follows the
// button variant.
// Curation call (Zach, 2026-07-16): include ALL their music bookings —
// Yoshi's is a legacy jazz institution, same policy as Blue Note NYC.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, isoDate,
  cleanText, decodeEntities,
} from '../lib.js';

const BASE = 'https://yoshis.com';
const URL_ = `${BASE}/events/calendar`;

const TAG_RE = /<a\b[^>]*aria-label="(?:Buy )?Tickets ([^"]+)"[^>]*>/gi;
const LABEL_RE = /^([\s\S]+?)\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*-\s*([\d:]+\s*[AP]M)$/i;

export function parse(html) {
  const drafts = new Map(); // `${date}:${title}` -> draft
  let t;
  while ((t = TAG_RE.exec(html))) {
    const m = LABEL_RE.exec(t[1]);
    if (!m) continue;
    const [, rawTitle, monName, day, year, timeStr] = m;
    const month = monthNum(monName);
    if (!month) continue;
    const title = cleanText(decodeEntities(rawTitle));
    if (!title) continue;
    const date = isoDate(Number(year), month, Number(day));
    const time = normalizeTime(timeStr);
    const url = (t[0].match(/href="(https?:\/\/yoshis\.com\/events\/buy-tickets\/[^"]+)"/i) ?? [])[1];
    const price = (html.slice(TAG_RE.lastIndex, TAG_RE.lastIndex + 300)
      .match(/<p class="price">\s*([^<]+?)\s*<\/p>/i) ?? [])[1];
    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, { clubId: 'yoshis', title, date, sets: [], url: url ?? URL_, priceText: null });
    }
    const d = drafts.get(key);
    if (time && !d.sets.includes(time)) d.sets.push(time);
    if (url && d.url === URL_) d.url = url;
    if (price && !d.priceText) d.priceText = price;
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
