// Smalls + Mezzrow — smallslive.com. The site is jQuery-rendered but the data
// comes from a JSON endpoint: /search/upcoming-ajax/?page=N which returns
// { template: "<html>", page_range: [...] }. The template HTML is structured:
//   .day-list > .title1 (e.g. "Mon Jul 13")
//   .day-list > .venue-group > (.smalls-color|.mezzrow-color) venue label
//   .venue-group > .day-event > .text-grey (times) + .day_event_title + <a href>
import {
  fetchText, makeEvent, matchBlocks, htmlToText, extractTimes,
  monthNum, inferYear, isoDate, sleep,
} from '../lib.js';

const BASE = 'https://www.smallslive.com';

function venueOf(groupHtml) {
  if (/smalls-color/.test(groupHtml)) return 'smalls';
  if (/mezzrow-color/.test(groupHtml)) return 'mezzrow';
  return null; // e.g. Jazzcultural Theater — not tracked
}

export function parsePage(templateHtml, today = new Date()) {
  const events = [];
  for (const day of matchBlocks(templateHtml, 'div', /class="[^"]*\bday-list\b/)) {
    const titleBlock = matchBlocks(day, 'div', /class="[^"]*\btitle1\b/)[0] ?? '';
    const m = htmlToText(titleBlock).match(/([A-Za-z]{3,})\s+(\d{1,2})/); // "Mon Jul 13" or "Jul 13"
    let mo, dd;
    const parts = htmlToText(titleBlock).match(/([A-Za-z]+)\s+(\d{1,2})/g) ?? [];
    for (const p of parts) {
      const [, name, num] = p.match(/([A-Za-z]+)\s+(\d{1,2})/);
      if (monthNum(name)) { mo = monthNum(name); dd = Number(num); break; }
    }
    if (!mo) continue;
    const date = isoDate(inferYear(mo, dd, today), mo, dd);

    for (const group of matchBlocks(day, 'div', /class="[^"]*\bvenue-group\b/)) {
      const clubId = venueOf(group);
      if (!clubId) continue;
      for (const ev of matchBlocks(group, 'div', /class="[^"]*\bday-event\b/)) {
        const timeText = htmlToText(matchBlocks(ev, 'div', /class="[^"]*\btext-grey\b/)[0] ?? '');
        const title = htmlToText(matchBlocks(ev, 'div', /class="[^"]*\bday_event_title\b/)[0] ?? '');
        if (!title) continue;
        const href = (ev.match(/href="([^"]+)"/) ?? [])[1];
        events.push(makeEvent({
          clubId,
          title,
          date,
          sets: extractTimes(timeText),
          url: href ? BASE + href.split('?')[0] : BASE,
          details: timeText || null,
        }));
      }
    }
  }
  return events;
}

export async function crawl() {
  const events = [];
  let pageRange = [1];
  for (let page = 1; page <= Math.min(4, Math.max(...pageRange)); page++) {
    const body = await fetchText(`${BASE}/search/upcoming-ajax/?page=${page}`, {
      headers: { 'x-requested-with': 'XMLHttpRequest', accept: 'application/json' },
    });
    const j = JSON.parse(body);
    if (Array.isArray(j.page_range) && j.page_range.length) pageRange = j.page_range;
    events.push(...parsePage(j.template ?? ''));
    await sleep(500); // be polite
  }
  return events;
}
