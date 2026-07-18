// Fritzel's European Jazz Pub (733 Bourbon St) — trad jazz nightly since
// 1969, the one real jazz room left on Bourbon. No published per-night
// calendar (rotating house players under Kevin Clark's booking), so this
// generates the nightly institution without inventing set times.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const URL_ = 'https://fritzelsjazz.com/';

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    events.push(makeEvent({
      clubId: 'fritzels',
      title: 'Traditional Jazz at Fritzel’s',
      date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      sets: [],
      url: URL_,
      details: 'House trad players nightly from early afternoon till late, since 1969. 21+.',
    }));
  }
  return events;
}

export async function crawl() {
  return parse();
}
