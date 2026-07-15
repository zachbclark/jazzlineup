// Bar Bayeux (1066 Nostrand Ave, Prospect-Lefferts) — Squarespace; the /jazz
// page is an events collection, so /jazz?format=json returns { upcoming:[…] }
// with real startDate epochs. Titles carry a "TUES 8-11pm " style prefix and
// often end with the band roster after a dash:
//   "TUES 8-11pm Jam Session. House Band Set - Miki Yamanaka, Matt Dwonszyk, Diego Voglino"
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, applyLateNight } from '../lib.js';

const BASE = 'https://www.barbayeux.com';
const URL_ = `${BASE}/jazz?format=json`;

const DAY_TIME_PREFIX = /^(?:MON|TUE|TUES|WED|THU|THURS|FRI|SAT|SUN)[A-Z]*\.?,?\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\.?\s*/i;

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const it of j.upcoming ?? j.items ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const time = nyTime(it.startDate);
    const plausible = time >= '14:00' || time < '03:00';
    let title = String(it.title).replace(DAY_TIME_PREFIX, '').trim();
    // Trailing roster after the last " - ": keep it as details, tighten title.
    let details = null;
    const dash = title.split(/\s+[-–—]\s+/);
    if (dash.length > 1 && /,/.test(dash[dash.length - 1])) {
      details = dash.pop();
      title = dash.join(' - ').trim();
    }
    const excerpt = stripPromo(htmlToText(it.excerpt ?? ''));
    events.push(makeEvent(applyLateNight({
      clubId: 'barbayeux',
      title: title || htmlToText(it.title),
      date: nyDate(it.startDate),
      sets: plausible ? [time] : [],
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/jazz`,
      details: details ?? (excerpt.slice(0, 300) || null),
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
