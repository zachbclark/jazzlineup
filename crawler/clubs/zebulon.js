// Zebulon (2478 Fletcher Dr, Frogtown) — the Brooklyn-transplant room whose
// bookings run rock/experimental/jazz. DICE Event List Widget venue; see
// _dicepartners.js for the shared key-scrape + API approach. Mixed-genre
// bookings, so the jazz-keyword filter applies (JCAL/Mint policy).
import { parseDiceEvents, crawlDiceVenue } from './_dicepartners.js';

const SITE = 'https://zebulon.la/';
const JAZZ_RE = /\bjazz|be-?bop|hard bop|improvis|quartet|quintet|trio|big band|free improvisation|spiritual\b/i;

export function parse(jsonText) {
  return parseDiceEvents(jsonText, 'zebulon', { fallbackUrl: SITE, jazzRe: JAZZ_RE });
}

export async function crawl() {
  return crawlDiceVenue({
    clubId: 'zebulon',
    keyPage: SITE,
    venueFilter: 'Zebulon',
    fallbackUrl: SITE,
    jazzRe: JAZZ_RE,
  });
}
