// Gold-Diggers (5632 Santa Monica Blvd, East Hollywood) — hotel, bar, and
// recording studios in one; musician-run bookings with the young scene in
// the bar most nights. DICE Event List Widget on their /pages/drink page
// (Shopify site); shared key-scrape approach in _dicepartners.js. Bookings
// run soul/rock/jazz, so the jazz-keyword filter applies.
import { parseDiceEvents, crawlDiceVenue } from './_dicepartners.js';

const SITE = 'https://gold-diggers.com/pages/drink';
const JAZZ_RE = /\bjazz|be-?bop|hard bop|improvis|quartet|quintet|trio|big band|fusion\b/i;

export function parse(jsonText) {
  return parseDiceEvents(jsonText, 'golddiggers', { fallbackUrl: SITE, jazzRe: JAZZ_RE });
}

export async function crawl() {
  return crawlDiceVenue({
    clubId: 'golddiggers',
    keyPage: SITE,
    venueFilter: 'Gold-Diggers',
    fallbackUrl: SITE,
    jazzRe: JAZZ_RE,
  });
}
