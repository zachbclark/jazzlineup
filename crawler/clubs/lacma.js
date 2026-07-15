// Jazz at LACMA — free Friday-evening series on the LACMA campus (Smidt
// Welcome Plaza), May–November. Drupal, server-rendered event cards:
//   <div class="card-event"> … card-event__name > a[href=/event/slug] Title
//     card-event__date: <span>Fri Jul 17</span> | <span>6 pm PT</span>
// We crawl the Jazz at LACMA hub filter; the sibling "Latin Sounds"
// (Saturdays) series shares the markup and is included via its own hub page.
import { fetchText, makeEvent, matchBlocks, htmlToText, monthNum, inferYear, isoDate, normalizeTime, sleep } from '../lib.js';

const BASE = 'https://www.lacma.org';
const HUBS = ['Jazz+at+LACMA', 'Latin+Sounds'];

export function parse(html, today = new Date()) {
  const events = [];
  for (const card of matchBlocks(html, 'div', /card-event(?!__)/)) {
    const nameM = card.match(/card-event__name[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const dateM = htmlToText(card.match(/card-event__date[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
      .match(/([A-Za-z]+)\s+(\d{1,2})\s*\|?\s*(\d{1,2}(?::\d{2})?\s*[ap]m)?/i);
    if (!nameM || !dateM) continue;
    const title = htmlToText(nameM[2]);
    // dateM[1] may be the weekday ("Fri Jul 17" -> match yields Fri, 17)…
    // re-match with weekday tolerated:
    const dm = htmlToText(card.match(/card-event__date[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
      .match(/(?:[A-Za-z]{3,9}\s+)?([A-Za-z]{3,9})\s+(\d{1,2})/);
    if (!title || !dm || !monthNum(dm[1])) continue;
    const month = monthNum(dm[1]);
    const date = isoDate(inferYear(month, Number(dm[2]), today), month, Number(dm[2]));
    const time = normalizeTime(dateM[3] ?? '');
    events.push(makeEvent({
      clubId: 'lacma',
      title: title.replace(/^Jazz at LACMA:\s*/i, '').replace(/^Latin Sounds:\s*/i, ''),
      date,
      sets: time ? [time] : [],
      url: nameM[1].startsWith('http') ? nameM[1] : BASE + nameM[1],
      details: 'Free outdoor concert — Smidt Welcome Plaza',
      priceText: 'Free',
    }));
  }
  return events;
}

export async function crawl() {
  const out = [];
  for (const hub of HUBS) {
    try {
      out.push(...parse(await fetchText(`${BASE}/event-calendar-by-day?event_hub=${hub}`)));
    } catch { /* one series failing shouldn't sink the other */ }
    await sleep(150);
  }
  return out;
}
