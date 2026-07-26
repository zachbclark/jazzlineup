// Garcia's Chicago (950 W Fulton Market, West Loop) — the Jerry
// Garcia-inspired supper club that opened in 2025. Programming is mostly
// jam/Dead/aftershow territory, so the jazz-keyword + known-artist filter
// applies (the Gold-Diggers precedent) — blues stays IN for this room:
// it's Chicago, and Bobby Rush at a listening room is exactly what our
// crowd wants to know about. Added 2026-07-26 by request of the site's
// first ko-fi supporter.
// WordPress ("Garcias v1.0.0" custom theme), /shows server-renders every
// upcoming show (verified 2026-07-26):
//   <div class="gct-event-item clearfix">
//     <div class="gct-event-date">Jul 26</div>            <- no year
//     <h3 class="gct-event-title">Bobby Rush</h3>
//     <div class="gct-event-tagline">With opening act …</div>
//     <div class="gct-event-meta">Doors 6:00PM / Show 7:00PM</div>
//     <a href="https://garciaschicago.live/garcias-events/bobby-rush">
//     <a href="https://www.ticketmaster.com/bobby-rush-chicago-illinois-07-26-2026/…">
// The Ticketmaster href carries the full date incl. YEAR — prefer it over
// inferYear so a December list crossing into January can't misfile.
import {
  fetchText, makeEvent, cleanText, htmlToText, monthNum, inferYear, isoDate,
} from '../lib.js';
import { matchesKnownArtist } from './_jazzartists.js';

const BASE = 'https://garciaschicago.live';
const JAZZ_RE = /\bjazz|be-?bop|hard bop|improvis|quartet|quintet|trio|big band|fusion|blues|brass band|organ|swing|bossa\b/i;

const to24 = (h, m, ap) => {
  let hh = Number(h) % 12;
  if (/pm/i.test(ap)) hh += 12;
  return `${String(hh).padStart(2, '0')}:${m}`;
};

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  const chunks = String(html).split(/(?=<div[^>]+class=["'][^"']*gct-event-item)/).slice(1);
  for (const chunk of chunks) {
    const title = cleanText(htmlToText(chunk.match(/class=["'][^"']*gct-event-title[^"']*["'][^>]*>([\s\S]*?)<\/(?:h\d|div)>/)?.[1] ?? ''));
    const dm = htmlToText(chunk.match(/class=["'][^"']*gct-event-date[^"']*["'][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '')
      .match(/([A-Za-z]{3,})\s+(\d{1,2})/);
    if (!title || !dm) continue;
    const month = monthNum(dm[1]);
    if (!month) continue;
    const day = Number(dm[2]);
    // tagline carries the openers; cut before the Doors/Show line it nests
    let tagline = cleanText(htmlToText(chunk.match(/class=["'][^"']*gct-event-tagline[^"']*["'][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''));
    tagline = cleanText(tagline.split(/Doors\s+\d/i)[0]);
    if (!JAZZ_RE.test(title + ' ' + tagline) && !matchesKnownArtist(title + ' ' + tagline)) continue;
    const show = chunk.match(/Show\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    // year: trust the Ticketmaster slug's -MM-DD-YYYY when present
    const tmYear = chunk.match(/ticketmaster\.com\/[^"']*-(\d{2})-(\d{2})-(\d{4})[/"']/i);
    const year = tmYear && Number(tmYear[1]) === month && Number(tmYear[2]) === day
      ? Number(tmYear[3])
      : inferYear(month, day, today);
    const url = chunk.match(/href=["'](https?:\/\/(?:www\.)?garciaschicago\.live\/garcias-events\/[^"']+)["']/)?.[1];
    const ev = makeEvent({
      clubId: 'garcias',
      title,
      date: isoDate(year, month, day),
      sets: show ? [to24(show[1], show[2], show[3])] : [],
      url: url ?? `${BASE}/shows`,
      details: tagline || null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/shows`));
}
