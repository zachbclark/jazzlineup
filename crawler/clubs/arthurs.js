// Arthur's Tavern (57 Grove St) — same room since 1937; programming is a
// fixed weekly rotation published as text on /performances.html:
//   "MONDAYS Grove Street Stompers Dixieland Jazz Band (7pm - 10pm)
//    Toni Menage (10pm) TUESDAYS …"
// Generator crawler: parse the weekday sections once, then emit dated events
// for the next 3 weeks. The page has accumulated spam links over the years,
// so we work from visible text only and ignore anything URL-shaped.
import { fetchText, makeEvent, htmlToText, extractTimes, isoDate } from '../lib.js';

const URL_ = 'https://www.arthurstavernnyc.com/performances.html';
const DAYS = ['SUNDAYS', 'MONDAYS', 'TUESDAYS', 'WEDNESDAYS', 'THURSDAYS', 'FRIDAYS', 'SATURDAYS'];
const DAY_RE = new RegExp(`\\b(${DAYS.join('|')})\\b`, 'g');
const WEEKS_AHEAD = 3;

// Parse one weekday section: "Act Name (7pm - 10pm) Other Act (10pm)" ->
// [{ title, sets }]. Times in parens; first time of a range is the downbeat.
function parseActs(text) {
  const acts = [];
  const re = /([^()]{3,80}?)\s*\(([^)]*\d[^)]*)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const title = m[1].replace(/https?:\S+/gi, ' ').replace(/\s+/g, ' ').trim()
      .replace(/^[-–—:,.&\s]+/, '');
    const times = extractTimes(m[2]);
    if (!title || !/[a-z]/i.test(title) || !times.length) continue;
    acts.push({ title, sets: [times[0]] }); // range end = closing time, not a set
  }
  return acts;
}

export function parse(html, today = new Date()) {
  const text = htmlToText(html).replace(/\s+/g, ' ');
  // Split into weekday sections.
  const sections = [];
  const hits = [...text.matchAll(DAY_RE)];
  for (let i = 0; i < hits.length; i++) {
    const day = DAYS.indexOf(hits[i][1]);
    const start = hits[i].index + hits[i][1].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : Math.min(text.length, start + 600);
    if (!sections.some((s) => s.day === day)) sections.push({ day, acts: parseActs(text.slice(start, end)) });
  }

  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const sec = sections.find((s) => s.day === d.getDay());
    if (!sec) continue;
    for (const act of sec.acts) {
      events.push(makeEvent({
        clubId: 'arthurs',
        title: act.title,
        date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
        sets: act.sets,
        url: URL_,
      }));
    }
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
