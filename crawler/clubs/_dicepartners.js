// Shared helper for venues whose sites embed the DICE Event List Widget
// (Zebulon, Gold-Diggers). The widget ships a client-side API key on the
// venue's own page; we read it fresh each crawl and call the same partners
// endpoint the widget does:
//   GET https://partners-endpoint.dice.fm/api/v2/events?page[size]=100
//       &filter[venues][]=<venue>            (x-api-key: <key from page>)
// -> { data: [{ name, date (UTC ISO), timezone, url, description }] }
import { fetchText, makeEvent, htmlToText, tzDate, tzTime, applyLateNight, stripPromo } from '../lib.js';

const KEY_RE = /apiKey["'\s:]+["']([A-Za-z0-9]+)["']/;

export function parseDiceEvents(jsonText, clubId, { fallbackUrl, jazzRe = null } = {}) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.data ?? []) {
    if (!ev?.name || !ev?.date) continue;
    const desc = htmlToText(String(ev.description ?? '').replace(/\*\*/g, ''));
    if (jazzRe && !jazzRe.test(`${ev.name} ${desc.slice(0, 800)}`)) continue;
    const tz = ev.timezone || 'America/Los_Angeles';
    events.push(makeEvent(applyLateNight({
      clubId,
      title: ev.name.trim(),
      date: tzDate(ev.date, tz),
      sets: [tzTime(ev.date, tz)],
      url: ev.url ?? fallbackUrl,
      details: stripPromo(desc).slice(0, 300) || null,
    })));
  }
  return events;
}

export async function crawlDiceVenue({ clubId, keyPage, venueFilter, fallbackUrl, jazzRe }) {
  const page = await fetchText(keyPage);
  const key = page.match(KEY_RE)?.[1];
  if (!key) throw new Error(`${clubId}: DICE widget apiKey not found on ${keyPage}`);
  const api = `https://partners-endpoint.dice.fm/api/v2/events?page%5Bsize%5D=100&filter%5Bvenues%5D%5B%5D=${encodeURIComponent(venueFilter)}`;
  const body = await fetchText(api, { headers: { 'x-api-key': key, accept: 'application/json' } });
  return parseDiceEvents(body, clubId, { fallbackUrl, jazzRe });
}
