// Wally's Cafe (427 Massachusetts Ave, South End) — family-run since 1947,
// the oldest continuously operating jazz club in America and Boston's nightly
// proving ground. They publish NO artist calendar, only the ritual itself
// (wallyscafe.com/ritual/, verified 2026-07-19): jam session Tue–Sat 7–9 PM,
// night sets nightly till midnight, 365 nights a year. Pure generator, like
// Marjorie's — there is nothing to crawl, only a standing institution.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const URL_ = 'https://wallyscafe.com';

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const date = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const dow = d.getDay(); // 0=Sun
    if (dow >= 2 && dow <= 6) {
      events.push(makeEvent({
        clubId: 'wallys',
        title: "Wally's Jam Session",
        date,
        sets: ['19:00'],
        url: URL_,
        details: 'Berklee kids trade choruses with big band veterans. Bring your horn, sign the list. Tue thru Sat, 7 to 9.',
      }));
    }
    events.push(makeEvent({
      clubId: 'wallys',
      title: "Night Set at Wally's",
      date,
      sets: ['21:00'],
      url: URL_,
      details: 'The pros take over, three feet from the bell of the horn, till midnight. Nightly since 1947.',
    }));
  }
  return events;
}

export async function crawl() {
  return parse();
}
