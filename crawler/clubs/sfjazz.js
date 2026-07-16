// SFJAZZ (201 Franklin St, Hayes Valley) — the institution: Miner
// Auditorium + the Joe Henderson Lab, plus shows they present around the
// Bay (Paramount Oakland etc). Their own clean JSON API:
//   GET /ace-api/events/?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// -> [{ name, eventDate (ISO w/ offset), location, eventTypes, artists,
//       viewDetailCtaUrl, soldOut … }] — one record per SET; we group by
// (date, production) into events with sets[].
// Kept: eventTypes "Shows" (+ "Dancefloor") and in-building "Fridays Live".
// Dropped: classes/workshops/Digital Lab and "SFJAZZ At Home" streams.
import { fetchText, makeEvent, applyLateNight, laDate, laTime, cleanText, slug } from '../lib.js';

const BASE = 'https://www.sfjazz.org';

function keep(ev) {
  const types = ev.eventTypes ?? [];
  if (/at home/i.test(ev.location ?? '')) return false; // streams
  if (types.some((t) => /digital/i.test(t))) return false;
  return types.includes('Shows') || types.includes('Fridays Live');
}

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const grouped = new Map(); // `${date}:${production}` -> draft
  for (const ev of Array.isArray(j) ? j : []) {
    if (!ev?.name || !ev?.eventDate || !keep(ev)) continue;
    const date = laDate(ev.eventDate);
    const key = `${date}:${slug(ev.name)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        clubId: 'sfjazz',
        title: ev.name,
        date,
        sets: [],
        url: ev.viewDetailCtaUrl ? BASE + ev.viewDetailCtaUrl : `${BASE}/calendar/`,
        // the room matters here: Miner vs the Lab vs an off-site hall
        details: ev.location ? cleanText(ev.location) : null,
      });
    }
    grouped.get(key).sets.push(laTime(ev.eventDate));
  }
  return [...grouped.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl(ctx = {}) {
  const today = ctx.today ?? new Date();
  const start = laDate(today);
  const end = laDate(today.getTime() + 45 * 86400000);
  const url = `${BASE}/ace-api/events/?startDate=${start}&endDate=${end}`;
  // sfjazz.org's Cloudflare challenges every non-browser client (confirmed
  // 2026-07-16: 403 + cf-mitigated on curl AND Node, browser-perfect
  // headers included). Try live anyway — the day they allowlist us this
  // upgrades itself — then fall back to browser-captured seed data.
  try {
    return parse(await fetchText(url, { headers: { accept: 'application/json' } }));
  } catch {
    const { SEED } = await import('./sfjazz-seed.js');
    return parse(JSON.stringify(SEED)).filter((e) => e.date >= start);
  }
}
