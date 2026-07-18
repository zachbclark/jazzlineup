// The Spotted Cat Music Club (623 Frenchmen St) — trad, swing, and small
// combos from 2pm to 2am daily; the locals' pick on Frenchmen. Squarespace
// shell over Bill's Gigulator (site 1052) — see _gigulator.js.
import { parseGigulator, makeGigulatorCrawler } from './_gigulator.js';

const SITE_URL = 'https://www.spottedcatmusicclub.com/calendar';

export function parse(html, today) {
  return parseGigulator(html, 'spottedcat', SITE_URL, today);
}

export const crawl = makeGigulatorCrawler({ clubId: 'spottedcat', site: 1052, siteUrl: SITE_URL });
