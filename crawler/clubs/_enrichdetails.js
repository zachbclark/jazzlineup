// Shared detail-page enrichment — the Smalls pattern, made reusable.
// Personnel (and sometimes details/prices) live on event pages, not
// calendars. This helper: (1) copies previously-learned fields from the
// last crawl by stable event id, (2) fetches detail pages ONLY for events
// still missing them, nearest dates first, capped per crawl. Steady-state
// cost: a handful of fetches for newly announced shows.
// `extract(html)` returns a partial event ({ personnel, details, priceText… });
// only fields the event is missing get filled — never overwrites.
// `alsoFill` fields are filled from a fetched page (and copied from prior) just
// like `fields`, but a missing one does NOT by itself trigger a fetch. Use it
// for bonus data a page carries only sometimes (e.g. a set time or price that
// gets published after the roster) — so a show whose roster arrived first isn't
// refetched forever and doesn't starve genuinely new shows under maxPages.
import { fetchText, sleep } from '../lib.js';

const missing = (v) => v == null || (Array.isArray(v) && v.length === 0);

// A page with no roster yet stays "missing", so it's fetched again every
// crawl. Nearest-first alone let the same few clog the cap forever while
// later shows were never looked at (Sunside: 9 of 131 lineups, New Morning:
// 30 shows never fetched, 2026-11-05). So half the cap still goes to the
// nearest shows and the other half walks the rest of the queue, a different
// slice each 4-hour crawl, until every show has had a look.
export function pickPages(keys, maxPages, now = Date.now()) {
  if (keys.length <= maxPages) return keys;
  const near = Math.ceil(maxPages / 2);
  const rest = keys.slice(near);
  const n = maxPages - near;
  const start = (Math.floor(now / (4 * 3600e3)) * n) % rest.length;
  return [...keys.slice(0, near), ...Array.from({ length: n }, (_, i) => rest[(start + i) % rest.length])];
}

export async function enrichFromDetailPages(events, ctx, {
  fields = ['personnel'],
  alsoFill = [],
  extract,
  maxPages = 25,
  concurrency = 3,
  delayMs = 200,
  fetchImpl = fetchText, // injectable for tests
  // Events that share a page get ONE fetch. Default: the full URL. Django
  // overrides to strip ?selected_date so a residency's dates dedupe.
  urlKey = (url) => url,
  now = Date.now(), // injectable for tests: picks this crawl's slice
} = {}) {
  const fillFields = [...fields, ...alsoFill];
  const prior = new Map((ctx?.previousEvents ?? []).map((e) => [e.id, e]));
  for (const e of events) {
    const p = prior.get(e.id);
    if (!p) continue;
    for (const f of fillFields) {
      if (missing(e[f]) && !missing(p[f])) e[f] = p[f];
    }
  }

  const needs = (e) => fields.some((f) => missing(e[f]));
  const urls = [...new Set(
    events.filter((e) => needs(e) && e.url)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => e.url)
  )];
  const keys = pickPages([...new Set(urls.map(urlKey))], maxPages, now);
  const fetchUrlByKey = new Map();
  for (const u of urls) {
    const k = urlKey(u);
    if (!fetchUrlByKey.has(k)) fetchUrlByKey.set(k, u);
  }

  const byKey = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < keys.length) {
      const key = keys[i++];
      try {
        const got = extract(await fetchImpl(fetchUrlByKey.get(key)));
        if (got) byKey.set(key, got);
      } catch { /* a broken detail page never fails the venue */ }
      await sleep(delayMs);
    }
  }));

  for (const e of events) {
    const got = e.url && byKey.get(urlKey(e.url));
    if (!got) continue;
    for (const f of fillFields) {
      if (missing(e[f]) && !missing(got[f])) e[f] = got[f];
    }
  }
  return events;
}
