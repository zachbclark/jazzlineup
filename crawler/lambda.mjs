// AWS Lambda entry point. Crawls every city and writes events-<city>.json to
// S3 (plus events.json as a legacy alias of NYC). Deployed by the CDK stack
// with BUCKET set in the environment.
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { runCrawl, buildOutput, cities } from './run.js';

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

export const handler = async () => {
  const summary = {};
  for (const city of cities()) {
    const key = `events-${city}.json`;
    const previous = (await readJson(key)) ?? (city === 'nyc' ? await readJson('events.json') : null);
    const previousEvents = previous?.events ?? [];

    const result = await runCrawl({ previousEvents, city });
    for (const line of result.log) console.log(`[${city}] ${line}`);

    const out = buildOutput({ ...result, city });
    await writeJson(key, out);
    if (city === 'nyc') await writeJson('events.json', out); // legacy alias

    summary[city] = {
      events: out.events.length,
      fresh: result.freshCount,
      kept: result.keptCount,
      errors: result.errors,
    };
  }
  console.log(JSON.stringify(summary));
  const errorCount = Object.values(summary).reduce((n, s) => n + s.errors.length, 0);
  if (errorCount) console.error(`crawl completed with ${errorCount} club error(s)`);

  // Per-crawl drift metric: how many club modules came back suspect/failed.
  // The Lambda-level Errors alarm only sees total crashes; this catches one
  // venue silently rotting while everything else stays green. Alarmed in the
  // CDK stack when it stays >= 1 for ~24h; details are in this log group.
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: 'JazzLineup',
      MetricData: [
        { MetricName: 'ProblemClubs', Value: errorCount, Unit: 'Count' },
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
