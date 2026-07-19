// PizzaExpress Live, Soho (10 Dean St) — yes, the pizza chain; the Dean
// Street basement has been a serious jazz room since 1969 (Ella sat in).
// Clean JSON API behind their Next.js site:
//   GET https://api.pizzaexpresslive.com/products/search-event-information?page=1&itemsPerPage=100
// -> results with name, eventDate, doorsOpenTime, showStartTime, price,
//    slug, location. Multi-venue chain -> keep the Soho room only.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, inferYear,
  isoDate, htmlToText, cleanText, personnelFromJpRun,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const API = 'https://api.pizzaexpresslive.com/products/search-event-information';
const SITE = 'https://www.pizzaexpresslive.com';

// The WAF-appeasing headers (see the crawl() comment) — the event pages sit
// behind the same door as the API, so detail fetches carry them too.
const HEADERS = {
  origin: 'https://www.pizzaexpresslive.com',
  referer: 'https://www.pizzaexpresslive.com/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

export function parse(jsonText, today = new Date()) {
  const j = JSON.parse(jsonText);
  const arr = Array.isArray(j) ? j : (j.results ?? j.items ?? j.data ?? []);
  const events = [];
  for (const ev of arr) {
    if (!ev?.name || !ev?.eventDate) continue;
    if (!/soho/i.test(String(ev.location ?? ''))) continue;
    // eventDate is PROSE with no year: "Thursday 16th July" (real payload
    // dumped 2026-07-16 — never assume field shapes again)
    const dm = String(ev.eventDate).match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/);
    if (!dm) continue;
    const month = monthNum(dm[2]);
    if (!month) continue;
    const day = Number(dm[1]);
    const date = isoDate(inferYear(month, day, today), month, day);
    const show = normalizeTime(ev.showStartTime ?? '');
    // price is in PENCE: 3500 -> £35
    const pence = Number(ev.price);
    const price = Number.isFinite(pence) && pence > 0
      ? `£${pence % 100 ? (pence / 100).toFixed(2) : pence / 100}`
      : null;
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

// Event pages are a Next.js shell, but __NEXT_DATA__ carries the event's
// attribute list, including a dedicated band_line_up_copy roster
// ("Noah Stoneman (piano)\nFelix Moseholm (double bass)…" — found 2026-07-18)
// and an html_description bio. personnelFromJpRun parses the paren roster;
// the first prose line of the bio becomes details.
export function parseDetail(html) {
  const m = String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let attrs;
  try { attrs = JSON.parse(m[1]).props?.pageProps?.event?.attributes ?? []; } catch { return null; }
  const attr = (code) => String(attrs.find((a) => a?.attribute?.code === code)?.value ?? '');
  const personnel = personnelFromJpRun(htmlToText(attr('band_line_up_copy')), { maxName: 40 });
  const prose = htmlToText(attr('html_description')).split('\n')
    .map((l) => l.trim()).find((l) => l.length > 40);
  return {
    personnel: personnel.length ? personnel : null,
    details: prose ? cleanText(prose).slice(0, 300) : null,
  };
}

export async function crawl(ctx = {}) {
  const out = [];
  // itemsPerPage=30 matches their own widget exactly — asking for 100
  // returns an empty body (diagnosed 2026-07-16, the third and hopefully
  // final layer of this venue's WAF onion)
  for (const page of [1, 2, 3, 4, 5, 6]) {
    // Their WAF requires origin/referer AND rejects any UA containing a bot
    // marker (diagnosed 2026-07-16: same request succeeds with a plain
    // browser UA, returns empty with our honest jazzlineup-bot suffix).
    // This is the ONE venue where we send an unmarked UA — scoped here on
    // purpose; delete this venue rather than spreading the pattern.
    const body = await fetchText(`${API}?page=${page}&itemsPerPage=30`, {
      headers: { accept: 'application/json', ...HEADERS },
    });
    const batch = parse(body);
    out.push(...batch);
    let raw = [];
    try { const j = JSON.parse(body); raw = Array.isArray(j) ? j : (j.results ?? j.items ?? j.data ?? []); } catch { /* done */ }
    if (!Array.isArray(raw) || raw.length < 30) break;
  }
  await enrichFromDetailPages(out.filter((e) => e.url !== `${SITE}/whats-on`), ctx, {
    fields: ['personnel', 'details'],
    extract: parseDetail,
    fetchImpl: (u) => fetchText(u, { headers: HEADERS }),
  });
  return out;
}
