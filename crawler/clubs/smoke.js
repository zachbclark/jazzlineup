// Smoke Jazz Club — tickets.smokejazz.com runs on Turntable Tickets, which
// exposes a clean JSON API:
//   GET /api/performance/?booking=true&pagination=false
// -> [{ id, datetime (UTC ISO), show_id, show: { id, name, price_per_person, ... } }]
// One record per SET; we group by (NY date, show) into events with sets[].
import { fetchText, makeEvent, nyDate, nyTime, applyLateNight } from '../lib.js';

const BASE = 'https://tickets.smokejazz.com';
const API = `${BASE}/api/performance/?booking=true&pagination=false`;

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const perfs = Array.isArray(j) ? j : (j.results ?? []);
  const grouped = new Map(); // `${date}:${showId}` -> event draft
  for (const p of perfs) {
    if (!p?.datetime || !p?.show?.name) continue;
    const date = nyDate(p.datetime);
    const key = `${date}:${p.show_id ?? p.show.id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        clubId: 'smoke',
        title: p.show.name,
        date,
        sets: [],
        url: `${BASE}/shows/${p.show_id ?? p.show.id}/`,
        priceText: p.show.price_per_person ? String(p.show.price_per_person) : null,
      });
    }
    grouped.get(key).sets.push(nyTime(p.datetime));
  }
  return [...grouped.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(API, { headers: { accept: 'application/json' } }));
}
