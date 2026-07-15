// Birdland (Jazz Club + Theater rooms) — WordPress + TicketWeb plugin.
// The homepage (and /page/2/, /page/3/ ...) server-renders an upcoming-events
// list: .tw-section blocks containing .tw-name (title + link),
// .tw-venue-name, .tw-event-date ("Sun Jul 12"), .tw-event-time, .tw-event-door-time.
import {
  fetchText, makeEvent, matchBlocks, htmlToText, extractTimes,
  monthNum, inferYear, isoDate, sleep,
} from '../lib.js';

const BASE = 'https://www.birdlandjazz.com';
const PAGES = 4; // ~16 events/page; 4 pages ≈ a month+

export function parsePage(html, today = new Date()) {
  const events = [];
  for (const sec of matchBlocks(html, 'div', /class="[^"]*\btw-section\b/)) {
    const nameBlock = matchBlocks(sec, 'div', /class="[^"]*\btw-name\b/)[0] ?? '';
    const title = htmlToText(nameBlock);
    if (!title) continue;
    const href = (nameBlock.match(/href="([^"]+)"/) ?? sec.match(/href="([^"]*tm-event[^"]*)"/) ?? [])[1];

    const dateText = htmlToText(matchBlocks(sec, 'span', /class="[^"]*\btw-event-date\b/)[0] ?? '');
    const dm = dateText.match(/([A-Za-z]{3,})\s+(\d{1,2})/);
    if (!dm || !monthNum(dm[1])) continue;
    const mo = monthNum(dm[1]);
    const date = isoDate(inferYear(mo, Number(dm[2]), today), mo, Number(dm[2]));

    const showTime = htmlToText(matchBlocks(sec, 'span', /class="[^"]*\btw-event-time\b/)[0] ?? '');
    const doorRaw = htmlToText(matchBlocks(sec, 'span', /class="[^"]*\btw-event-door-time\b/)[0] ?? '');
    // site text arrives as "Doors @ 7:30PM /" — extract just the time
    const doorTime = (doorRaw.match(/\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?/i) ?? [])[0] ?? null;
    const venue = htmlToText(matchBlocks(sec, 'span', /class="[^"]*\btw-venue-name\b/)[0] ?? '');
    const theater = /theater/i.test(venue);

    events.push(makeEvent({
      clubId: 'birdland',
      title: theater ? `${title} (Theater)` : title,
      date,
      sets: extractTimes(showTime),
      url: href ? (href.startsWith('http') ? href : BASE + href) : BASE,
      details: [venue, doorTime && `Doors @ ${doorTime}`].filter(Boolean).join(' — ') || null,
    }));
  }
  return events;
}

export async function crawl() {
  const events = [];
  for (let p = 1; p <= PAGES; p++) {
    const url = p === 1 ? `${BASE}/` : `${BASE}/page/${p}/`;
    events.push(...parsePage(await fetchText(url)));
    await sleep(500);
  }
  // de-dupe (same event can appear on consecutive pages if list shifts)
  return [...new Map(events.map((e) => [e.id, e])).values()];
}
