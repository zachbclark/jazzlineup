// Marjorie Eliot's Parlor Jazz (555 Edgecombe Ave, Apt 3F, Sugar Hill) —
// free concerts in her living room every Sunday at 3:30pm, without a missed
// week since 1992, and famously without a website. Pure generator, like
// Bill's Place — there is nothing to crawl, only a standing invitation.
// If the sessions ever end (may that day be far), remove this module by hand.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const INFO_URL = 'https://www.facebook.com/pages/Marjorie-Elliots-Parlor-Jazz/488061981215540'; // no venue site; the FB page carries updates and cancellations

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (d.getDay() !== 0) continue; // Sundays only
    events.push(makeEvent({
      clubId: 'marjorie',
      title: "Marjorie Eliot's Parlor Jazz",
      date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      sets: ['15:30'],
      url: INFO_URL,
      details: 'Free concert in her Sugar Hill parlor, Apt 3F — every Sunday since 1992. Arrive early.',
      priceText: 'Free',
    }));
  }
  return events;
}

export async function crawl() {
  return parse();
}
