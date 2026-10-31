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

export function showMatches(show, q, venueName) {
  if (!q) return false;
  const hay = norm([show.title, show.titleAlt, venueName, ...show.lineup.map((p) => p.name)].join(' '));
  return hay.includes(q);
}
