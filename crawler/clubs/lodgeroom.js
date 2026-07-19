// Lodge Room (104 N Ave 56, Highland Park) — the 1922 Masonic hall turned
// 500-cap concert room; Jazz Is Dead's home base among mostly indie/psych
// bookings, so the jazz filter applies (Gold-Diggers precedent). NOTE the
// real domain is lodgeroomhlp.com — lodgeroom.com is a parked squatter.
// WordPress + the Tessera ticketing plugin; the homepage embeds one
//   eventObjects.push({ "id":…, "eventDate":"07/19/2026 7:30 pm",
//     "mainArtist":["…"], "additionalArtists":["…"], "venue":"Lodge Room",
//     "link":…, "doors":"6:30 pm", "tags":[…] })
// blob per show (verified 2026-07-19) — parse those, not the cards.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, cleanText,
  decodeEntities,
} from '../lib.js';
import { matchesKnownArtist } from './_jazzartists.js';

const BASE = 'https://www.lodgeroomhlp.com';
const JAZZ_RE = /\bjazz|be-?bop|hard bop|improvis|quartet|quintet|big band|bossa|afrobeat orchestra\b/i;

// "07/19/2026 7:30 pm" -> { date: '2026-07-19', time: '19:30' }
function parseEventDate(s) {
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}(?::\d{2})?\s*[ap]m))?/i);
  if (!m) return null;
  return { date: `${m[3]}-${m[1]}-${m[2]}`, time: m[4] ? normalizeTime(m[4]) : null };
}

export function parse(html) {
  const events = [];
  for (const m of String(html).matchAll(/eventObjects\.push\((\{[\s\S]*?\})\);/g)) {
    let o;
    try { o = JSON.parse(m[1]); } catch { continue; }
    if (!/lodge room/i.test(String(o.venue ?? ''))) continue; // offsite bookings
    const when = parseEventDate(o.eventDate);
    if (!when) continue;
    const artists = [...(o.mainArtist ?? []), ...(o.additionalArtists ?? [])]
      .map((a) => cleanText(decodeEntities(String(a)))).filter(Boolean);
    const title = artists[0] ?? cleanText(decodeEntities(String(o.additionalInformation ?? '')));
    if (!title) continue;
    // mixed-genre room: keyword net over everything they wrote about the
    // show, plus the known-artist safety net (precision-first; thin is fine)
    const hay = [title, ...artists, ...(o.tags ?? []), String(o.additionalInformation ?? '')].join(' ');
    if (!JAZZ_RE.test(hay) && !artists.some((a) => matchesKnownArtist(a))) continue;
    const support = artists.slice(1);
    events.push(makeEvent(applyLateNight({
      clubId: 'lodgeroom',
      title,
      date: when.date,
      sets: when.time ? [when.time] : [],
      url: o.link ?? `${BASE}/`,
      details: support.length ? `With ${support.join(', ')}` : null,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/`));
}
