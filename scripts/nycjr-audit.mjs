// Recall audit against The New York City Jazz Record's monthly calendar —
// the paper of record for NYC listings, and the widest human-curated net
// there is. Their calendar only ships inside the issue PDF, so this is a
// monthly ritual, not a cron:
//   1. grab the Event Calendar PDF from nycjazzrecord.com
//   2. pdftotext -layout tnycjr.pdf calendar.txt
//   3. node scripts/nycjr-audit.mjs calendar.txt [year]
// Reports (a) shows they list at venues WE track that our crawlers missed
// and (b) untracked rooms that keep appearing — expansion candidates.
//
// The PDF prints three columns; pdftotext -layout interleaves them per
// line, so we rebuild each column by character offset (cols start ~0, ~80,
// ~158) and parse each column top-to-bottom as a stream.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data', 'events-nyc.json');

const textPath = process.argv[2];
if (!textPath) {
  console.error('usage: node scripts/nycjr-audit.mjs <pdftotext-layout-output.txt> [year]');
  process.exit(1);
}
const YEAR = Number(process.argv[3] ?? new Date().getFullYear());

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

// their venue names -> our clubIds (longest alias first; matched inside the
// text that precedes the showtime on a closing line)
const ALIASES = [
  ['village vanguard', 'vanguard'],
  ['birdland theater', 'birdland'],
  ['birdland', 'birdland'],
  ['blue note', 'bluenote'],
  ['bar bayeux', 'barbayeux'],
  ['bar lunatico', 'lunatico'],
  ['mezzrow', 'mezzrow'],
  ['smalls', 'smalls'],
  ['smoke', 'smoke'],
  ['the django', 'django'],
  ['zinc bar', 'zincbar'],
  ['cellar dog', 'cellardog'],
  ['the pocket', 'pocket'],
  ['close up', 'closeup'],
  ["bill's place", 'billsplace'],
  ['jazzcultural', 'jazzcultural'],
  ['jazz cultural theater', 'jazzcultural'],
  ['nublu 151', 'nublu'],
  ['nublu', 'nublu'],
  ['shrine', 'shrine'],
  ['silvana', 'silvana'],
  ["dizzy's club", 'dizzys'],
  ['the jazz gallery', 'jazzgallery'],
  ['jazz gallery', 'jazzgallery'],
  ['roulette', 'roulette'],
  ['ornithology cafe', 'ornithologycafe'],
  ['ornithology', 'ornithology'],
  ['terraza 7', 'terraza7'],
  ['jcal', 'jcal'],
  ["arthur's tavern", 'arthurs'],
  ["arthur's", 'arthurs'],
  ["sistas' place", 'sistasplace'],
  ['marjorie eliot', 'marjorie'],
  ['parlor entertainment', 'marjorie'],
  ['barbes', 'barbes'],
];

const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .toLowerCase();

const words = (s) => norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
function overlaps(a, b) {
  const wa = new Set(words(a));
  const wb = words(b);
  if (!wa.size || !wb.length) return false;
  const hit = wb.filter((w) => wa.has(w)).length;
  return hit / Math.min(wa.size, wb.length) >= 0.5;
}

// --- rebuild columns ------------------------------------------------------------
const raw = await readFile(textPath, 'utf8');
const stream = [];
for (const page of raw.split('\f')) {
  const cols = [[], [], []];
  for (const line of page.split('\n')) {
    for (const m of line.matchAll(/(?:^|(?<=\s{3}))\S.*?(?=\s{3,}|$)/g)) {
      const bin = m.index < 75 ? 0 : m.index < 150 ? 1 : 2;
      cols[bin].push(m[0].trim());
    }
  }
  stream.push(...cols[0], ...cols[1], ...cols[2]);
}

// --- parse entries ----------------------------------------------------------------
const DATE_RE = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\s+(\d{1,2})$/;
const TIME_RE = /\b\d{1,2}(?::\d{2})?(?:,\s*\d{1,2}(?::\d{2})?)*\s*[ap]m\b/i;

let date = null;
let buffer = [];
const theirs = [];     // { date, clubId, artist }
const unknown = new Map(); // venue tail -> count

for (const line of stream) {
  const dm = line.match(DATE_RE);
  if (dm) {
    const month = MONTHS[dm[1].toLowerCase()];
    if (month) date = `${YEAR}-${String(month).padStart(2, '0')}-${String(dm[2]).padStart(2, '0')}`;
    buffer = [];
    continue;
  }
  if (!date) continue;
  const tm = line.match(TIME_RE);
  if (!tm) {
    buffer.push(line);
    continue;
  }
  const venueZone = line.slice(0, tm.index);
  const zone = norm(venueZone);
  const hit = ALIASES.find(([alias]) => zone.includes(alias));
  if (hit) {
    const artist = (buffer.join(' ') + ' ' + venueZone.slice(0, zone.indexOf(hit[0]))).trim();
    for (const part of artist.split(';')) {
      const clean = part.replace(/^[•ê\s]+/, '').trim();
      if (clean.length > 2) theirs.push({ date, clubId: hit[1], artist: clean });
    }
  } else {
    const tail = venueZone.replace(/^[•ê\s]+/, '').trim();
    if (tail.length > 2) unknown.set(tail, (unknown.get(tail) ?? 0) + 1);
  }
  buffer = [];
}

// --- diff against our data ---------------------------------------------------------
const data = JSON.parse(await readFile(DATA, 'utf8'));
const ours = new Map(); // `${clubId}:${date}` -> [titles]
for (const e of data.events) {
  const k = `${e.clubId}:${e.date}`;
  if (!ours.has(k)) ours.set(k, []);
  ours.get(k).push(e.title + ' ' + (e.personnel ?? []).map((p) => p.name).join(' '));
}

// only diff dates our data can know about: past shows age out of the data
// files, so first-half-of-month listings would all read as false misses
const today = new Date().toISOString().slice(0, 10);
const misses = [];
for (const t of theirs) {
  if (t.date < today) continue;
  const candidates = ours.get(`${t.clubId}:${t.date}`) ?? [];
  if (!candidates.some((title) => overlaps(t.artist, title) || overlaps(title, t.artist))) {
    misses.push(t);
  }
}

const byClub = new Map();
for (const m of misses) {
  if (!byClub.has(m.clubId)) byClub.set(m.clubId, []);
  byClub.get(m.clubId).push(m);
}

console.log(`NYCJR listings parsed: ${theirs.length} at tracked venues, ${misses.length} possible misses\n`);
for (const [club, list] of [...byClub.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`-- ${club} (${list.length}) ------------------------------`);
  for (const m of list.slice(0, 8)) console.log(`   ${m.date}  ${m.artist.slice(0, 70)}`);
  if (list.length > 8) console.log(`   ... and ${list.length - 8} more`);
}

// venue tails that keep recurring = rooms we might want
const candidates = [...unknown.entries()]
  .map(([tail, n]) => {
    // the venue is the trailing capitalized run; crude but reviewable
    const venue = tail.match(/((?:[A-Z0-9][\w'’.&-]*|at|of|the|de|des)(?:\s+(?:[A-Z0-9][\w'’.&-]*|at|of|the|de|des))*)$/)?.[1] ?? tail;
    return [venue, n];
  })
  .reduce((m, [v, n]) => m.set(v, (m.get(v) ?? 0) + n), new Map());
const top = [...candidates.entries()].filter(([v, n]) => n >= 4 && v.length > 3)
  .sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log('\n-- untracked rooms appearing 4+ times this month (expansion candidates) --');
for (const [v, n] of top) console.log(`   ${String(n).padStart(3)}x  ${v.slice(0, 60)}`);
