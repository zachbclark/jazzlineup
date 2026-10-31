// Regattabar (Charles Hotel, Harvard Square) — the Cambridge room where
// national tours stop; back in business after its long COVID nap. Their
// site is a shell; the calendar lives on TicketWeb. July 2026 assumed
// TicketWeb was bot-hostile and ran on a browser-captured seed; tested
// 2026-10-30 and it serves the full venue page to the crawler. The page
// carries one JSON-LD MusicEvent per performance (name, local startDate
// 'YYYY-MM-DDTHH:MM' with no offset, url), the whole calendar on one page
// (?page=2 is empty). Same-title performances on one night merge into sets
// ('Bill Charlap Trio' 7:00 + 9:30). The seed stays as the fallback if
// TicketWeb ever starts refusing us.
import { fetchText, makeEvent, applyLateNight, extractJsonLd, tzDate, cleanText } from '../lib.js';
import { SEED } from './regattabar-seed.js';

const VENUE = 'https://www.ticketweb.com/venue/regattabar-cambridge-ma/748814';

export function parse(html) {
  const drafts = new Map(); // `${date}:${title}` -> draft
  for (const e of extractJsonLd(html)) {
    if (!/Event$/.test(e?.['@type'] ?? '') || !e.name || !e.startDate) continue;
    const m = String(e.startDate).match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
    if (!m) continue;
    const [, date, time] = m;
    const title = cleanText(e.name);
    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, { clubId: 'regattabar', title, date, sets: [], url: e.url || VENUE, details: null });
    }
    if (time && !drafts.get(key).sets.includes(time)) drafts.get(key).sets.push(time);
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

const TW = 'https://www.ticketweb.com/event/';

export function seedEvents(today = new Date()) {
  const cutoff = tzDate(today, 'America/New_York'); // tonight in Boston, not UTC
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
  try {
    const events = parse(await fetchText(VENUE));
    if (events.length) return events;
  } catch { /* refused or down: fall through to the seed */ }
  return seedEvents();
}
