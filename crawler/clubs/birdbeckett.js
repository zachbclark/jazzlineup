// Bird & Beckett Books & Records (653 Chenery St, Glen Park) — the bookshop
// that has hosted San Francisco's longest-running neighborhood jazz session
// every Friday evening since 2002. No structured calendar exists (the events
// page is prose), so this is a generator in the Marjorie Eliot mold: Fridays
// at 7:30pm, pointing at their events page for the week's band. One-off
// specials (Sunday sessions, readings) aren't emitted.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const INFO_URL = 'https://birdbeckett.com/events/';

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (d.getDay() !== 5) continue; // Fridays only
    events.push(makeEvent({
      clubId: 'birdbeckett',
      title: 'Jazz in the Bookshop',
      date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      sets: ['19:30'],
      url: INFO_URL,
      details: 'Friday jazz among the shelves, every week since 2002. Rotating bands; see the events page for this week’s lineup. Donations support the musicians.',
    }));
  }
  return events;
}

export async function crawl() {
  return parse();
}
