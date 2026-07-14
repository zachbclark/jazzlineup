// Village Vanguard — WordPress front page lists each run as:
//   <h2>ARTIST</h2> ... <h3>July 14 - July 19</h3> ... TICKETS link (SquadUp)
// The Vanguard Jazz Orchestra plays every Monday ("Every Monday Night").
// Sets are 8:00 PM & 10:00 PM nightly (house standard, confirmed via ticketing).
import {
  fetchText, makeEvent, htmlToText, monthNum, inferYear, isoDate,
  parsePersonnel, stripPromo,
} from '../lib.js';

const URL_ = 'https://villagevanguard.com/';
const SETS = ['20:00', '22:00'];

function* datesBetween(startIso, endIso, cap = 21) {
  let [y, m, d] = startIso.split('-').map(Number);
  for (let i = 0; i < cap; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const iso = isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (iso > endIso) return;
    yield iso;
  }
}

export function parse(html, today = new Date()) {
  const events = [];
  // Split page into h2 sections; pair each h2 with the first date-range h3 after it.
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = htmlToText(m[1]);
    const section = m[2];
    if (!title || /coming soon/i.test(title)) continue;

    const tixM = section.match(/href="(https?:\/\/vv\.squadup\.com[^"]*)"/);
    const url = tixM ? tixM[1].split('?')[0] : URL_;
    const blurb = htmlToText(section).match(/^([\s\S]{0,300}?)(?:TICKETS|$)/)?.[1]?.trim() ?? '';
    const personnel = parsePersonnel(blurb);
    const details = personnel.length ? null : stripPromo(blurb).slice(0, 300) || null;

    if (/vanguard jazz orchestra/i.test(title) || /every monday/i.test(section)) {
      // Weekly residency: emit the next 8 Mondays (including today if Monday).
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
      for (let i = 0; i < 8; i++) {
        events.push(makeEvent({
          clubId: 'vanguard',
          title: 'Vanguard Jazz Orchestra',
          date: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
          sets: SETS,
          url,
          details: 'The legendary 16-piece big band — every Monday night',
        }));
        d.setDate(d.getDate() + 7);
      }
      continue;
    }

    // "July 14 - July 19" or "August 25 - 30" (h3 somewhere in the section)
    const dr = htmlToText(section).match(
      /([A-Z][a-z]+)\s+(\d{1,2})\s*[-–]\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2})/
    );
    if (!dr || !monthNum(dr[1])) continue;
    const m1 = monthNum(dr[1]);
    const m2 = dr[3] ? monthNum(dr[3]) : m1;
    const y1 = inferYear(m1, Number(dr[2]), today);
    const y2 = m2 < m1 ? y1 + 1 : inferYear(m2, Number(dr[4]), today);
    const start = isoDate(y1, m1, Number(dr[2]));
    const end = isoDate(y2, m2, Number(dr[4]));

    for (const date of datesBetween(start, end)) {
      events.push(makeEvent({ clubId: 'vanguard', title, date, sets: SETS, url, details, personnel }));
    }
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
