// In production the site is fully static: the crawler Lambda writes
// events-<city>.json files to S3 and the frontend fetches them as plain
// files (each city's clubs are embedded in its payload).
// id: internal + data file name (events-<id>.json) + localStorage keys —
// never changes. slug: what the URL shows (jazzlineup.com/chicago).
export const CITIES = [
  { id: 'nyc', label: 'NYC', slug: 'nyc' },
  { id: 'la', label: 'LA', slug: 'la' },
  { id: 'chi', label: 'CHICAGO', slug: 'chicago' },
  { id: 'sf', label: 'SF', slug: 'sf' },
  { id: 'par', label: 'PARIS', slug: 'paris', clock24: true },
  { id: 'lon', label: 'LONDON', slug: 'london', clock24: true },
];

export function citySlug(id) {
  return CITIES.find((c) => c.id === id)?.slug ?? id;
}

export function initialCity() {
  const fromPath = window.location.pathname.replace(/^\//, '').toLowerCase();
  // slugs are canonical; old short-id links (/par, /chi) keep working
  const match = CITIES.find((c) => c.slug === fromPath || c.id === fromPath);
  if (match) return match.id;
  const saved = localStorage.getItem('jl.city');
  if (CITIES.some((c) => c.id === saved)) return saved;
  return 'nyc';
}

export async function fetchData(city = 'nyc') {
  const r = await fetch(`/events-${city}.json`);
  if (!r.ok) throw new Error('events fetch failed');
  return r.json(); // { generatedAt, city, clubs, errors, events }
}

// European cities read 24h ("20h30"); US cities keep 12h ("8:30 PM").
// App calls setClock24 whenever the active city changes.
let _clock24 = false;
export function setClock24(v) { _clock24 = !!v; }

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (_clock24) return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}

export function fmtSets(sets) {
  return (sets ?? []).map(fmtTime).join(' & ');
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDateHeading(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]}, ${MON[m - 1]} ${d}`;
}

// "Updated 3h ago" — friendlier than a raw timestamp in the footer.
export function relTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return '';
  if (mins < 2) return 'just now';
  if (mins < 90) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Accent- and case-insensitive text normalization for artist search:
// "Félix Lemerle" and "felix lemerle" match; "LunÀtico" matches "lunatico".
export function searchNorm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Does an event match the query? Checks title, personnel names, details
// (several venues carry rosters as plain detail text), and the club name.
export function eventMatches(e, normQuery, clubById) {
  if (!normQuery) return true;
  if (searchNorm(e.title).includes(normQuery)) return true;
  if (e.personnel?.some((p) => searchNorm(p.name).includes(normQuery))) return true;
  if (e.details && searchNorm(e.details).includes(normQuery)) return true;
  const club = clubById?.[e.clubId];
  if (club && searchNorm(club.name).includes(normQuery)) return true;
  return false;
}

// Reduce a show title to its lead artist for tight spaces (calendar cells).
// "Miles Okazaki's “Boomtown” — Album Release" -> "Miles Okazaki"
// "Karen Akers in Come With Me To Paris" -> "Karen Akers"
// "Ari Hoenig Trio" -> "Ari Hoenig Trio" (already concise)
export function mainArtist(title) {
  let t = String(title).trim();
  t = t.replace(/^an evening with\s+/i, '');
  // possessive followed by a quoted work: "Artist's “Album” ..." -> Artist
  const poss = t.match(/^(.{2,40}?)['’]s\s+["'“‘]/);
  if (poss) return poss[1];
  // cut at the first strong delimiter
  let cut = t.split(/[:—–]/)[0]; // colon, em dash, en dash
  cut = cut.split(/\s+(?:w\/|with|feat\.?|ft\.?|featuring|presents|in)\s+/i)[0];
  t = (cut || t).replace(/\s*-\s.*$/, '').trim();
  if (t.length > 30) t = t.slice(0, 28).replace(/\s+\S*$/, '') + '…';
  return t || String(title).slice(0, 28);
}
