// Smoke Jazz Club — tickets.smokejazz.com runs on Turntable Tickets, which
// exposes a clean JSON API; see _turntable.js (shared with Black Cat SF).
// One record per SET; grouped by (NY date, show) into events with sets[].
import { parseTurntable, makeTurntableCrawler } from './_turntable.js';

const BASE = 'https://tickets.smokejazz.com';
const TZ = 'America/New_York';

export function parse(jsonText) {
  return parseTurntable(jsonText, 'smoke', { base: BASE, tz: TZ });
}

export const crawl = makeTurntableCrawler({ clubId: 'smoke', base: BASE, tz: TZ });
