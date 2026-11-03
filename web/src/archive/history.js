// Archive data: the clean history files from scripts/build-history.mjs,
// served at /history/<city>/index.json, /history/<city>/YYYY-MM.json and
// /history/musicians.json. Kept in a module cache so flipping nights or
// searching never refetches.
//
// In production a missing file comes back as index.html with a 200
// (CloudFront's page-link fallback), so anything that isn't JSON counts
// as "not filed yet".
const cache = new Map();

async function getJson(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path).then(async (r) => {
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !type.includes('json')) return null;
    return r.json();
  }).catch(() => null);
  cache.set(path, p);
  return p;
}

export const loadIndex = (city) => getJson(`/history/${city}/index.json`);
export const loadMonth = (city, ym) => getJson(`/history/${city}/${ym}.json`);
export const loadMusicians = () => getJson('/history/musicians.json');

export async function loadAllMonths(city, index) {
  const months = await Promise.all((index?.months ?? []).map((m) => loadMonth(city, m.ym)));
  return months.filter(Boolean);
}

// same folding as the live search (api.js searchNorm), kept local so the
// archive never changes live behavior
export function norm(s) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ').trim();
}

export function musicianKey(name) {
  return String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

// folded text per show, built on first search and reused for every keystroke
const hayCache = new WeakMap();

// Search results fold one booking's nights into a run: same venue, same
// title, same lineup, nights at most 2 days apart (a dark Monday doesn't
// split a Tue-Sun week). A lineup change splits the run, so a sub's search
// shows only the nights they played (Steve Davis at Smoke, Sep 2026: Eddie
// Henderson 2 nights, then Jeremy Pelt 3). A run holds at most a week of
// dates, so a nightly jam with a house band doesn't become one row spanning
// months. Same-day listings (early + late entered separately) share a date.
// Newest run first.
const lineupKey = (s) => s.lineup.map((p) => p.name).sort().join('|');
const daysApart = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
const RUN_MAX_DATES = 7;

export function groupRuns(shows) {
  const open = new Map();
  const runs = [];
  for (const s of [...shows].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = `${s.venueId}\n${s.title}\n${lineupKey(s)}`;
    const run = open.get(k);
    const dates = run && new Set(run.map((x) => x.date));
    const fits = run && daysApart(run.at(-1).date, s.date) <= 2 && (dates.has(s.date) || dates.size < RUN_MAX_DATES);
    if (fits) run.push(s);
    else { const fresh = [s]; runs.push(fresh); open.set(k, fresh); }
  }
  return runs.map((nights) => {
    const dates = [...new Set(nights.map((s) => s.date))];
    // a night counts as cancelled only if every listing that date was
    const cancelled = dates.filter((d) => nights.every((s) => s.date !== d || s.status === 'cancelled')).length;
    const latest = nights.at(-1);
    const lastPlayed = nights.filter((s) => s.status !== 'cancelled').at(-1);
    return {
      id: nights[0].id,
      dates,
      first: dates[0],
      last: dates.at(-1),
      cancelled,
      // the row shows the last night actually played; "cancelled" only when
      // every night was (mixed runs say "1 cancelled" next to the date)
      show: lastPlayed ?? latest,
    };
  }).sort((a, b) => b.last.localeCompare(a.last));
}

export function showMatches(show, q, venueName) {
  if (!q) return false;
  let hay = hayCache.get(show);
  if (hay === undefined) {
    hay = norm([show.title, show.titleAlt, venueName, ...show.lineup.map((p) => p.name)].join(' '));
    hayCache.set(show, hay);
  }
  return hay.includes(q);
}
