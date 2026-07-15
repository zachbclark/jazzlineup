// LA Phil family — one feed, three venues:
//   GET https://www.laphil.com/events/feed/live
// -> [{ program:{name}, supporting_artists (html), start_time (ISO+offset),
//       genres:[{name:'Jazz/Blues'…}], venue:{name}, absolute_url, is_past }]
// Venues: Hollywood Bowl (summer), Walt Disney Concert Hall (winter jazz
// series), The Ford (Cahuenga Pass amphitheater). Season-wide (~500 events)
// tagged by genre — we keep Jazz/Blues and emit per venue.
import { fetchText, makeEvent, htmlToText, splitIso } from '../lib.js';

const BASE = 'https://www.laphil.com';
const FEED = `${BASE}/events/feed/live`;

const VENUE_CLUB = {
  'hollywood bowl': 'hollywoodbowl',
  'walt disney concert hall': 'disneyhall',
  'the ford': 'theford',
};

export function parse(jsonText) {
  const feed = JSON.parse(jsonText);
  const events = [];
  for (const ev of Array.isArray(feed) ? feed : []) {
    if (ev?.is_past) continue;
    if (!(ev?.genres ?? []).some((g) => /jazz/i.test(g?.name ?? ''))) continue;
    const title = htmlToText(ev.program?.name ?? '');
    if (!title || !ev.start_time) continue;
    // venue arrives as an object ({name}) in the live feed — never String() it
    const venueName = (typeof ev.venue === 'object' && ev.venue !== null ? ev.venue.name : String(ev.venue ?? '')).toLowerCase().trim();
    const clubId = VENUE_CLUB[venueName];
    if (!clubId) continue;
    const { date, time } = splitIso(ev.start_time); // offset-local ISO: fields are LA-local
    const artists = htmlToText(String(ev.supporting_artists ?? '').replace(/<br\s*\/?>/gi, ' · '));
    events.push(makeEvent({
      clubId,
      title,
      date,
      sets: time ? [time] : [],
      url: ev.absolute_url ? (ev.absolute_url.startsWith('http') ? ev.absolute_url : BASE + ev.absolute_url) : ev.buy_url ?? BASE,
      details: artists.slice(0, 300) || null,
      priceText: ev.is_free ? 'Free' : null,
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(FEED, { headers: { accept: 'application/json' } }));
}
