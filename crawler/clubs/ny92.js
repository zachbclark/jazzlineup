// 92NY (1395 Lexington Ave, Upper East Side) — the 92nd Street Y's concert
// program; jazz lives mostly in the Jazz in July festival (Aaron Diehl,
// artistic director) plus scattered season bookings, across two rooms:
// Geffen Stage at Kaufmann Concert Hall and Buttenwieser Hall (the hall
// rides in details). Year-round registry entry by Zach's call 2026-07-19.
//
// Their site is behind Incapsula + hCaptcha and serves ALL non-browsers a
// 1KB bot shell (verified 2026-07-18: curl with cookie jar + browser UA
// still gets the challenge). So: seed-only, the Regattabar precedent. The
// events pages are Algolia-backed (algoliasearch 3.35 on /whats-on/events)
// — if someone extracts the public search key from a browser session, a
// live Algolia path would bypass the WAF entirely; the seed already has
// the shape it should return.
//
// OFF-SEASON: after the last seeded date passes this module returns [] on
// purpose — the registry entry carries emptyOk so the merge doesn't flag
// it suspect (a dark concert hall is not a broken parser).
import { makeEvent, applyLateNight } from '../lib.js';
import { SEED } from './ny92-seed.js';

export function seedEvents(today = new Date()) {
  const cutoff = today.toISOString().slice(0, 10);
  const events = [];
  for (const s of SEED) {
    if (s.date < cutoff) continue;
    events.push(makeEvent(applyLateNight({
      clubId: 'ny92',
      title: s.title,
      date: s.date,
      sets: s.time ? [s.time] : [],
      url: s.url,
      details: [s.hall, s.note].filter(Boolean).join(' · ') || null,
      personnel: s.personnel ?? [],
      priceText: s.priceText ?? null,
    })));
  }
  return events;
}

export async function crawl() {
  return seedEvents();
}
