// Shared extractor for WordPress sites with The Events Calendar's REST API
// enabled (Mr. Tipple's SF; Sunset/Sunside Paris):
//   GET <base>/wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD
// -> { events: [{ title, start_date 'YYYY-MM-DD HH:MM:SS' (venue-local),
//      url, cost, description, venue: { venue: 'Room name' } … }],
//      next_rest_url }
// `clubIdFor(ev)` maps an event to a clubId (fixed for single-room venues,
// venue-name lookup for multi-room houses) — return null to skip the event.
import {
  fetchText, makeEvent, applyLateNight, htmlToText, stripPromo,
  parsePersonnel, splitIso,
} from '../lib.js';

export function parseTribe(jsonText, { clubIdFor, fallbackUrl }) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    if (!ev?.title || !ev?.start_date) continue;
    const clubId = clubIdFor(ev);
    if (!clubId) continue;
    const { date, time } = splitIso(ev.start_date.replace(' ', 'T'));
    const desc = htmlToText(ev.description ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId,
      title: htmlToText(ev.title),
      date,
      sets: time && time !== '00:00' ? [time] : [],
      url: ev.url ?? fallbackUrl,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
      priceText: ev.cost ? String(ev.cost).replace(/\s*[–—]\s*/g, '-') : null,
    })));
  }
  return events;
}

export function makeTribeCrawler({ base, clubIdFor, fallbackUrl, maxPages = 3, perPage = 50, timeoutMs = 30000 }) {
  return async function crawl(ctx = {}) {
    const today = ctx.today ?? new Date();
    const out = [];
    let url = `${base}/wp-json/tribe/events/v1/events?per_page=${perPage}&start_date=${today.toISOString().slice(0, 10)}`;
    for (let page = 0; page < maxPages && url; page++) {
      const body = await fetchText(url, { headers: { accept: 'application/json' }, timeoutMs });
      out.push(...parseTribe(body, { clubIdFor, fallbackUrl }));
      let next = null;
      try { next = JSON.parse(body).next_rest_url ?? null; } catch { /* done */ }
      url = next;
    }
    return out;
  };
}
