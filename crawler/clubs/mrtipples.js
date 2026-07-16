// Mr. Tipple's Recording Studio (39 Fell St, Civic Center) — cocktail den
// with jazz seven nights a week. WordPress with The Events Calendar and the
// tribe REST API enabled; see _tribe.js (shared with Sunset/Sunside Paris).
// All jazz — no filter.
import { parseTribe, makeTribeCrawler } from './_tribe.js';

const BASE = 'https://mrtipplessf.com';
const OPTS = { clubIdFor: () => 'mrtipples', fallbackUrl: `${BASE}/calendar/` };

export function parse(jsonText) {
  return parseTribe(jsonText, OPTS);
}

export const crawl = makeTribeCrawler({ base: BASE, ...OPTS });
