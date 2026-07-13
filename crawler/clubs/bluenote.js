// Blue Note NYC — WordPress; /nyc/shows/?calendar_view&month=M&yr=YYYY
// server-renders a month calendar table: each <td> has <div class="day">N</div>
// and .single-show blocks with an <a href="...tm-event..."> (title attr / img alt),
// .showtimes ("8:00 PM 10:30 PM") and .venue.
import {
  fetchText, makeEvent, matchBlocks, htmlToText, extractTimes, isoDate, sleep,
} from '../lib.js';

const BASE = 'https://www.bluenotejazz.com';

export function parseMonth(html, year, month) {
  const events = [];
  for (const td of matchBlocks(html, 'td', /./)) {
    const dayBlock = matchBlocks(td, 'div', /class="[^"]*\bday\b/)[0];
    const day = Number(htmlToText(dayBlock ?? '').match(/\d{1,2}/)?.[0]);
    if (!day) continue;
    const date = isoDate(year, month, day);

    for (const show of matchBlocks(td, 'div', /class="[^"]*\bsingle-show\b/)) {
      const a = show.match(/<a[^>]*href="([^"]*tm-event[^"]*)"[^>]*>/i);
      const titleAttr = show.match(/title="([^"]+)"/)?.[1];
      const alt = show.match(/alt="([^"]+)"/)?.[1];
      const times = htmlToText(matchBlocks(show, 'div', /class="[^"]*\bshowtimes\b/)[0] ?? '');
      const venue = htmlToText(matchBlocks(show, 'div', /class="[^"]*\bvenue\b/)[0] ?? '');
      let title = titleAttr ?? alt ?? htmlToText(show).replace(times, '').replace(venue, '').trim();
      title = title.replace(/\s+/g, ' ').trim();
      if (!title || /closed for private event/i.test(title)) continue;

      events.push(makeEvent({
        clubId: 'bluenote',
        title,
        date,
        sets: extractTimes(times),
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
