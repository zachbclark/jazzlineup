// Sunset / Sunside (60 rue des Lombards, Châtelet) — two rooms, one house,
// since 1983: Sunset is the electric basement, Sunside the acoustic ground
// floor. WordPress with The Events Calendar REST API (see _tribe.js); each
// event's venue field names its room, so one crawl serves both clubIds.
// All jazz — no filter.
import { parseTribe, makeTribeCrawler } from './_tribe.js';
import { htmlToText, personnelFromLines } from '../lib.js';

const BASE = 'https://www.sunset-sunside.com';

const ROOM = { sunset: 'sunset', sunside: 'sunside' };
const OPTS = {
  clubIdFor: (ev) => ROOM[String(ev.venue?.venue ?? '').trim().toLowerCase()] ?? null,
  fallbackUrl: `${BASE}/agenda/`,
};

export function parse(jsonText) {
  return parseTribe(jsonText, OPTS);
}

// The API description is bio prose, but each /concert/ page opens with a
// clean roster block (discovered 2026-07-18):
//   <div class=artistes><p>Xavier Thollard - piano</p>
//   <p>Yann Phayphet - c.basse<br>Simon Bernier - batterie</p></div>
// NOTE the UNQUOTED class attr — that's what their server sends non-browsers
// (the Blue Note quote-style lesson); accept quoted too. personnelFromLines
// handles the line-per-player shape; 'cbasse' is in the instrument lexicon.
export function parseDetail(html) {
  const m = String(html).match(/<div[^>]*class=["']?artistes["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  const personnel = personnelFromLines(htmlToText(m[1]));
  return personnel.length ? { personnel } : null;
}

// Their tribe endpoint is SLOW (30s+ for per_page=50 — timed out the whole
// module on first live crawl, 2026-07-16): smaller pages, longer leash.
// Detail enrichment gets a TINY page cap for the same reason — 30-50s per
// fetch means a big cap would eat the whole Lambda budget. The backlog fills
// over successive 4h crawls via prior-reuse.
export const crawl = makeTribeCrawler({
  base: BASE, ...OPTS, maxPages: 8, perPage: 20, timeoutMs: 60000,
  enrich: { fields: ['personnel'], extract: parseDetail, maxPages: 5, concurrency: 2 },
});
