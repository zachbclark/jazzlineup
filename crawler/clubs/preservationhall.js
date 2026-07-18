// Preservation Hall (726 St. Peter St) — the temple of traditional jazz
// since 1961. Their structure is the calendar: three intimate sets nightly
// (their own site's words: "nightly performances at 5:00PM, 6:30PM, and
// 8:00PM"). Bands rotate from the Hall's collective; per-night band names
// are a future enrichment. Generator, like Marjorie's.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const URL_ = 'https://www.preservationhall.com/calendar/';

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    events.push(makeEvent({
      clubId: 'preservationhall',
      title: 'Nightly Sets at Preservation Hall',
      date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      sets: ['17:00', '18:30', '20:00'],
      url: URL_,
      details: 'Three 45-minute sets by the Hall’s rotating collective. 726 St. Peter, cash bar none, magic since 1961.',
    }));
  }
  return events;
}

export async function crawl() {
  return parse();
}
