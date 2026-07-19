// Core crawl-and-merge logic, shared by the CLI (index.js) and the AWS
// Lambda handler (lambda.mjs). Pure function of (previousEvents) -> output;
// no filesystem or network beyond the club crawlers themselves.
import { CLUBS } from './clubs.js';

export async function runCrawl({ previousEvents = [], clubIds = null, city = null } = {}) {
  // targetIds stays CITY-WIDE even when --club narrows the crawl: the merge
  // uses it to decide which previous events survive, and narrowing it made
  // `--club X` erase every OTHER club's events from the city file
  // (bit us 2026-07-16: `--club newmorning` wiped events-par.json to zero).
  const cityClubs = city ? CLUBS.filter((c) => c.city === city) : CLUBS;
  const crawlTargets = clubIds ? cityClubs.filter((c) => clubIds.includes(c.id)) : cityClubs;
  if (crawlTargets.length === 0) {
    throw new Error(`no clubs matched (city=${city}, ids=${clubIds}); known: ${CLUBS.map((c) => c.id).join(', ')}`);
  }

  // Modules can be shared by clubs (Smalls + Mezzrow) — crawl each once.
  const modules = [...new Set(crawlTargets.map((c) => c.module))];
  const targetIds = new Set(cityClubs.map((c) => c.id));

  // Seasonal venues (92NY: Jazz in July) legitimately go dark between
  // series — their registry entries carry emptyOk, and 0 events is then a
  // clean result, not a suspect one. A shared module is emptyOk only if
  // EVERY club it serves says so.
  const byModule = new Map();
  for (const c of crawlTargets) byModule.set(c.module, [...(byModule.get(c.module) ?? []), c]);
  const emptyOkMods = new Set(
    [...byModule.entries()].filter(([, cs]) => cs.every((c) => c.emptyOk)).map(([m]) => m)
  );

  const results = await Promise.allSettled(
    modules.map(async (mod) => {
      const { crawl } = await import(mod);
      // ctx lets crawlers reuse expensive prior work (e.g. Smalls copies
      // band personnel from the previous crawl instead of re-fetching
      // hundreds of event pages every 4 hours)
      return { mod, events: await crawl({ previousEvents }) };
    })
  );

  return mergeCrawlResults(results, { previousEvents, targetIds, emptyOkMods });
}

// Pure merge of settled crawl results — separated from runCrawl so the
// failure-isolation rules are unit-testable without any network:
//  - a module returning 0 events is SUSPECT: its previous data is kept
//  - a rejected module keeps its previous data
//  - fresh events replace previous ones for successfully-crawled clubs
//  - de-dupe by id, sort by date then first set time
export function mergeCrawlResults(results, { previousEvents = [], targetIds, emptyOkMods = new Set() }) {
  const fresh = [];
  const crawledClubIds = new Set();
  const errors = [];
  const log = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const events = r.value.events.filter((e) => targetIds.has(e.clubId));
      if (events.length === 0) {
        if (emptyOkMods.has(r.value.mod)) {
          log.push(`ok   ${r.value.mod}: 0 events (seasonal venue, off-season)`);
          continue;
        }
        errors.push(`${r.value.mod}: returned 0 events (markup change? keeping previous data)`);
        log.push(`SUSPECT ${r.value.mod}: 0 events — keeping previous data`);
        continue;
      }
      for (const e of events) crawledClubIds.add(e.clubId);
      fresh.push(...events);
      log.push(`ok   ${r.value.mod}: ${events.length} events`);
    } else {
      errors.push(String(r.reason?.message ?? r.reason));
      log.push(`FAIL ${r.reason?.message ?? r.reason}`);
    }
  }

  // Keep previous data only for clubs we targeted but failed to refresh.
  // The targetIds guard also stops foreign-city events from leaking through
  // a wrong previous file (bit us 2026-07-15: NYC events in events-la.json).
  const kept = previousEvents.filter((e) => targetIds.has(e.clubId) && !crawledClubIds.has(e.clubId));

  const byId = new Map();
  for (const e of [...kept, ...fresh]) byId.set(e.id, e);
  // Late-night events (attributed to the previous evening) sort after
  // everything else that night: treat 12:45am as hour 24:45.
  const sortTime = (e) => {
    const t = e.sets?.[0] ?? '99';
    // only SHIFTED late events (after-midnight starts) roll past 24h;
    // an 11:30pm late-tagged show sorts at its natural position.
    if (!e.late || t >= '05:00') return t;
    const [h, m] = t.split(':').map(Number);
    return `${h + 24}:${String(m ?? 0).padStart(2, '0')}`;
  };
  const events = [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || sortTime(a).localeCompare(sortTime(b))
  );

  return { events, errors, log, freshCount: fresh.length, keptCount: kept.length };
}

export function buildOutput({ events, errors, city = null }) {
  const clubs = (city ? CLUBS.filter((c) => c.city === city) : CLUBS).map(({ module, ...pub }) => pub);
  return {
    generatedAt: new Date().toISOString(),
    city,
    clubs,
    errors,
    events,
  };
}

// Distinct city ids present in the registry, e.g. ['nyc', 'la'].
export function cities() {
  return [...new Set(CLUBS.map((c) => c.city))];
}
