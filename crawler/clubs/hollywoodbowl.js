// Hollywood Bowl — LA Phil's summer amphitheater. Clean venue feed:
//   GET https://www.hollywoodbowl.com/events/feed/live
// -> [{ program:{name}, supporting_artists (html), start_time (ISO+offset),
//       genres:[{name:'Jazz/Blues'…}], absolute_url, buy_url, is_past, venue }]
// Season-wide feed (~500 events) tagged by genre — we keep Jazz/Blues.
import { fetchText, makeEvent, htmlToText, splitIso } from '../lib.js';

const BASE = 'https://www.hollywoodbowl.com';
const FEED = `${BASE}/events/feed/live`;

export function parse(jsonText) {
  const feed = JSON.parse(jsonText);
  const events = [];
  for (const ev of Array.isArray(feed) ? feed : []) {
    if (ev?.is_past) continue;
    if (!(ev?.genres ?? []).some((g) => /jazz/i.test(g?.name ?? ''))) continue;
    const title = htmlToText(ev.program?.name ?? '');
    if (!title || !ev.start_time) continue;
    // venue arrives as an object ({name: 'Hollywood Bowl'}) in the live feed
    // — String(obj) is '[object Object]', which silently dropped EVERY event
    // on the first live crawl. Resolve the name before filtering.
    const venueName = typeof ev.venue === 'object' && ev.venue !== null ? ev.venue.name ?? '' : String(ev.venue ?? '');
    if (venueName && !/hollywood bowl/i.test(venueName)) continue;
    const { date, time } = splitIso(ev.start_time); // offset-local ISO: fields are LA-local
    const artists = htmlToText(String(ev.supporting_artists ?? '').replace(/<br\s*\/?>/gi, ' · '));
    events.push(makeEvent({
      clubId: 'hollywoodbowl',
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
