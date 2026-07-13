// Crawler runner: node crawler/index.js [--club <id>] [--out <path>]
// Crawls every club (or one), merges + sorts events, writes data/events.json.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUBS } from './clubs.js';

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
  const targets = args.club ? CLUBS.filter((c) => c.id === args.club) : CLUBS;
  if (targets.length === 0) {
    console.error(`Unknown club id "${args.club}". Known: ${CLUBS.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  // Load previous output so one broken scraper doesn't wipe good data.
  let previous = [];
  try {
    previous = JSON.parse(await readFile(args.out, 'utf8')).events ?? [];
  } catch { /* first run */ }

  // Modules are shared by some clubs (e.g. Smalls + Mezzrow) — crawl each module once.
  const modules = [...new Set(targets.map((c) => c.module))];
  const targetIds = new Set(targets.map((c) => c.id));

  const results = await Promise.allSettled(
    modules.map(async (mod) => {
      const { crawl } = await import(mod);
      const events = await crawl();
      return { mod, events };
    })
  );

  const fresh = [];
  const crawledClubIds = new Set();
  const errors = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const events = r.value.events.filter((e) => targetIds.has(e.clubId));
      for (const e of events) crawledClubIds.add(e.clubId);
      fresh.push(...events);
      console.log(`ok   ${r.value.mod}: ${events.length} events`);
    } else {
      errors.push(String(r.reason?.message ?? r.reason));
      console.error(`FAIL ${r.reason?.message ?? r.reason}`);
    }
  }

  // Keep previous events for clubs that failed this run (or weren't targeted).
  const kept = previous.filter((e) => !crawledClubIds.has(e.clubId));
  const all = [...kept, ...fresh];

  // De-dupe by id, sort by date then first set time.
  const byId = new Map();
  for (const e of all) byId.set(e.id, e);
  const events = [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.sets[0] ?? '99').localeCompare(b.sets[0] ?? '99')
  );

  const out = {
    generatedAt: new Date().toISOString(),
    clubs: CLUBS.map(({ module, ...pub }) => pub),
    errors,
    events,
  };
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${events.length} events (${fresh.length} fresh, ${kept.length} kept) -> ${args.out}`);
  if (errors.length) process.exitCode = 2;
}

main();
