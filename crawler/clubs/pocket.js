// The Pocket (130 W 46th St) — WordPress with the "simple-events" plugin;
// see _simpleevents.js (shared with Keys Jazz Bistro SF).
import { nyDate } from '../lib.js';
import { parseSimpleEvents, makeSimpleEventsCrawler } from './_simpleevents.js';

const BASE = 'https://thepocketnyc.com';

export function parse(html) {
  return parseSimpleEvents(html, 'pocket');
}

export const crawl = makeSimpleEventsCrawler({ clubId: 'pocket', base: BASE, tzDateFn: nyDate , enrichPersonnel: true });
