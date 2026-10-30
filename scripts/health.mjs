// Venue health table from the city feeds: crawl errors per city, then every
// venue with fewer than 3 upcoming shows, worst first. Reads data/ by
// default (npm run data:pull first), or any folder of events-<city>.json.
//   node scripts/health.mjs [dir]
import { readFileSync } from 'node:fs';
import { CITIES } from '../web/src/api.js';

const dir = process.argv[2] ?? 'data';
const today = new Date().toISOString().slice(0, 10);
const rows = [];
for (const { id: c } of CITIES) {
  const d = JSON.parse(readFileSync(`${dir}/events-${c}.json`, 'utf8'));
  console.log(`${c}: generated ${d.generatedAt}, ${d.events.length} events, ${d.errors.length} errors`);
  for (const e of d.errors) console.log(`   ERR ${e}`);
  for (const club of d.clubs) {
    const ev = d.events.filter((e) => e.clubId === club.id);
    const up = ev.filter((e) => e.date >= today);
    const last = ev.map((e) => e.date).sort().at(-1) ?? '-';
    rows.push({ c, id: club.id, up: up.length, last, emptyOk: !!club.emptyOk });
  }
}
console.log('\nVenues with fewer than 3 upcoming shows:');
for (const r of rows.filter((r) => r.up < 3).sort((a, b) => a.up - b.up))
  console.log(`  ${r.c.padEnd(4)} ${r.id.padEnd(22)} upcoming ${String(r.up).padStart(3)}  last ${r.last}${r.emptyOk ? '  (seasonal)' : ''}`);
console.log(`\n${rows.length} venues total`);
