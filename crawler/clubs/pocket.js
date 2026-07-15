// The Pocket (130 W 46th St) — WordPress with a custom "simple-events"
// plugin. The /calendar/ page server-renders the current month; other months
// come from the same endpoint the grid's arrows call:
//   POST /wp-json/simple-events/calendar  {"date":"YYYY-MM-01"} -> { html }
// Month-grid markup per day:
//   <div id="simple-events-calendar-day-2026-07-20" class="…day-cell…">
//     <article class="…calendar-event">
//       <time datetime="19:00">7:00 pm</time>
//       <h3 class="…calendar-event-title"><a href="…/event/slug/?se-date=NN">Title</a>
// Desktop + mobile render the same day twice — de-dupe by (date, title, time).
import { fetchText, makeEvent, htmlToText, nyDate } from '../lib.js';

const BASE = 'https://thepocketnyc.com';
const MONTHS_AHEAD = 2; // current + next

export function parse(html) {
  const drafts = new Map(); // `${date}:${title}` -> { …, sets:Set }
  // Walk day containers by id; capture until the next day id or end.
  const dayRe = /id="simple-events-calendar-day-(\d{4}-\d{2}-\d{2})"([\s\S]*?)(?=id="simple-events-calendar-day-\d{4}|$)/g;
  let d;
  while ((d = dayRe.exec(html))) {
    const [, date, block] = d;
    const evRe = /<time[^>]*datetime="(\d{2}:\d{2})[^"]*"[^>]*>[\s\S]*?calendar-event-title[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = evRe.exec(block))) {
      const time = m[1];
      const url = m[2].replace(/&amp;/g, '&').replace(/\?se-date=\d+.*/,'');
      const title = htmlToText(m[3]);
      if (!title) continue;
      const key = `${date}:${title.toLowerCase()}`;
      if (!drafts.has(key)) drafts.set(key, { clubId: 'pocket', title, date, sets: new Set(), url });
      drafts.get(key).sets.add(time);
    }
  }
  return [...drafts.values()].map((dr) => makeEvent({ ...dr, sets: [...dr.sets] }));
}

export async function crawl() {
  const out = [];
  const [y, m] = nyDate(Date.now()).split('-').map(Number);
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const dt = new Date(Date.UTC(y, m - 1 + i, 1));
    const first = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
    try {
      const body = await fetchText(`${BASE}/wp-json/simple-events/calendar`, {
        method: 'POST',
        body: JSON.stringify({ date: first }),
        headers: { 'content-type': 'application/json', accept: 'application/json' },
      });
      out.push(...parse(JSON.parse(body).html ?? ''));
    } catch (err) {
      if (i === 0) throw err; // current month must work
    }
  }
  return out;
}
