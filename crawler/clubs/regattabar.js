// Regattabar (Charles Hotel, Harvard Square) — the Cambridge room where
// national tours stop; back in business after its long COVID nap. Their
// site is a shell; the calendar lives on TicketWeb (Ticketmaster-owned,
// assumed bot-hostile — we did NOT verify server-side markup), so this
// runs on a browser-captured seed (regattabar-seed.js) with same-title
// dates merged into sets ("George Coleman 7:00 + 9:30"). If someone later
// proves TicketWeb serves plain HTML to the Lambda, add a live path in
// front — the seed already has the shape it should return.
import { makeEvent, applyLateNight } from '../lib.js';
import { SEED } from './regattabar-seed.js';

const TW = 'https://www.ticketweb.com/event/';

export function seedEvents(today = new Date()) {
  const cutoff = today.toISOString().slice(0, 10);
  const drafts = new Map(); // `${date}:${title}` -> draft
  for (const [title, date, time, twId] of SEED) {
    if (date < cutoff) continue;
    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, {
        clubId: 'regattabar', title, date, sets: [],
        url: twId ? `${TW}${twId}` : 'https://www.regattabarjazz.com/',
        details: null,
      });
    }
    if (time && !drafts.get(key).sets.includes(time)) drafts.get(key).sets.push(time);
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return seedEvents();
}
