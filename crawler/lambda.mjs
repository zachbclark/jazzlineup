// AWS Lambda entry point. Runs the same crawl as `npm run crawl`, but reads
// the previous events.json from S3 and writes the fresh one back.
// Deployed by the CDK stack in infra/ with BUCKET set in the environment.
// The @aws-sdk/client-s3 package is bundled in the Node Lambda runtime.
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { runCrawl, buildOutput } from './run.js';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET;
const KEY = process.env.KEY ?? 'events.json';

export const handler = async () => {
  let previousEvents = [];
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    previousEvents = JSON.parse(await r.Body.transformToString()).events ?? [];
  } catch {
    // first run: no previous file — fine
  }

  const result = await runCrawl({ previousEvents });
  for (const line of result.log) console.log(line);

  const out = buildOutput(result);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify(out),
    ContentType: 'application/json; charset=utf-8',
    // CloudFront honors this: browsers/edge cache the data for 5 minutes.
    CacheControl: 'public, max-age=300',
  }));

  const summary = {
    events: out.events.length,
    fresh: result.freshCount,
    kept: result.keptCount,
    errors: result.errors,
  };
  console.log(JSON.stringify(summary));
  if (result.errors.length) {
    // Surface partial failures in Lambda metrics/logs without failing the
    // whole run (good data was still written).
    console.error(`crawl completed with ${result.errors.length} club error(s)`);
  }
  return summary;
};
