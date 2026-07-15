// Bill's Place (148 W 133rd St, Harlem) — Bill Saxton's parlor speakeasy on
// the original Swing Street. Programming is a standing residency:
//   Bill Saxton & the Harlem All-Stars — every Friday & Saturday, 7pm & 9:30pm
// Generator crawler like Arthur's: we fetch the homepage only to confirm the
// residency text still stands (a real markup change -> 0 events -> SUSPECT,
// which keeps previous data and flags the log for review).
import { fetchText, makeEvent, isoDate } from '../lib.js';

const URL_ = 'https://billsplaceharlem.com';
const SETS = ['19:00', '21:30'];
const WEEKS_AHEAD = 4;

export function parse(html, today = new Date()) {
  // Residency confirmation: the site still advertises Fri/Sat shows.
  if (!/FRIDAY|SATURDAY/i.test(html) || !/SAXTON/i.test(html)) return [];
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (d.getDay() !== 5 && d.getDay() !== 6) continue; // Fri + Sat only
    events.push(makeEvent({
      clubId: 'billsplace',
      title: 'Bill Saxton & the Harlem All-Stars',
      date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      sets: SETS,
      url: URL_,
      details: 'Harlem speakeasy sets in the parlor — BYOB, reserve ahead',
      personnel: [{ name: 'Bill Saxton', instrument: 'tenor sax' }],
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
