// The Mint (6010 W Pico Blvd) — historic LA room, est. 1937. WordPress with
// the Plot venue theme; listings come from a clean JSON API:
//   GET /api/plot/v1/listings?notLoaded=false&currentpage=1&listingsPerPage=24
// -> [{ title, day 'YYYYMMDD', startTime '7pm', doors, permalink,
//       description, fromPrice, … }]
// Mixed-genre bookings (pop/soul/rock/jazz), so we keep jazz-flagged shows
// only — same precision-first policy as JCAL.
import { fetchText, makeEvent, htmlToText, normalizeTime, stripPromo, parsePersonnel } from '../lib.js';
import { matchesKnownArtist } from './_jazzartists.js';

const BASE = 'https://themintla.com';
const PAGES = 3;
const JAZZ_RE = /\bjazz|be-?bop|hard bop|swing|improvis|quartet|quintet|trio|big band|brass band|fusion\b/i;

export function parse(jsonText) {
  const listings = JSON.parse(jsonText);
  const events = [];
  for (const it of Array.isArray(listings) ? listings : []) {
    if (!it?.title || !/^\d{8}$/.test(String(it.day ?? ''))) continue;
    const desc = htmlToText(it.description ?? '');
    if (!JAZZ_RE.test(`${it.title} ${desc.slice(0, 800)}`) && !matchesKnownArtist(it.title)) continue;
    const d = String(it.day);
    const time = normalizeTime(it.startTime ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent({
      clubId: 'mint',
      title: it.title,
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      sets: time ? [time] : [],
      url: it.permalink || `${BASE}/events/`,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
      priceText: it.fromPrice || null,
    }));
  }
  return events;
}

export async function crawl() {
  const out = [];
  for (let p = 1; p <= PAGES; p++) {
    const url = `${BASE}/api/plot/v1/listings?notLoaded=false&currentpage=${p}&listingsPerPage=24`;
    let text;
    try {
      text = await fetchText(url, { headers: { accept: 'application/json' } });
    } catch (err) {
      if (p === 1) throw err;
      break;
    }
    const batch = JSON.parse(text);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...parse(text));
    if (batch.length < 24) break; // short page = last page
  }
  return out;
}
