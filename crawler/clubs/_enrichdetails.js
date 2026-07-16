// Shared detail-page enrichment — the Smalls pattern, made reusable.
// Personnel (and sometimes details/prices) live on event pages, not
// calendars. This helper: (1) copies previously-learned fields from the
// last crawl by stable event id, (2) fetches detail pages ONLY for events
// still missing them, nearest dates first, capped per crawl. Steady-state
// cost: a handful of fetches for newly announced shows.
// `extract(html)` returns a partial event ({ personnel, details, priceText… });
// only fields the event is missing get filled — never overwrites.
import { fetchText, sleep } from '../lib.js';

const missing = (v) => v == null || (Array.isArray(v) && v.length === 0);

export async function enrichFromDetailPages(events, ctx, {
  fields = ['personnel'],
  extract,
  maxPages = 25,
  concurrency = 3,
  delayMs = 200,
  fetchImpl = fetchText, // injectable for tests
} = {}) {
  const prior = new Map((ctx?.previousEvents ?? []).map((e) => [e.id, e]));
  for (const e of events) {
    const p = prior.get(e.id);
    if (!p) continue;
    for (const f of fields) {
      if (missing(e[f]) && !missing(p[f])) e[f] = p[f];
    }
  }

  const needs = (e) => fields.some((f) => missing(e[f]));
  const urls = [...new Set(
    events.filter((e) => needs(e) && e.url)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => e.url)
  )].slice(0, maxPages);

  const byUrl = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        const got = extract(await fetchImpl(url));
        if (got) byUrl.set(url, got);
      } catch { /* a broken detail page never fails the venue */ }
      await sleep(delayMs);
    }
  }));

  for (const e of events) {
    const got = byUrl.get(e.url);
    if (!got) continue;
    for (const f of fields) {
      if (missing(e[f]) && !missing(got[f])) e[f] = got[f];
    }
  }
  return events;
}
