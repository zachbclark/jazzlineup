// d.b.a. (618 Frenchmen St) — the Frenchmen Street room with the most
// jazz-serious bookings; John Boutte's old home base. Squarespace shell;
// the data lives on Bill's Gigulator (site 1048) — see _gigulator.js.
import { parseGigulator, makeGigulatorCrawler } from './_gigulator.js';

const SITE_URL = 'https://www.dbaneworleans.com/shows';

export function parse(html, today) {
  return parseGigulator(html, 'dbanola', SITE_URL, today);
}

export const crawl = makeGigulatorCrawler({ clubId: 'dbanola', site: 1048, siteUrl: SITE_URL });
