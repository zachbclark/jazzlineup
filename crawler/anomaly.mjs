// Silent-rot detector. Hard failures (module throws, 0 events) already feed
// the CloudWatch drift alarm — this catches the venue that still "works"
// while quietly shrinking: a markup change that halves the calendar (the
// Vanguard U+2011 week, which no alarm ever saw), or a detail page that
// stops yielding personnel. Pure and fixture-tested; lambda.mjs wires it to
// S3 state (crawl-stats.json) and one SNS digest email.
//
// Design rules: judge FRESH clubs only, require CONFIRM consecutive
// anomalous crawls (~8h) before alerting, one digest line per club per day,
// high-water baselines decay slowly so legitimate seasonal shrink stops
// alerting on its own. One email listing everything — never a per-venue
// alarm storm.
//
// State shape: { clubs: { [clubId]: {
//   hi,       // high-water event count, decays DECAY per observation
//   persHi,   // high-water personnel coverage (0..1), same decay
//   streak,   // consecutive anomalous crawls
//   alerted,  // ISO date this club last made the digest
// } } }

const DECAY = 0.97;   // baselines forget ~3% per crawl (6 crawls/day)
const DROP = 0.4;     // event count below 40% of high-water = anomalous
const MIN_BASE = 5;   // venues this small are too noisy to judge
const CONFIRM = 2;    // consecutive anomalous crawls before the digest

export function venueStats(events, todayIso) {
  const by = new Map();
  for (const e of events) {
    const s = by.get(e.clubId) ?? { count: 0, future: 0, withPers: 0 };
    s.count++;
    if (e.date > todayIso) s.future++;
    if (e.personnel?.length) s.withPers++;
    by.set(e.clubId, s);
  }
  return by;
}

export function detectAnomalies({ stats, freshClubIds, emptyOkIds = new Set(), prev = {}, todayIso }) {
  const clubs = { ...(prev.clubs ?? {}) };
  const alerts = [];
  for (const clubId of freshClubIds) {
    const s = stats.get(clubId) ?? { count: 0, future: 0, withPers: 0 };
    const persPct = s.count ? s.withPers / s.count : 0;
    const p = clubs[clubId] ?? { hi: 0, persHi: 0, streak: 0, alerted: null };
    const reasons = [];
    if (!emptyOkIds.has(clubId) && p.hi >= MIN_BASE) {
      if (s.count < p.hi * DROP) reasons.push(`events ${s.count} vs usual ~${Math.round(p.hi)}`);
      if (s.future === 0) reasons.push('no future events');
    }
    if (s.count >= MIN_BASE && p.persHi >= 0.3 && persPct < p.persHi / 2) {
      reasons.push(`personnel ${Math.round(persPct * 100)}% vs usual ~${Math.round(p.persHi * 100)}%`);
    }
    const next = {
      hi: Math.max(p.hi * DECAY, s.count),
      persHi: Math.max(p.persHi * DECAY, persPct),
      streak: reasons.length ? p.streak + 1 : 0,
      alerted: p.alerted,
    };
    if (reasons.length && next.streak >= CONFIRM && p.alerted !== todayIso) {
      alerts.push({ clubId, reasons });
      next.alerted = todayIso;
    }
    clubs[clubId] = next;
  }
  return { state: { clubs }, alerts };
}
