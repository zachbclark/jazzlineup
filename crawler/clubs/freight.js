// Freight & Salvage (2020 Addison St, downtown Berkeley) — the nonprofit
// roots-music institution, running since 1968. Mostly folk/bluegrass/
// Americana with a steady jazz thread, and their /shows/ page is
// server-rendered WordPress with an explicit genre tag per card:
//   <article class="list-view-item card">
//     <div class="genre-box"><div class="genre">LATIN JAZZ</div></div>
//     <h2 class="event-name"><a href="https://secure.thefreight.org/NNN/NNN">Title</a></h2>
//     <h3 class="supports">Opener</h3>
//     <span class="dates">Wednesday, Jul 15th 2026</span>
//     <span class="start">Doors: 7:00 PM / Show: 8:00 PM</span>
//     …ticket-price… $39/$44
// Mixed room -> genre-filtered to the jazz family (incl. swing and fusions).
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, isoDate,
  cleanText, htmlToText,
} from '../lib.js';

const BASE = 'https://thefreight.org';
const URL_ = `${BASE}/shows/`;
const JAZZ_GENRE_RE = /jazz|swing|be-?bop/i;

export function parse(html) {
  const events = [];
  const cards = html.match(/<article class="list-view-item card">[\s\S]*?(?=<article class="list-view-item card">|$)/gi) ?? [];
  for (const card of cards) {
    const genre = cleanText((card.match(/class="genre"[^>]*>([^<]*)/i) ?? [])[1] ?? '');
    if (!JAZZ_GENRE_RE.test(genre)) continue;
    const nameM = card.match(/class="event-name"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const dateM = card.match(/class="dates"[^>]*>\s*[A-Za-z]+,\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
    if (!nameM || !dateM) continue;
    const month = monthNum(dateM[1]);
    if (!month) continue;
    const show = normalizeTime((card.match(/Show:\s*([\d:]+\s*[AP]M)/i) ?? [])[1]);
    const support = htmlToText((card.match(/class="supports"[^>]*>([\s\S]*?)<\/h3>/i) ?? [])[1] ?? '');
    const price = (card.match(/\$\d+(?:\.\d\d)?(?:\s*\/\s*\$\d+(?:\.\d\d)?)?/) ?? [])[0] ?? null;
    events.push(makeEvent(applyLateNight({
      clubId: 'freight',
      title: htmlToText(nameM[2]),
      date: isoDate(Number(dateM[3]), month, Number(dateM[2])),
      sets: show ? [show] : [],
      url: nameM[1],
      details: support ? `with ${support}` : null,
      priceText: price ? price.replace(/\s+/g, '') : null,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
