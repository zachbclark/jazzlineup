// Shared extractor for WordPress sites with The Events Calendar's REST API
// enabled (Mr. Tipple's SF; Sunset/Sunside Paris):
//   GET <base>/wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD
// -> { events: [{ title, start_date 'YYYY-MM-DD HH:MM:SS' (venue-local),
//      url, cost, description, venue: { venue: 'Room name' } … }],
//      next_rest_url }
// `clubIdFor(ev)` maps an event to a clubId (fixed for single-room venues,
// venue-name lookup for multi-room houses) — return null to skip the event.
import {
  fetchText, makeEvent, applyLateNight, htmlToText, stripPromo,
  parsePersonnel, splitIso,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

export function parseTribe(jsonText, { clubIdFor, fallbackUrl }) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    if (!ev?.title || !ev?.start_date) continue;
    const clubId = clubIdFor(ev);
    if (!clubId) continue;
    const { date, time } = splitIso(ev.start_date.replace(' ', 'T'));
    const desc = htmlToText(ev.description ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId,
      title: htmlToText(ev.title),
      date,
      sets: time && time !== '00:00' ? [time] : [],
      url: ev.url ?? fallbackUrl,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
      priceText: ev.cost ? String(ev.cost).replace(/\s*[–—]\s*/g, '-') : null,
    })));
  }
  return events;
}

// Pages beyond the first fetch CONCURRENTLY — sequential paging against a
// slow host (Sunset/Sunside takes 30-50s per request) made a Paris crawl
// run 4+ minutes and threatened the Lambda's time budget. A date window
// also caps how many pages exist at all. Page-2+ failures degrade to
// missing pages instead of failing the venue.
// `enrich` (optional) turns on detail-page enrichment for venues whose event
// pages carry data the API description lacks (Sunset/Sunside rosters): the
// options object is handed to enrichFromDetailPages, and the venue's timeoutMs
// rides along on those fetches too (slow hosts stay slow on detail pages).
export function makeTribeCrawler({ base, clubIdFor, fallbackUrl, maxPages = 3, perPage = 50, timeoutMs = 30000, windowDays = 60, enrich = null }) {
  return async function crawl(ctx = {}) {
    const today = ctx.today ?? new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + windowDays * 86400000).toISOString().slice(0, 10);
    const pageUrl = (p) =>
      `${base}/wp-json/tribe/events/v1/events?per_page=${perPage}&start_date=${start}&end_date=${end}&page=${p}`;
    const first = await fetchText(pageUrl(1), { headers: { accept: 'application/json' }, timeoutMs });
    const out = parseTribe(first, { clubIdFor, fallbackUrl });
    let totalPages = 1;
    try { totalPages = Math.min(Number(JSON.parse(first).total_pages) || 1, maxPages); } catch { /* single page */ }
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) =>
        fetchText(pageUrl(i + 2), { headers: { accept: 'application/json' }, timeoutMs })
          .then((b) => parseTribe(b, { clubIdFor, fallbackUrl }))
          .catch(() => []))
    );
    const events = out.concat(...rest);
    if (enrich) {
      await enrichFromDetailPages(events.filter((e) => e.url !== fallbackUrl), ctx, {
        fetchImpl: (u) => fetchText(u, { timeoutMs }),
        ...enrich,
      });
    }
    return events;
  };
}
