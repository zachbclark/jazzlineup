// AWS Lambda entry point. Crawls every city and writes events-<city>.json to
// S3 (plus events.json as a legacy alias of NYC). Deployed by the CDK stack
// with BUCKET set in the environment.
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { runCrawl, buildOutput, cities } from './run.js';
import { venueStats, detectAnomalies } from './anomaly.mjs';
import { CLUBS } from './clubs.js';

const s3 = new S3Client({});
const cw = new CloudWatchClient({});
const sns = new SNSClient({});
const BUCKET = process.env.BUCKET;
const ALERTS_TOPIC = process.env.ALERTS_TOPIC_ARN;

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
  let anomalyState = (await readJson('crawl-stats.json')) ?? {};
  const digest = [];
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
    }

    // judge only clubs that refreshed this run — kept clubs are hard
    // failures and the drift alarm's problem; never fail the crawl for this
    try {
      const { state, alerts } = detectAnomalies({
        stats: venueStats(out.events, todayIso),
        freshClubIds: result.crawledClubIds ?? [],
        emptyOkIds, prev: anomalyState, todayIso,
      });
      anomalyState = state;
      digest.push(...alerts.map((a) => `[${city}] ${a.clubId}: ${a.reasons.join('; ')}`));
    } catch (err) {
      console.error(`[${city}] anomaly detection failed (crawl unaffected):`, err.message);
    }

    summary[city] = {
      events: out.events.length,
      fresh: result.freshCount,
      kept: result.keptCount,
      errors: result.errors,
    };
  }

  try {
    await writeJson('crawl-stats.json', anomalyState);
    if (digest.length && ALERTS_TOPIC) {
      await sns.send(new PublishCommand({
        TopicArn: ALERTS_TOPIC,
        Subject: `Jazz Lineup crawler: ${digest.length} venue(s) look wrong`,
        Message: `Silent-rot digest for ${todayIso} (each venue anomalous for 2+ consecutive crawls; one line per club per day):\n\n`
          + digest.join('\n')
          + `\n\nHard failures (module crashes, 0 events) alarm separately via the CloudWatch drift metric. Parsing runbook: NOTES.md crawler sections.`,
      }));
      console.log(`anomaly digest sent: ${digest.length} venue(s)`);
    }
  } catch (err) {
    console.error('anomaly state/digest write failed (crawl succeeded):', err.message);
  }
  console.log(JSON.stringify(summary));
  const errorCount = Object.values(summary).reduce((n, s) => n + s.errors.length, 0);
  if (errorCount) console.error(`crawl completed with ${errorCount} club error(s)`);

  // Per-crawl drift metric: how many club modules came back suspect/failed.
  // The Lambda-level Errors alarm only sees total crashes; this catches one
  // venue silently rotting while everything else stays green. Alarmed in the
  // CDK stack when it stays >= 1 for ~24h; details are in this log group.
  // On a PARTIAL run the aggregate metric is skipped: emitting 0 for a subset
  // would reset the ~24h alarm clock and mask a rotting venue in a city the
  // run never touched. Per-city dimensions are always safe to emit.
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
