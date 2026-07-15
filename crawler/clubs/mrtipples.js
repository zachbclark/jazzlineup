// Mr. Tipple's Recording Studio (39 Fell St, Civic Center) — cocktail den
// with jazz seven nights a week. WordPress with The Events Calendar and,
// rarest of luxuries, the tribe REST API actually enabled:
//   GET /wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD
// -> { events: [{ title, start_date 'YYYY-MM-DD HH:MM:SS' (local), url,
//      cost, description … }], total, next_rest_url }
// All jazz — no filter.
import { fetchText, makeEvent, applyLateNight, htmlToText, stripPromo, parsePersonnel, splitIso } from '../lib.js';

const BASE = 'https://mrtipplessf.com';

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    if (!ev?.title || !ev?.start_date) continue;
    const { date, time } = splitIso(ev.start_date.replace(' ', 'T'));
    const desc = htmlToText(ev.description ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId: 'mrtipples',
      title: htmlToText(ev.title),
      date,
      sets: time && time !== '00:00' ? [time] : [],
      url: ev.url ?? `${BASE}/calendar/`,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
      priceText: ev.cost ? String(ev.cost).replace(/\s*[–—]\s*/g, '-') : null,
    })));
  }
  return events;
}

export async function crawl(ctx = {}) {
  const today = ctx.today ?? new Date();
  const out = [];
  let url = `${BASE}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today.toISOString().slice(0, 10)}`;
  for (let page = 0; page < 3 && url; page++) {
    const body = await fetchText(url, { headers: { accept: 'application/json' } });
    out.push(...parse(body));
    let next = null;
    try { next = JSON.parse(body).next_rest_url ?? null; } catch { /* done */ }
    url = next;
  }
  return out;
}
