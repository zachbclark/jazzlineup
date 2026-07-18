// Snug Harbor Jazz Bistro (626 Frenchmen St) — New Orleans' listening
// room: Ellis Marsalis' old Friday-night home, modern-jazz bookings with
// real calendars. WordPress + the TicketWeb plugin (same family as
// Birdland NYC). /calendar/ server-renders tw-* listings, one listing per
// SET (7:30 and 9:30 appear as separate rows) — merged here by
// (date, title) into sets. Verified 2026-07-19:
//   <div class="tw-name"><a href=".../tm-event/chris-thomas-king-trio/">
//   <span class="tw-event-date">Jul 17</span>
//   <span class="tw-event-time..."> 7:30 pm</span>
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, inferYear,
  isoDate, htmlToText, cleanText,
} from '../lib.js';

const BASE = 'https://snugjazz.com';

export function parse(html, today = new Date()) {
  const drafts = new Map(); // `${date}:${title}` -> draft
  const segments = String(html).split(/(?=<div class="tw-name")/).slice(1);
  for (const seg of segments) {
    const link = seg.match(/href="(https?:\/\/snugjazz\.com\/tm-event\/[^"]+)"/);
    const title = cleanText(htmlToText((seg.match(/<a [^>]*>([\s\S]*?)<\/a>/) ?? [])[1] ?? ''));
    const dm = (htmlToText((seg.match(/class="tw-event-date"[^>]*>([^<]+)</) ?? [])[1] ?? '')).match(/([A-Za-z]{3})\s+(\d{1,2})/);
    const time = normalizeTime((seg.match(/tw-event-time[^>]*>\s*([^<]{3,12})</) ?? [])[1]);
    if (!title || !dm) continue;
    const month = monthNum(dm[1]);
    if (!month) continue;
    const date = isoDate(inferYear(month, Number(dm[2]), today), month, Number(dm[2]));
    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, {
        clubId: 'snugharbor', title, date, sets: [],
        url: link ? link[1] : `${BASE}/calendar/`, details: null,
      });
    }
    if (time && !drafts.get(key).sets.includes(time)) drafts.get(key).sets.push(time);
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/calendar/`));
}
