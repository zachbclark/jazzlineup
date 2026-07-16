// PizzaExpress Live, Soho (10 Dean St) — yes, the pizza chain; the Dean
// Street basement has been a serious jazz room since 1969 (Ella sat in).
// Clean JSON API behind their Next.js site:
//   GET https://api.pizzaexpresslive.com/products/search-event-information?page=1&itemsPerPage=100
// -> results with name, eventDate, doorsOpenTime, showStartTime, price,
//    slug, location. Multi-venue chain -> keep the Soho room only.
import { fetchText, makeEvent, applyLateNight, normalizeTime, splitIso } from '../lib.js';

const API = 'https://api.pizzaexpresslive.com/products/search-event-information';
const SITE = 'https://www.pizzaexpresslive.com';

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const arr = j.results ?? j.items ?? j.data ?? (Array.isArray(j) ? j : []);
  const events = [];
  for (const ev of arr) {
    if (!ev?.name || !ev?.eventDate) continue;
    if (!/soho/i.test(String(ev.location ?? ''))) continue;
    const { date } = splitIso(String(ev.eventDate).replace(' ', 'T'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const show = normalizeTime(ev.showStartTime ?? '');
    const price = ev.price != null && Number(ev.price) > 0 ? `£${Number(ev.price) % 1 ? Number(ev.price).toFixed(2) : Number(ev.price)}` : null;
    events.push(makeEvent(applyLateNight({
      clubId: 'pizzaexpress',
      title: String(ev.name).trim(),
      date,
      sets: show ? [show] : [],
      url: ev.slug ? `${SITE}/whats-on/${String(ev.slug).replace(/^\/+/, '')}` : `${SITE}/whats-on`,
      details: null,
      priceText: price,
    })));
  }
  return events;
}

export async function crawl() {
  const out = [];
  for (const page of [1, 2]) {
    // the API returns an empty body unless the request carries the site's
    // own origin/referer (diagnosed 2026-07-16) — plain technical headers,
    // same ones every browser visit sends
    const body = await fetchText(`${API}?page=${page}&itemsPerPage=100`, {
      headers: {
        accept: 'application/json',
        origin: 'https://www.pizzaexpresslive.com',
        referer: 'https://www.pizzaexpresslive.com/',
      },
    });
    const batch = parse(body);
    out.push(...batch);
    let raw = [];
    try { const j = JSON.parse(body); raw = Array.isArray(j) ? j : (j.results ?? j.items ?? j.data ?? []); } catch { /* done */ }
    if (!Array.isArray(raw) || raw.length < 100) break;
  }
  return out;
}
