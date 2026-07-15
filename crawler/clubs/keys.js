// Keys Jazz Bistro (498 Broadway, North Beach) — Simon Rowe's supper-club
// revival of the old Broadway jazz corridor. WordPress with the same
// "simple-events" plugin as The Pocket NYC; see _simpleevents.js.
// All jazz — no filter.
import { laDate } from '../lib.js';
import { parseSimpleEvents, makeSimpleEventsCrawler } from './_simpleevents.js';

const BASE = 'https://keysjazzbistro.com';

export function parse(html) {
  return parseSimpleEvents(html, 'keys');
}

export const crawl = makeSimpleEventsCrawler({ clubId: 'keys', base: BASE, tzDateFn: laDate });
