// Bar Bayeux (1066 Nostrand Ave, Prospect-Lefferts) — Squarespace; the /jazz
// page is an events collection, so /jazz?format=json returns { upcoming:[…] }
// with real startDate epochs. Titles carry a day/time prefix in two shapes:
//   "TUES 8-11pm Jam Session..."   (a RANGE — start time only)
//   "WED 8 & 9:30 Morgan Guerin"   (two SETS — both are showtimes)
// and often end with the band roster after a dash:
//   "TUES 8-11pm Jam Session. House Band Set - Miki Yamanaka, Matt Dwonszyk, Diego Voglino"
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, applyLateNight, extractTimes, decodeEntities } from '../lib.js';

const BASE = 'https://www.barbayeux.com';
const URL_ = `${BASE}/jazz?format=json`;

// Day name, then a run of times joined by -, –, &, +, or "and" (any mix),
// each time a bare hour, h:mm, and/or am/pm. Captures the run for set mining.
const DAY_TIME_PREFIX = /^(?:MON|TUE|TUES|WED|THU|THURS|FRI|SAT|SUN)[A-Z]*\.?,?\s+((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:[-–&+]|and\s)?\s*)+)\.?\s*/i;

// "8 & 9:30" -> ['20:00','21:30']; "8-11pm" is a range -> ['20:00'].
// Bare evening hours get pm (this is a bar; nothing starts at 8am).
function setsFromPrefix(run) {
  if (!run) return [];
  let r = String(run).trim();
  if (/[-–]/.test(r) && !/[&+]|\band\b/i.test(r)) r = r.split(/[-–]/)[0];
  const withPm = r.replace(/(\d{1,2}(?::\d{2})?)(\s*(?:[ap]m))?/gi,
    (_, t, ap) => t + (ap ?? 'pm'));
  return extractTimes(withPm);
}

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const it of j.upcoming ?? j.items ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const time = nyTime(it.startDate);
    const plausible = time >= '14:00' || time < '03:00';
    // decode FIRST: the collection JSON ships "8 &amp; 9:30", and an
    // undecoded &amp; breaks the prefix run mid-way ("amp; 9:30 Morgan…")
    const rawTitle = decodeEntities(String(it.title));
    const prefix = rawTitle.match(DAY_TIME_PREFIX);
    const prefixSets = setsFromPrefix(prefix?.[1]);
    let title = rawTitle.replace(DAY_TIME_PREFIX, '').trim();
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
      // the title's own times beat the collection startDate (which only
      // knows the first set); fall back to the epoch when there's no prefix
      sets: prefixSets.length ? prefixSets : (plausible ? [time] : []),
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/jazz`,
      details: details ?? (excerpt.slice(0, 300) || null),
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
