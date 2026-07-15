// Yoshi's (510 Embarcadero W, Jack London Square, Oakland) — the East Bay
// institution since 1972. Homegrown server-rendered /events/calendar:
//   <li class="event-indv"> blocks with a buy-tickets link whose aria-label
// packs everything: "Buy Tickets TITLE July 15, 2026 - 8:00 PM". Two shows a
// night are separate blocks; merged here by (date, title) into sets[].
// Curation call (Zach, 2026-07-16): include ALL their music bookings —
// Yoshi's is a legacy jazz institution, same policy as Blue Note NYC.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, isoDate,
  cleanText, decodeEntities,
} from '../lib.js';

const BASE = 'https://yoshis.com';
const URL_ = `${BASE}/events/calendar`;

const LABEL_RE = /aria-label="Buy Tickets ([\s\S]*?)\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*-\s*([\d:]+\s*[AP]M)"/gi;

export function parse(html) {
  const drafts = new Map(); // `${date}:${title}` -> draft
  const blocks = html.match(/<li class="event-indv"[\s\S]*?(?=<li class="event-indv"|<\/ul>)/gi) ?? [];
  for (const block of blocks) {
    LABEL_RE.lastIndex = 0;
    const m = LABEL_RE.exec(block);
    if (!m) continue;
    const [, rawTitle, monName, day, year, timeStr] = m;
    const month = monthNum(monName);
    if (!month) continue;
    const title = cleanText(decodeEntities(rawTitle));
    if (!title) continue;
    const date = isoDate(Number(year), month, Number(day));
    const time = normalizeTime(timeStr);
    const url = (block.match(/href="(https?:\/\/yoshis\.com\/events\/buy-tickets\/[^"]+)"/i) ?? [])[1];
    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, { clubId: 'yoshis', title, date, sets: [], url: url ?? URL_ });
    }
    if (time && !drafts.get(key).sets.includes(time)) drafts.get(key).sets.push(time);
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
