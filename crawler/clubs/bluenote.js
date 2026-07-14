// Blue Note NYC — WordPress; /nyc/shows/?calendar_view&month=M&yr=YYYY
// server-renders a month calendar table. NOTE: the raw HTML uses
// single-quoted attributes (class='day') even though browser DevTools shows
// double quotes — all regexes here accept both. Each <td> holds:
//   <div class='day'>N</div>
//   <div class='day-wrap single-show'>
//     <h3><a href='...tm-event...'>Artist</a></h3>
//     <div class='showtimes'><time>8:00 PM</time> & <time>10:30 PM</time>
//       <div class='venue'>Blue Note Jazz Club</div></div>
// The same calendar also lists Sony Hall shows — filtered out by venue.
import {
  fetchText, makeEvent, matchBlocks, htmlToText, extractTimes, isoDate, sleep,
} from '../lib.js';

const BASE = 'https://www.bluenotejazz.com';

export function parseMonth(html, year, month) {
  const events = [];
  for (const td of matchBlocks(html, 'td', /./)) {
    const dayBlock = matchBlocks(td, 'div', /class=['"]day['"]/)[0];
    const day = Number(htmlToText(dayBlock ?? '').match(/\d{1,2}/)?.[0]);
    if (!day) continue;
    const date = isoDate(year, month, day);

    for (const show of matchBlocks(td, 'div', /class=['"]day-wrap/)) {
      const venue = htmlToText(matchBlocks(show, 'div', /class=['"]venue['"]/)[0] ?? '');
      if (!/blue note/i.test(venue)) continue; // skip Sony Hall etc.

      const showtimes = htmlToText(matchBlocks(show, 'div', /class=['"]showtimes['"]/)[0] ?? '')
        .replace(venue, '');
      const h3 = matchBlocks(show, 'h3', /./)[0];
      const a = show.match(/href=['"]([^'"]*tm-event[^'"]*)['"]/i);
      let title = htmlToText(h3 ?? '')
        || show.match(/title=['"]([^'"]+)['"]/)?.[1]
        || show.match(/alt=['"]([^'"]+)['"]/)?.[1]
        || '';
      title = htmlToText(title).trim();
      if (!title || /closed for private event/i.test(title)) continue;

      events.push(makeEvent({
        clubId: 'bluenote',
        title,
        date,
        sets: extractTimes(showtimes),
        url: a ? (a[1].startsWith('http') ? a[1] : BASE + a[1]) : `${BASE}/nyc/shows/`,
        details: venue || null,
      }));
    }
  }
  return events;
}

export async function crawl() {
  const now = new Date();
  const events = [];
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const html = await fetchText(`${BASE}/nyc/shows/?calendar_view&month=${m}&yr=${y}`);
    events.push(...parseMonth(html, y, m));
    await sleep(500);
  }
  return events;
}
