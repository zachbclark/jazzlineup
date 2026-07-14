// CLI crawler: node crawler/index.js [--club <id>] [--out <path>]
// Crawls every club (or one), merges + sorts events, writes data/events.json.
// The actual crawl/merge logic lives in run.js (shared with the Lambda).
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCrawl, buildOutput } from './run.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = join(__dirname, '..', 'data', 'events.json');

function parseArgs(argv) {
  const args = { club: null, out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--club') args.club = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  // Load previous output so one broken scraper doesn't wipe good data.
  let previousEvents = [];
  try {
    previousEvents = JSON.parse(await readFile(args.out, 'utf8')).events ?? [];
  } catch { /* first run */ }

  const result = await runCrawl({
    previousEvents,
    clubIds: args.club ? [args.club] : null,
  });
  for (const line of result.log) console.log(line);

  const out = buildOutput(result);
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${out.events.length} events (${result.freshCount} fresh, ${result.keptCount} kept) -> ${args.out}`);
  if (result.errors.length) process.exitCode = 2;
}

main();
