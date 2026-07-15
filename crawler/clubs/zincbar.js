// Zinc Bar (82 W 3rd St) — WordPress with The Events Calendar (tribe) REST:
//   GET /wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD
// -> { events: [{ title, start_date "YYYY-MM-DD HH:MM:SS", url, description …}],
//      total, next_rest_url }
// DOMAIN WARNING (2026-07-15): use www.zincbar.com ONLY. The lookalike
// zincjazz.com mirrors their content but is compromised — it redirects
// (including /wp-json/*) to a spam site. Do not "fix" this back.
// Caveat found in recon: start_date carries midnight (00:00:00) — real set
// times live in the description text ("Showtimes: 7:00 PM & 8:30 PM |
// Tickets: $40 at the door"), so we mine them with a plausibility filter.
import { fetchText, makeEvent, htmlToText, extractTimes, splitIso, stripPromo, parsePersonnel, nyDate, applyLateNight } from '../lib.js';

const BASE = 'https://www.zincbar.com';
const PAGES = 3; // 50/page ≈ covers their ~110-event horizon

function plausibleSets(times) {
  return times.filter((t) => t >= '16:00' || t < '02:00').slice(0, 3);
}

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    if (!ev?.title || !ev?.start_date) continue;
    const { date, time } = splitIso(ev.start_date);
    const desc = htmlToText(ev.description ?? '');
    // Prefer an exact start time when the API has one; else mine the text.
    const sets = time && time !== '00:00'
      ? [time]
      : plausibleSets(extractTimes(`${ev.title} ${desc.slice(0, 400)}`));
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId: 'zincbar',
      title: htmlToText(ev.title),
      date,
      sets,
      url: ev.url ?? `${BASE}/events/`,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
      priceText: desc.match(/\$\d+(?:\.\d{2})?/)?.[0] ?? null,
    })));
  }
  return events;
}

export async function crawl() {
  const out = [];
  let url = `${BASE}/wp-json/tribe/events/v1/events?per_page=50&start_date=${nyDate(Date.now())}`;
  for (let i = 0; i < PAGES && url; i++) {
    const text = await fetchText(url, { headers: { accept: 'application/json' } });
    out.push(...parse(text));
    url = JSON.parse(text).next_rest_url ?? null;
  }
  return out;
}
