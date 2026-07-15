// Shared extractor for Turntable Tickets venues (Smoke NYC, Black Cat SF).
// The ticketing subdomain exposes a clean JSON API:
//   GET https://<venue>.turntabletickets.com/api/performance/?booking=true&pagination=false
// -> [{ id, datetime (UTC ISO), show_id, show: { id, name, price_per_person } }]
// One record per SET; we group by (venue-local date, show) into events with
// sets[]. price_per_person is a string on some venues, a [min, max] array on
// others — both normalize here.
import { makeEvent, tzDate, tzTime, applyLateNight, fetchText } from '../lib.js';

function priceText(p) {
  if (!p) return null;
  if (Array.isArray(p)) {
    const nums = p.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return min === max ? `$${Math.round(min)}` : `$${Math.round(min)}-${Math.round(max)}`;
  }
  return String(p);
}

export function parseTurntable(jsonText, clubId, { base, tz }) {
  const j = JSON.parse(jsonText);
  const perfs = Array.isArray(j) ? j : (j.results ?? []);
  const grouped = new Map(); // `${date}:${showId}` -> event draft
  for (const p of perfs) {
    if (!p?.datetime || !p?.show?.name) continue;
    const date = tzDate(p.datetime, tz);
    const key = `${date}:${p.show_id ?? p.show.id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        clubId,
        title: p.show.name,
        date,
        sets: [],
        // ?date= is required — without it the Show Detail page can't resolve
        // which night you meant. Uses the literal performance date on purpose:
        // applyLateNight may shift OUR date to the previous evening, but the
        // ticketing site indexes by calendar date.
        url: `${base}/shows/${p.show_id ?? p.show.id}/?date=${date}`,
        priceText: priceText(p.show.price_per_person),
      });
    }
    grouped.get(key).sets.push(tzTime(p.datetime, tz));
  }
  return [...grouped.values()].map((d) => makeEvent(applyLateNight(d)));
}

export function makeTurntableCrawler({ clubId, base, tz }) {
  return async function crawl() {
    const body = await fetchText(`${base}/api/performance/?booking=true&pagination=false`, {
      headers: { accept: 'application/json' },
    });
    return parseTurntable(body, clubId, { base, tz });
  };
}
