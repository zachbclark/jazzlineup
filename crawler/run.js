// Core crawl-and-merge logic, shared by the CLI (index.js) and the AWS
// Lambda handler (lambda.mjs). Pure function of (previousEvents) -> output;
// no filesystem or network beyond the club crawlers themselves.
import { CLUBS } from './clubs.js';

export async function runCrawl({ previousEvents = [], clubIds = null } = {}) {
  const targets = clubIds ? CLUBS.filter((c) => clubIds.includes(c.id)) : CLUBS;
  if (targets.length === 0) {
    throw new Error(`no clubs matched ${clubIds}; known: ${CLUBS.map((c) => c.id).join(', ')}`);
  }

  // Modules can be shared by clubs (Smalls + Mezzrow) — crawl each once.
  const modules = [...new Set(targets.map((c) => c.module))];
  const targetIds = new Set(targets.map((c) => c.id));

  const results = await Promise.allSettled(
    modules.map(async (mod) => {
      const { crawl } = await import(mod);
      return { mod, events: await crawl() };
    })
  );

  const fresh = [];
  const crawledClubIds = new Set();
  const errors = [];
  const log = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const events = r.value.events.filter((e) => targetIds.has(e.clubId));
      // Sanity check: zero events almost certainly means the site changed its
      // markup, not that the club went dark. Fail loudly, keep previous data.
      if (events.length === 0) {
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

  // Keep previous events for clubs that failed this run (or weren't targeted).
  const kept = previousEvents.filter((e) => !crawledClubIds.has(e.clubId));

  // De-dupe by id, sort by date then first set time.
  const byId = new Map();
  for (const e of [...kept, ...fresh]) byId.set(e.id, e);
  const events = [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.sets[0] ?? '99').localeCompare(b.sets[0] ?? '99')
  );

  return { events, errors, log, freshCount: fresh.length, keptCount: kept.length };
}

export function buildOutput({ events, errors }) {
  return {
    generatedAt: new Date().toISOString(),
    clubs: CLUBS.map(({ module, ...pub }) => pub),
    errors,
    events,
  };
}
