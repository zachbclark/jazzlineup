// In production the site is fully static: the crawler Lambda writes
// events-<city>.json files to S3 and the frontend fetches them as plain
// files (each city's clubs are embedded in its payload).
export const CITIES = [
  { id: 'nyc', label: 'NYC' },
  { id: 'la', label: 'LA' },
];

export function initialCity() {
  const fromPath = window.location.pathname.replace(/^\//, '').toLowerCase();
  if (CITIES.some((c) => c.id === fromPath)) return fromPath;
  const saved = localStorage.getItem('jl.city');
  if (CITIES.some((c) => c.id === saved)) return saved;
  return 'nyc';
}

export async function fetchData(city = 'nyc') {
  const r = await fetch(`/events-${city}.json`);
  if (!r.ok) throw new Error('events fetch failed');
  return r.json(); // { generatedAt, city, clubs, errors, events }
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
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

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
