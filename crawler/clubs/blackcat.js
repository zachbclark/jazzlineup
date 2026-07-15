// Black Cat (400 Eddy St, Tenderloin) — the room where SF's young scene
// actually plays; supper club upstairs, sweaty basement sessions downstairs.
// Turntable Tickets venue (same platform as Smoke NYC); see _turntable.js.
// All jazz — no filter.
import { parseTurntable, makeTurntableCrawler } from './_turntable.js';

const BASE = 'https://blackcatsf.turntabletickets.com';
const TZ = 'America/Los_Angeles';

export function parse(jsonText) {
  return parseTurntable(jsonText, 'blackcat', { base: BASE, tz: TZ });
}

export const crawl = makeTurntableCrawler({ clubId: 'blackcat', base: BASE, tz: TZ });
