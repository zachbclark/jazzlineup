// JCAL — Jamaica Center for Arts and Learning (Jamaica, Queens). Squarespace
// site whose events widget is SociableKit rendering their Eventbrite
// collection; the widget's data feed is public JSON:
//   GET https://data.accentapi.com/feed/25581042.json
// -> { events: [{ name, date_start 'YYYY-MM-DD', start_time_raw
//      'YYYY-MM-DDTHH:MM:SS' (local ET), description, ticket_uri, … }] }
// JCAL is a mixed arts center (theater, dance, World Cup viewings…), so we
// keep only jazz-flagged events — precision over recall for a jazz site.
import { fetchText, makeEvent, htmlToText, splitIso, stripPromo } from '../lib.js';

const FEED = 'https://data.accentapi.com/feed/25581042.json';
const SITE = 'https://jcal.org/events-tickets';
const JAZZ_RE = /\bjazz|be-?bop|swing|blues night|jam session|quartet|quintet|trio|big band|latin sounds\b/i;

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    if (!ev?.name || !ev?.date_start) continue;
    const desc = htmlToText(ev.description ?? '');
    if (!JAZZ_RE.test(`${ev.name} ${desc.slice(0, 600)}`)) continue;
    const { time } = splitIso(ev.start_time_raw ?? '');
    events.push(makeEvent({
      clubId: 'jcal',
      title: ev.name,
      date: ev.date_start,
      sets: time && time !== '00:00' ? [time] : [],
      url: ev.ticket_uri || SITE,
      details: stripPromo(desc).slice(0, 300) || null,
      priceText: ev.price_range || null,
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(FEED, { headers: { accept: 'application/json' } }));
}
