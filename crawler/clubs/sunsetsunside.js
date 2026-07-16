// Sunset / Sunside (60 rue des Lombards, Châtelet) — two rooms, one house,
// since 1983: Sunset is the electric basement, Sunside the acoustic ground
// floor. WordPress with The Events Calendar REST API (see _tribe.js); each
// event's venue field names its room, so one crawl serves both clubIds.
// All jazz — no filter.
import { parseTribe, makeTribeCrawler } from './_tribe.js';

const BASE = 'https://www.sunset-sunside.com';

const ROOM = { sunset: 'sunset', sunside: 'sunside' };
const OPTS = {
  clubIdFor: (ev) => ROOM[String(ev.venue?.venue ?? '').trim().toLowerCase()] ?? null,
  fallbackUrl: `${BASE}/agenda/`,
};

export function parse(jsonText) {
  return parseTribe(jsonText, OPTS);
}

export const crawl = makeTribeCrawler({ base: BASE, ...OPTS, maxPages: 4 });
