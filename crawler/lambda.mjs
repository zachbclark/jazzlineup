// AWS Lambda entry point. Crawls every city and writes events-<city>.json to
// S3 (plus events.json as a legacy alias of NYC). Deployed by the CDK stack
// with BUCKET set in the environment.
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { runCrawl, buildOutput, cities } from './run.js';
import { venueStats, detectAnomalies, detectDead } from './anomaly.mjs';
import { venueEmail, shrinkEmail } from './alert-text.mjs';
import { publishAlert } from './notify.mjs';
import { CLUBS } from './clubs.js';

const s3 = new S3Client({});
const cw = new CloudWatchClient({});
const BUCKET = process.env.BUCKET;

async function readJson(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return JSON.parse(await r.Body.transformToString());
  } catch { return null; }
}

async function writeJson(key, body) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(body),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'public, max-age=300',
  }));
}

// Urgent alerts: dead venues, recoveries, archive write failures. One
// message per crawl on the alerts topic (email today, SMS once Zach's
// toll-free number is approved; NOTES.md, ALERTS). Never fails the crawl.
// true if sent; the caller skips saving "already alerted" state on false,
// so the next crawl tries the email again
async function sendUrgent(email) {
  if (!process.env.ALERTS_TOPIC_ARN) return true; // local run: nothing to send to
  try {
    await publishAlert(email);
    console.log(`urgent alert sent: ${email.subject}`);
    return true;
  } catch (err) {
    console.error('alert email failed (crawl unaffected):', err.message);
    return false;
  }
}

const CLUB_BY_ID = new Map(CLUBS.map((c) => [c.id, c]));
const MODULE_VENUES = new Map();
for (const c of CLUBS) MODULE_VENUES.set(c.module, (MODULE_VENUES.get(c.module) ?? 0) + 1);
const venue = (clubId) => {
  const club = CLUB_BY_ID.get(clubId);
  return { club, name: club?.name ?? clubId, url: club?.url };
};

// detectDead alert -> a venueEmail item (name, site, the module's error;
// shared = its crawler also covers other venues, like Smalls + Mezzrow)
function deadItem(city, a, errors) {
  const { club, name, url } = venue(a.clubId);
  const error = club ? errors.find((e) => e.startsWith(`${club.module}:`)) : undefined;
  const shared = !!club && MODULE_VENUES.get(club.module) > 1;
  return { kind: a.kind, city, name, url, since: a.since, streak: a.streak, error, shared };
}

// The event payload may narrow the crawl: {"city":"par"} or
// {"city":["par","ber"]} crawls just those cities (manual targeted refresh
// after adding or fixing a venue). No payload = full crawl (the 4h schedule
// sends none). Unknown ids fail loudly — a typo must not silently crawl
// nothing and report success.
// Overlap guard: five eager manual invokes must mean ONE crawl, not five.
// A start-marker in S3 acts as a short lock; runs that arrive while a
// recent crawl is underway (or just finished) exit immediately. The 4h
// schedule is far outside the window, so it never skips. Belt to the
// braces of the Lambda's reservedConcurrentExecutions: 1 (stack.js) —
// concurrency stops parallel runs, the lock stops queued-up reruns.
const LOCK_KEY = 'crawl-lock.json';
const LOCK_WINDOW_MS = 10 * 60 * 1000;

export const handler = async (event) => {
  // {"testAlert":true}: prove the alert path end to end, no crawl
  if (event?.testAlert) {
    await sendUrgent({ subject: 'Jazz Lineup: test alert', message: 'If you can read this, crawler alerts reach you. Nothing to do.' });
    return { testAlert: true };
  }

  const lock = await readJson(LOCK_KEY);
  const now = Date.now();
  if (lock?.startedAt && now - lock.startedAt < LOCK_WINDOW_MS && !event?.force) {
    const ageMin = Math.round((now - lock.startedAt) / 60000);
    console.log(`skip: a crawl started ${ageMin} min ago (pass {"force":true} to override)`);
    return { skipped: true, reason: `crawl started ${ageMin} min ago` };
  }
  await writeJson(LOCK_KEY, { startedAt: now });

  const requested = event?.city ? [event.city].flat() : null;
  if (requested) {
    const unknown = requested.filter((c) => !cities().includes(c));
    if (unknown.length) {
      throw new Error(`unknown city id(s): ${unknown.join(', ')} (valid: ${cities().join(' ')})`);
    }
  }
  const targets = requested ?? cities();

  const summary = {};
  // silent-rot detection: per-venue baselines persist in crawl-stats.json,
  // anomalies collect into ONE digest email at the end (see anomaly.mjs)
  const savedState = (await readJson('crawl-stats.json')) ?? {};
  let anomalyState = savedState;
  const digest = [];
  const urgent = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const emptyOkIds = new Set(CLUBS.filter((c) => c.emptyOk).map((c) => c.id));
  for (const city of targets) {
    const key = `events-${city}.json`;
    const previous = (await readJson(key)) ?? (city === 'nyc' ? await readJson('events.json') : null);
    const previousEvents = previous?.events ?? [];

    const result = await runCrawl({ previousEvents, city });
    for (const line of result.log) console.log(`[${city}] ${line}`);

    const out = buildOutput({ ...result, city });
    await writeJson(key, out);
    if (city === 'nyc') await writeJson('events.json', out); // legacy alias

    // Historical archive (PARAMOUNT — Zach, 2026-07-20): the live key is
    // overwritten every crawl and trims past events, so every crawl also
    // lands on a dated key: archive/<city>/<UTC date>.json. Later runs the
    // same day overwrite it — the day's last snapshot wins. ~250KB x 10
    // cities x 365 days is under 1GB/yr; query it later with DuckDB/Athena
    // straight off S3. An archive failure never fails the crawl: the live
    // site write above already succeeded.
    try {
      await writeJson(`archive/${city}/${new Date().toISOString().slice(0, 10)}.json`, out);
    } catch (err) {
      console.error(`[${city}] archive write failed (live write succeeded):`, err.message);
      urgent.push({ kind: 'archive', city, error: err.message });
    }

    // dead venues: no fresh shows for 2+ crawls (the merge hides it by
    // keeping their old shows). State rides in crawl-stats.json under `dead`.
    try {
      const { state: dead, alerts } = detectDead({
        clubIds: CLUBS.filter((c) => c.city === city).map((c) => c.id),
        freshClubIds: result.crawledClubIds ?? [],
        emptyOkIds, prev: anomalyState.dead ?? {}, now: new Date().toISOString(),
      });
      anomalyState = { ...anomalyState, dead };
      for (const a of alerts) urgent.push(deadItem(city, a, result.errors));
    } catch (err) {
      // the check itself broke: say so, or venue problems go quiet
      console.error(`[${city}] dead-venue check failed (crawl unaffected):`, err.message);
      urgent.push({ kind: 'check', check: 'dead', city, error: err.message });
    }

    // judge only clubs that refreshed this run (kept clubs are the
    // dead-venue check's job); never fail the crawl for this
    try {
      const { state, alerts } = detectAnomalies({
        stats: venueStats(out.events, todayIso),
        freshClubIds: result.crawledClubIds ?? [],
        emptyOkIds, prev: anomalyState, todayIso,
      });
      anomalyState = { ...anomalyState, ...state }; // keep the `dead` key
      for (const a of alerts) {
        const { name, url } = venue(a.clubId);
        digest.push({ city, name, url, reasons: a.reasons });
      }
    } catch (err) {
      console.error(`[${city}] anomaly detection failed (crawl unaffected):`, err.message);
      urgent.push({ kind: 'check', check: 'shrink', city, error: err.message });
    }

    summary[city] = {
      events: out.events.length,
      fresh: result.freshCount,
      kept: result.keptCount,
      errors: result.errors,
    };
  }

  // Send first, then save state. The state records "already alerted today",
  // so if an email failed, put back that email's part of the previous state
  // (dead -> the urgent email, clubs -> the digest): the next crawl
  // recomputes those alerts and tries again, and the other email isn't resent.
  if (urgent.length && !(await sendUrgent(venueEmail(urgent)))) {
    anomalyState = { ...anomalyState, dead: savedState.dead ?? {} };
  }
  if (digest.length && !(await sendUrgent(shrinkEmail(digest)))) {
    anomalyState = { ...anomalyState, clubs: savedState.clubs ?? {} };
  }
  try {
    await writeJson('crawl-stats.json', anomalyState);
  } catch (err) {
    console.error('crawl-stats write failed (crawl succeeded):', err.message);
  }
  console.log(JSON.stringify(summary));
  const errorCount = Object.values(summary).reduce((n, s) => n + s.errors.length, 0);
  if (errorCount) console.error(`crawl completed with ${errorCount} club error(s)`);

  // Per-crawl count of failing club modules, charted on the dashboard (its
  // ClubDrift alarm was dropped 2026-11-03; the dead-venue email names the
  // venue). On a PARTIAL run the city-wide total is skipped, since a subset
  // would chart a misleadingly low number. Per-city counts are always right.
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: 'JazzLineup',
      MetricData: [
        ...(requested ? [] : [{ MetricName: 'ProblemClubs', Value: errorCount, Unit: 'Count' }]),
        ...Object.entries(summary).map(([city, s]) => ({
          MetricName: 'ProblemClubs',
          Dimensions: [{ Name: 'City', Value: city }],
          Value: s.errors.length,
          Unit: 'Count',
        })),
      ],
    }));
  } catch (err) {
    console.error('metric emit failed (crawl itself succeeded):', err.message);
  }
  return summary;
};
