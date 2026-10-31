// Build clean show history from the daily archive snapshots (PROTOTYPE).
//   node scripts/build-history.mjs [--from ~/jazzlineup-archive-backup/archive] [--out data/history]
// Reads archive/<city>/<date>.json, writes:
//   <out>/<city>/index.json      venues, months, date range
//   <out>/<city>/YYYY-MM.json    every past show once, with a status
//   <out>/musicians.json         every musician across cities (search list)
// The raw archive is only read, never written.
//
// Status rules (docs/api-v1.md, archive plan):
//   happened    still on the venue's site within a day of the show
//   cancelled   dropped off before its date while the venue crawled fine
//   unconfirmed the venue's crawler was broken around then, or the venue
//               dropped a whole block of shows at once (a crawler problem)
// A venue counts as "read" in a snapshot unless an error in that snapshot
// names its module or its host. Title edits on the same night merge into
// one show (formerIds) instead of looking like a cancellation.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CLUBS } from '../crawler/clubs.js';
import { cleanText, slug, tzDate } from '../crawler/lib.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const FROM = (args.from ?? '~/jazzlineup-archive-backup/archive').replace(/^~/, homedir());
const OUT = args.out ?? 'data/history';
const ARCHIVE_START = '2026-07-20'; // first crawl that wrote the archive

// --- error -> club attribution -------------------------------------------------
const clubsByModule = new Map();
for (const c of CLUBS) {
  const m = c.module.replace('./clubs/', '');
  (clubsByModule.get(m) ?? clubsByModule.set(m, []).get(m)).push(c.id);
}
const clubsByHost = new Map();
const addHost = (host, ids) => { host = host.replace(/^www\./, ''); for (const id of ids) (clubsByHost.get(host) ?? clubsByHost.set(host, new Set()).get(host)).add(id); };
for (const c of CLUBS) { try { addHost(new URL(c.url).host, [c.id]); } catch {} }
for (const [file, ids] of clubsByModule) {
  try {
    const src = readFileSync(join('crawler/clubs', file), 'utf8');
    for (const m of src.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) addHost(m[1], ids);
  } catch {}
}
function staleClubs(errors) {
  const out = new Set();
  for (const e of errors ?? []) {
    const mod = e.match(/clubs\/([a-z0-9_-]+\.js)/i)?.[1];
    if (mod && clubsByModule.has(mod)) { clubsByModule.get(mod).forEach((id) => out.add(id)); continue; }
    const host = e.match(/https?:\/\/([^/\s]+)/i)?.[1]?.replace(/^www\./, '');
    if (host && clubsByHost.has(host)) clubsByHost.get(host).forEach((id) => out.add(id));
  }
  return out;
}

// --- lineup cleanup + musician keys ----------------------------------------------
const PLACEHOLDER = /^(tba|tbd|tbc|special guests?|guests?|and friends|more tba)$/i;
const EXTRA_ENTITIES = { euro: '€', pound: '£', agrave: 'à', egrave: 'è', ocirc: 'ô', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß' };
const clean = (t) => cleanText(String(t ?? '').replace(/&([a-z]+);/gi, (m, n) => EXTRA_ENTITIES[n.toLowerCase()] ?? m));
function cleanName(raw) {
  let n = clean(raw);
  n = n.replace(/^\d+\s+(?=\S)/, '');                  // Sometime set numbers "4 今泉 正明"
  n = n.replace(/^\([^)]*\)\s*/, '');                 // "(tue-sat) Jeff Parker"
  n = n.replace(/^[A-Za-z/-]+\)\s*/, '');             // "Friday) Jason Palmer"
  n = n.replace(/\s*\((?:[A-Z]{2,3})\)\s*$/, '');     // "Reinier Baas (NL)"
  return n.trim();
}
export function musicianKey(name) {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}
function cleanLineup(personnel) {
  const out = [];
  for (const p of personnel ?? []) {
    const name = cleanName(p.name);
    if (!name || PLACEHOLDER.test(name) || name.length < 2) continue;
    out.push({ name, instrument: cleanText(p.instrument ?? '').replace(/[,;]+$/, ''), musician: musicianKey(name) });
  }
  return out;
}

const GENERIC = new Set(['trio', 'quartet', 'quintet', 'sextet', 'septet', 'octet', 'band', 'group', 'ensemble', 'orchestra', 'feat', 'ft', 'featuring', 'with', 'presents', 'the', 'and', 'jazz', 'night', 'live', 'sold', 'out', 'last', 'seats', 'tba', 'cancelled', 'canceled', 'de', 'la', 'le', 'et']);
const words = (t) => new Set(clean(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((w) => w.length > 1 && !GENERIC.has(w)));
// titles that are a status, not a show
const CANCELLED_TITLE = /\b(cancel+ed|annul[ée]|abgesagt|postponed|report[ée]|closed for|private event|leaf closed|club closed)\b/i;
const STATUS_TITLE = /^\W*(sold\s*out|last seats|letzte[n]? pl[aä]tze|ausverkauft|complet)\b/i;
// venues whose source stops listing a show a few days ahead (not cancellations)
const EARLY_DROP = new Set(['bluenotetok', 'cottonclubtok', 'pitinn']);
function titleOverlap(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}
// after-midnight sets belong at the end of the evening (same rule as crawler/run.js)
const sortTime = (s) => { const t = s.sets[0] ?? '99'; if (t >= '05:00') return t; const [h, m] = t.split(':').map(Number); return `${h + 24}:${String(m ?? 0).padStart(2, '0')}`; };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// --- per city -------------------------------------------------------------------
function buildCity(city) {
  const dir = join(FROM, city);
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const shows = new Map();       // id -> { versions..., fresh: [dates] }
  const clubFresh = new Map();   // clubId -> sorted local dates when it was read fine
  const venueMeta = new Map();   // clubId -> latest club record + first/last seen
  let tz = 'UTC';
  for (const f of files) {
    const snap = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    tz = snap.clubs?.[0]?.timezone ?? tz;
    const day = tzDate(snap.generatedAt ?? f.slice(0, 10) + 'T21:45:00Z', tz);
    const stale = staleClubs(snap.errors);
    for (const c of snap.clubs ?? []) {
      const v = venueMeta.get(c.id) ?? { ...c, trackedFrom: day };
      venueMeta.set(c.id, { ...v, ...c, trackedFrom: v.trackedFrom, trackedUntil: day });
      if (!stale.has(c.id)) (clubFresh.get(c.id) ?? clubFresh.set(c.id, []).get(c.id)).push(day);
    }
    for (const e of snap.events ?? []) {
      // Tokyo ids that ended in a bare colon before the 10-30 slug fix
      const id = /:$/.test(e.id) ? `${e.clubId}:${e.date}:${slug(e.title)}` : e.id;
      let s = shows.get(id);
      if (!s) shows.set(id, s = { id, clubId: e.clubId, date: e.date, first: day, last: day, fresh: [], ev: e, freshEv: null });
      s.last = day;
      s.ev = e;
      if (!STATUS_TITLE.test(e.title ?? '')) s.realTitle = e.title;
      if (!stale.has(e.clubId)) { s.fresh.push(day); s.freshEv = e; }
      // keep the best lineup / sets ever seen
      if (e.personnel?.length) s.personnel = e.personnel;
      if (e.sets?.length) s.sets = e.sets;
    }
  }
  const today = tzDate(Date.now(), tz);
  const nextFresh = (club, after) => (clubFresh.get(club) ?? []).find((d) => d > after) ?? null;

  // status
  const past = [...shows.values()].filter((s) => s.date < today && s.date >= ARCHIVE_START);
  for (const s of past) {
    const L = s.fresh.at(-1) ?? null;
    const title = s.realTitle ?? (s.freshEv ?? s.ev).title;
    if (CANCELLED_TITLE.test(title) || CANCELLED_TITLE.test((s.freshEv ?? s.ev).title)) { s.status = 'cancelled'; s.statusReason = 'venue-says'; continue; }
    if (L && L >= addDays(s.date, -1)) { s.status = 'happened'; continue; }
    if (L && EARLY_DROP.has(s.clubId) && L >= addDays(s.date, -7)) { s.status = 'happened'; s.statusReason = 'listing-ends-early'; continue; }
    if (!L) { s.status = 'unconfirmed'; s.statusReason = 'never-read'; continue; }
    const N = nextFresh(s.clubId, L);
    if (!N || N > s.date) { s.status = 'unconfirmed'; s.statusReason = 'venue-down'; continue; }
    s.status = 'cancelled'; s.statusReason = 'listing-dropped'; s.dropDay = N;
  }
  // bulk drops (3+ shows vanish from one venue on one day) are crawler trouble
  const drops = new Map();
  for (const s of past) if (s.status === 'cancelled') { const k = `${s.clubId}|${s.dropDay}`; drops.set(k, (drops.get(k) ?? 0) + 1); }
  // renames: a cancelled show and a show that appeared at the same venue + night
  const byNight = new Map();
  for (const s of past) { const k = `${s.clubId}|${s.date}`; (byNight.get(k) ?? byNight.set(k, []).get(k)).push(s); }
  const merged = new Set();
  for (const s of past) {
    if (s.status !== 'cancelled') continue;
    const twin = byNight.get(`${s.clubId}|${s.date}`).find((o) => o !== s && o.status !== 'cancelled' && !merged.has(o.id)
      && o.first >= s.fresh.at(-1)
      && (titleOverlap(o.ev.title, s.ev.title) >= 0.5 || STATUS_TITLE.test(s.ev.title) || /^\W*tba\W*$/i.test(s.ev.title)));
    if (twin) { (twin.formerIds ??= []).push(s.id); merged.add(s.id); continue; }
    if (s.statusReason === 'venue-says') continue;
    const vanished = s.fresh.at(-1);
    const swap = byNight.get(`${s.clubId}|${s.date}`).find((o) => o !== s && o.status === 'happened' && !merged.has(o.id)
      && o.first > vanished && o.first <= addDays(s.dropDay ?? vanished, 1));
    if (swap) {
      (swap.replaced ??= []).push(clean(s.realTitle ?? s.ev.title));
      merged.add(s.id); // shown as "originally listed" on the show that played
      continue;
    }
    if ((drops.get(`${s.clubId}|${s.dropDay}`) ?? 0) >= 3) { s.status = 'unconfirmed'; s.statusReason = 'bulk-drop'; }
  }

  const out = past.filter((s) => !merged.has(s.id)).map((s) => {
    const e = s.freshEv ?? s.ev;
    return {
      id: s.id, formerIds: s.formerIds ?? [], venueId: s.clubId, date: s.date,
      title: clean(STATUS_TITLE.test(e.title) && s.realTitle ? s.realTitle : e.title), titleAlt: e.titleAlt ?? null,
      sets: s.sets ?? e.sets ?? [], late: !!e.late,
      lineup: cleanLineup(s.personnel ?? e.personnel), url: e.url ?? null, price: e.priceText ? clean(e.priceText) : null,
      status: s.status, statusReason: s.statusReason ?? null, seen: { first: s.first, last: s.last },
      replaced: s.replaced ?? [],
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || sortTime(a).localeCompare(sortTime(b)));

  // venues that went down: date ranges with no fresh read (for "couldn't read" notes)
  const gaps = [];
  for (const [club, days] of clubFresh) {
    for (let i = 1; i < days.length; i++) {
      if (addDays(days[i - 1], 2) <= days[i]) gaps.push({ venueId: club, from: addDays(days[i - 1], 1), to: addDays(days[i], -1) });
    }
  }
  for (const [club, v] of venueMeta) {
    const days = clubFresh.get(club) ?? [];
    const lastRead = days.at(-1);
    if (!lastRead || lastRead < v.trackedUntil) gaps.push({ venueId: club, from: lastRead ? addDays(lastRead, 1) : v.trackedFrom, to: v.trackedUntil });
  }
  return { tz, today, shows: out, venues: [...venueMeta.values()], gaps };
}

// --- write ----------------------------------------------------------------------
const cities = readdirSync(FROM).filter((c) => existsSync(join(FROM, c)) && !c.startsWith('.')).sort();
const musicians = new Map();
const generatedAt = new Date().toISOString();
const report = [];
for (const city of cities) {
  const { tz, today, shows, venues, gaps } = buildCity(city);
  const cdir = join(OUT, city);
  mkdirSync(cdir, { recursive: true });
  const months = new Map();
  for (const s of shows) (months.get(s.date.slice(0, 7)) ?? months.set(s.date.slice(0, 7), []).get(s.date.slice(0, 7))).push(s);
  for (const [ym, list] of months) {
    writeFileSync(join(cdir, `${ym}.json`), JSON.stringify({
      generatedAt, city, month: ym, shows: list,
      gaps: gaps.filter((g) => g.from.slice(0, 7) <= ym && g.to.slice(0, 7) >= ym),
    }));
  }
  writeFileSync(join(cdir, 'index.json'), JSON.stringify({
    generatedAt, city, timezone: tz,
    firstDate: shows[0]?.date ?? null, throughDate: shows.at(-1)?.date ?? null,
    months: [...months.entries()].map(([ym, l]) => ({ ym, shows: l.length })),
    venues: venues.map(({ id, name, shortName, neighborhood, borough, color, url, trackedFrom, trackedUntil }) =>
      ({ id, name, shortName, neighborhood, district: borough || null, color, url, trackedFrom, trackedUntil })),
  }));
  for (const s of shows) {
    if (s.status === 'cancelled') continue;
    for (const p of s.lineup) {
      const m = musicians.get(p.musician) ?? { key: p.musician, names: new Map(), shows: 0, cities: {}, last: '' };
      m.names.set(p.name, (m.names.get(p.name) ?? 0) + 1);
      m.shows++; m.cities[city] = (m.cities[city] ?? 0) + 1;
      if (s.date > m.last) m.last = s.date;
      musicians.set(p.musician, m);
    }
  }
  const c = (st) => shows.filter((s) => s.status === st).length;
  report.push(`${city.padEnd(4)} ${String(shows.length).padStart(6)} shows  happened ${c('happened')}  cancelled ${c('cancelled')}  unconfirmed ${c('unconfirmed')}  merged ${shows.reduce((n, s) => n + s.formerIds.length, 0)}  through ${today}`);
}
// display name: the most common spelling, preferring mixed case over ALL CAPS
const pick = (names) => [...names.entries()].sort((a, b) => (/[a-z]/.test(b[0]) - /[a-z]/.test(a[0])) || b[1] - a[1])[0][0];
writeFileSync(join(OUT, 'musicians.json'), JSON.stringify({
  generatedAt,
  musicians: [...musicians.values()].map((m) => ({ key: m.key, name: pick(m.names), shows: m.shows, cities: m.cities, last: m.last }))
    .sort((a, b) => b.shows - a.shows),
}));
console.log(report.join('\n'));
console.log(`musicians: ${musicians.size}  ->  ${OUT}/`);
