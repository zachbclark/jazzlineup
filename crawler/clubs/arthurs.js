// Arthur's Tavern (57 Grove St) — same room since 1937. Moved to
// arthurstavern.nyc in 2026 (the old arthurstavernnyc.com was dead; their
// talent buyer emailed twice). The site is WordPress + Elementor, and
// /calendar-of-events/ server-renders a month grid from a shortcode:
//   <div class='sub_calendar_item'> … <a class='tooltip'
//     href='…/events/<slug>/?id=6973&date=2026-10-30&begin=17:00:00&…'>
//     <div class='event-title'>Yuichi Hirakawa Jazz Group</div>
//     <div class='event-date'>05:00 pm</div></a>
// ?nextmonth=1, 2 page forward. Past days in the current month render empty.
// Trust the link's date= but NOT its begin=: it disagrees with the shown
// time (Rich Townsend: begin=22:00, displayed 07:00 pm, and the displayed
// order 5/7/10pm is right). The wp-json events types carry no dates.
import { fetchText, makeEvent, extractTimes, sleep } from '../lib.js';

const BASE = 'https://arthurstavern.nyc/calendar-of-events/';
const MONTHS_AHEAD = 2; // current month + 2; month 3 was empty on 2026-10-30

export function parse(html) {
  const drafts = new Map(); // `${date}:${title}` -> draft, merges repeat sets
  const re = /<a class='tooltip' href='([^']*[?&]date=(\d{4}-\d{2}-\d{2})[^']*)'>\s*<div class='event-title'>([^<]*)<\/div>\s*<div class='event-date'>([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, href, date, title, time] = m;
    const key = `${date}:${title.trim().toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, {
        clubId: 'arthurs',
        title,
        date,
        sets: [],
        url: href.replace(/&amp;|&#038;/g, '&'),
      });
    }
    drafts.get(key).sets.push(...extractTimes(time));
  }
  return [...drafts.values()].map(makeEvent);
}

export async function crawl() {
  const events = [];
  for (let n = 0; n <= MONTHS_AHEAD; n++) {
    if (n) await sleep(1000);
    events.push(...parse(await fetchText(n ? `${BASE}?nextmonth=${n}` : BASE)));
  }
  return events;
}
