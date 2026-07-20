// Fetch the live site's public feeds into data/ for local dev, UI tests,
// and audit scripts. The repo does not track data files (since 2026-07-20):
// prod S3 is the source of truth, refreshed by the crawler Lambda every 4h,
// so a pull is always at most 4 hours stale. Local crawls overwrite these
// freely; git never notices either way.
//   npm run data:pull
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUBS } from '../crawler/clubs.js';

const BASE = process.env.JL_FEED_BASE ?? 'https://jazzlineup.com';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const cities = [...new Set(CLUBS.map((c) => c.city))];

await mkdir(DATA, { recursive: true });
for (const city of cities) {
  const url = `${BASE}/events-${city}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const body = await res.text();
  const parsed = JSON.parse(body); // fail loudly on a cached HTML fallback
  await writeFile(join(DATA, `events-${city}.json`), body);
  if (city === 'nyc') await writeFile(join(DATA, 'events.json'), body); // legacy alias
  console.log(`events-${city}.json  ${parsed.events?.length ?? 0} events`);
}
console.log(`\npulled ${cities.length} cities from ${BASE}`);
