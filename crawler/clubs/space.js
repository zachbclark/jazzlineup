// SPACE (1245 Chicago Ave, Evanston) — north-shore listening room run by
// the 16" On Center group. Squarespace shell, but the event feed is the
// Ticketmaster Discovery API, called with an apikey published in the site's
// own /s/event-feed-widget.js (the DICE trick: scrape the key fresh each
// crawl, keep the last known one as fallback). Events carry Chicago-LOCAL
// dates/times (no tz math) plus genre tags — mixed room (folk, rock,
// country, jazz), so we keep genre Jazz only. Venue KovZpakJQe is SPACE
// itself; their Cahn Auditorium bookings ride a different venueId and are
// deliberately excluded.
import { fetchText, makeEvent, applyLateNight, cleanText } from '../lib.js';

const WIDGET = 'https://evanstonspace.com/s/event-feed-widget.js';
const VENUE_ID = 'KovZpakJQe';
const FALLBACK_KEY = '8GdH3nQcFnnZkzWGuPSGkh9oIKUGjffQ'; // seen 2026-07-15
const KEY_RE = /apikey["'\s:=]+["']?([A-Za-z0-9]{25,})/i;

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j._embedded?.events ?? []) {
    const venue = ev._embedded?.venues?.[0]?.name ?? '';
    if (!/^space$/i.test(venue)) continue;
    const genre = ev.classifications?.[0]?.genre?.name ?? '';
    if (!/jazz/i.test(genre)) continue;
    const date = ev.dates?.start?.localDate;
    if (!date || !ev.name) continue;
    const time = (ev.dates?.start?.localTime ?? '').slice(0, 5) || null;
    const pr = ev.priceRanges?.[0];
    const priceText = pr?.min
      ? (pr.max && pr.max !== pr.min ? `$${Math.round(pr.min)}-${Math.round(pr.max)}` : `$${Math.round(pr.min)}`)
      : null;
    const soldOut = /^sold\s*out\s*[-–—:]\s*/i.test(ev.name);
    events.push(makeEvent(applyLateNight({
      clubId: 'space',
      title: cleanText(String(ev.name).replace(/^sold\s*out\s*[-–—:]\s*/i, '')),
      date,
      sets: time ? [time] : [],
      url: ev.url ?? 'https://evanstonspace.com',
      details: soldOut ? 'Sold out' : null,
      priceText,
    })));
  }
  return events;
}

export async function crawl() {
  let key = FALLBACK_KEY;
  try {
    const widget = await fetchText(WIDGET);
    key = widget.match(KEY_RE)?.[1] ?? key;
  } catch { /* widget moved? the fallback key still works until they rotate it */ }
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?size=200&apikey=${key}&venueId=${VENUE_ID}`;
  return parse(await fetchText(url, { headers: { accept: 'application/json' } }));
}
