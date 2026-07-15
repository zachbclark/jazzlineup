// CLI crawler: node crawler/index.js [--city <id>|all] [--club <id>] [--out-dir <path>]
// Crawls each city's clubs and writes data/events-<city>.json per city
// (plus data/events.json as a legacy alias of the NYC file).
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCrawl, buildOutput, cities } from './run.js';
import { CLUBS } from './clubs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = join(__dirname, '..', 'data');

function parseArgs(argv) {
  const args = { city: 'all', club: null, outDir: DEFAULT_DIR };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--city') args.city = argv[++i];
    else if (argv[i] === '--club') args.club = argv[++i];
    else if (argv[i] === '--out-dir') args.outDir = argv[++i];
  }
  return args;
}

async function crawlCity(city, args) {
  const outPath = join(args.outDir, `events-${city}.json`);
  let previousEvents = [];
  try {
    previousEvents = JSON.parse(await readFile(outPath, 'utf8')).events ?? [];
  } catch {
    // first per-city run: the legacy single file is NYC data — only NYC may
    // fall back to it (other cities would inherit a foreign city's events)
    if (city === 'nyc') {
      try {
        previousEvents = JSON.parse(await readFile(join(args.outDir, 'events.json'), 'utf8')).events ?? [];
      } catch { /* truly first run */ }
    }
  }

  const result = await runCrawl({
    previousEvents,
    city,
    clubIds: args.club ? [args.club] : null,
  });
  for (const line of result.log) console.log(`[${city}] ${line}`);

  const out = buildOutput({ ...result, city });
  await mkdir(args.outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2));
  if (city === 'nyc') {
    await writeFile(join(args.outDir, 'events.json'), JSON.stringify(out, null, 2)); // legacy alias
  }
  console.log(`[${city}] wrote ${out.events.length} events (${result.freshCount} fresh, ${result.keptCount} kept) -> ${outPath}`);
  return result.errors.length;
}

async function main() {
  const args = parseArgs(process.argv);
  let targets = args.city === 'all' ? cities() : [args.city];
  // --club: only crawl cities where that club actually lives, instead of
  // throwing when the loop reaches a city without it.
  if (args.club) {
    targets = targets.filter((city) => CLUBS.some((c) => c.city === city && c.id === args.club));
    if (targets.length === 0) {
      console.error(`unknown club id "${args.club}"; known: ${CLUBS.map((c) => c.id).join(', ')}`);
      process.exitCode = 1;
      return;
    }
  }
  let errorCount = 0;
  for (const city of targets) {
    errorCount += await crawlCity(city, args);
  }
  if (errorCount) process.exitCode = 2;
}

main();
