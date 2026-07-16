// Recall audit — are we missing shows our venues actually have?
//   node scripts/recall-audit.mjs
// For each mixed-genre venue with a Songkick page, pull Songkick's listing
// (their pages embed MusicEvent JSON-LD), diff against our data files, and
// report anything they list that we don't. Run from your machine (Songkick
// is bot-choosy; a residential IP + browser UA behaves). Findings are
// candidates, not verdicts — a miss can be a legitimately non-jazz booking.
// Born 2026-07-16: a Songkick email knew about Bill Frisell at Zebulon
// before our calendar did.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// clubId -> Songkick venue calendar. Add entries as venues earn suspicion.
const VENUES = [
  { clubId: 'zebulon', city: 'la', url: 'https://www.songkick.com/venues/3497989-zebulon/calendar' },
  { clubId: 'mint', city: 'la', url: 'https://www.songkick.com/venues/8-mint/calendar' },
  // { clubId: 'golddiggers', city: 'la', url: '…' }, // no confirmed Songkick page yet
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// crude fuzzy: do the titles share most of their meaningful words?
function titlesOverlap(a, b) {
  const wa = new Set(norm(a).split(' ').filter((w) => w.length > 2));
  const wb = new Set(norm(b).split(' ').filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return false;
  const hits = [...wa].filter((w) => wb.has(w)).length;
  return hits / Math.min(wa.size, wb.size) >= 0.5;
}

function extractSongkickEvents(html) {
  const events = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (!/MusicEvent/i.test(String(node['@type'] ?? ''))) continue;
        const date = String(node.startDate ?? '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        events.push({ name: node.name ?? '', date });
      }
    } catch { /* Songkick's LD is occasionally malformed; skip the block */ }
  }
  return events;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  let missing = 0;
  for (const v of VENUES) {
    let ours;
    try {
      ours = JSON.parse(await readFile(join(DATA_DIR, `events-${v.city}.json`), 'utf8'))
        .events.filter((e) => e.clubId === v.clubId);
    } catch {
      console.log(`[${v.clubId}] no local data (run npm run crawl first)`);
      continue;
    }
    let html;
    try {
      const r = await fetch(v.url, { headers: { 'user-agent': UA, accept: 'text/html' } });
      if (!r.ok) { console.log(`[${v.clubId}] songkick ${r.status} — skipped`); continue; }
      html = await r.text();
    } catch (err) {
      console.log(`[${v.clubId}] songkick fetch failed: ${String(err).slice(0, 60)}`);
      continue;
    }
    const theirs = extractSongkickEvents(html).filter((e) => e.date >= today);
    const misses = theirs.filter((t) =>
      !ours.some((o) => o.date === t.date && titlesOverlap(o.title, t.name)));
    console.log(`[${v.clubId}] songkick lists ${theirs.length} upcoming; we have ${ours.length}; possible misses: ${misses.length}`);
    for (const miss of misses) {
      console.log(`   MISS ${miss.date}  ${miss.name}`);
      missing++;
    }
  }
  console.log(missing ? `\n${missing} possible missed show(s) — check whether they're jazz, then loosen the filter or extend _jazzartists.js` : '\nrecall audit clean');
  process.exitCode = missing ? 3 : 0;
}

main();
