// Personnel coverage audit — where are the programs missing?
//   node scripts/personnel-audit.mjs
// Reads the local data files and reports, per venue: how many upcoming
// events carry personnel, details, and set times. Sorted worst-first so
// the next enrichment target is always the top row. Generators and seeds
// that structurally can't have rosters are marked so they don't nag.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// venues whose source can never yield rosters (pure generators / seeds
// without descriptions) — reported, but flagged instead of counted as gaps
const STRUCTURAL = new Set([
  'marjorie', 'billsplace', 'arthurs', 'birdbeckett', 'caveau', 'ronnies', 'jazzcafe',
  // Boston (NOTES): generators/seeds with no published rosters
  'wallys', 'beehive', 'regattabar', 'scullers',
  // verified 2026-07-18 recon: no roster anywhere on the venue's site
  'bluenote', 'bluenotela', // detail pages are ticketing boilerplate; lineups only ever in titles
  'birdland',  // detail pages are prose bios, no structured roster
  'cellardog', // month API excerpts are empty; titles are "Leader Trio"
  'nublu',     // listing is act names only; no detail pages
  'yoshis',    // detail pages are promo prose (touring acts)
  'club606',   // detail pages are bios; night's band never published
  'andys',     // detail pages are bios only
  'harvelles', // client-rendered event pages; rotating house revues
  'vibrato',   // squarespace prose descriptions, no rosters
  'schlot',    // event pages are a client-rendered shell
  // generators by design (no published rosters to crawl)
  'preservationhall', 'fritzels', 'introtok',
]);

const today = new Date().toISOString().slice(0, 10);
const rows = [];

for (const file of (await readdir(DATA_DIR)).filter((f) => /^events-[a-z]+\.json$/.test(f))) {
  let data;
  try { data = JSON.parse(await readFile(join(DATA_DIR, file), 'utf8')); } catch { continue; }
  const city = data.city ?? file.replace(/^events-|\.json$/g, '');
  const byClub = new Map();
  for (const e of data.events) {
    if (e.date < today) continue;
    if (!byClub.has(e.clubId)) byClub.set(e.clubId, { total: 0, personnel: 0, details: 0, sets: 0 });
    const c = byClub.get(e.clubId);
    c.total++;
    if (e.personnel?.length) c.personnel++;
    if (e.details) c.details++;
    if (e.sets?.length) c.sets++;
  }
  const names = Object.fromEntries((data.clubs ?? []).map((c) => [c.id, c.shortName ?? c.name]));
  for (const [clubId, c] of byClub) {
    rows.push({ city, clubId, name: names[clubId] ?? clubId, ...c });
  }
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
rows.sort((a, b) => pct(a.personnel, a.total) - pct(b.personnel, b.total) || b.total - a.total);

console.log('venue'.padEnd(22), 'city'.padEnd(5), 'events', 'pers%', 'det%', 'sets%', '');
console.log('-'.repeat(64));
let gaps = 0;
for (const r of rows) {
  const p = pct(r.personnel, r.total);
  const flag = STRUCTURAL.has(r.clubId) ? ' (structural)' : (p < 30 && r.total >= 5 ? '  <-- gap' : '');
  if (flag.includes('gap')) gaps++;
  console.log(
    r.name.slice(0, 21).padEnd(22), r.city.padEnd(5),
    String(r.total).padStart(6), String(p).padStart(5),
    String(pct(r.details, r.total)).padStart(4), String(pct(r.sets, r.total)).padStart(5), flag,
  );
}
const totals = rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.personnel }), { t: 0, p: 0 });
console.log('-'.repeat(64));
console.log(`overall: ${totals.p}/${totals.t} upcoming events carry personnel (${pct(totals.p, totals.t)}%) — ${gaps} enrichable gap(s) flagged`);
