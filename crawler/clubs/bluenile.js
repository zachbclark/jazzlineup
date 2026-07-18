// Blue Nile (532 Frenchmen St) — jazz, brass, and funk upstairs and down;
// on Frenchmen the brass IS the jazz, so everything they book stays.
// Squarespace events collection, plain JSON:
//   /calendar-tickets-?format=json -> { upcoming: [{ title, startDate
//   (epoch ms), fullUrl }] }
// Titles wear date/time decoration ("Artist • SAT JUL. 18 • 7:30PM") —
// stripped; the real time comes from startDate in America/Chicago.
import { fetchText, makeEvent, applyLateNight, cleanText, tzDate, tzTime } from '../lib.js';

const BASE = 'https://www.bluenilelive.com';

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  const seen = new Set();
  for (const item of j.upcoming ?? j.items ?? []) {
    if (!item?.title || !item?.startDate) continue;
    const title = cleanText(String(item.title).split('•')[0]);
    if (!title) continue;
    const ev = makeEvent(applyLateNight({
      clubId: 'bluenile',
      title,
      date: tzDate(item.startDate, 'America/Chicago'),
      sets: [tzTime(item.startDate, 'America/Chicago')].filter(Boolean),
      url: item.fullUrl ? BASE + item.fullUrl : `${BASE}/calendar-tickets-`,
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/calendar-tickets-?format=json`, { headers: { accept: 'application/json' } }));
}
