// The Beehive (541 Tremont St, South End) — supper club with live music
// nightly, but NO published artist calendar, and the nightly stage spans
// genres (soul, burlesque, country, reggae). Curation call (Zach,
// 2026-07-19): generate ONLY the named, recurring jazz-side fixtures —
// the Bruce Bears Sunday blues residency and the weekend jazz brunch —
// and skip the genre-roulette nightly slots. Generator, like Wally's.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const URL_ = 'https://www.beehiveboston.com/calendar';

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const date = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const dow = d.getDay(); // 0=Sun 6=Sat
    if (dow === 0 || dow === 6) {
      events.push(makeEvent({
        clubId: 'beehive',
        title: 'Live Music Weekend Brunch',
        date,
        sets: ['10:00'],
        url: URL_,
        details: 'Live jazz with brunch, 10am to 2pm.',
      }));
    }
    if (dow === 0) {
      events.push(makeEvent({
        clubId: 'beehive',
        title: 'Blues of Sunday: Bruce Bears & Friends',
        date,
        sets: ['19:30'],
        url: URL_,
        details: 'The standing Sunday residency on the Beehive stage.',
      }));
    }
  }
  return events;
}

export async function crawl() {
  return parse();
}
