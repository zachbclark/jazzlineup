// Ronnie Scott's (47 Frith St, Soho) — Britain's most famous jazz room,
// since 1959. Server-rendered /find-a-show listing cards: date line
// ("Thu 16 Jul 2026"), title, description, and a room tag ("Upstairs at
// Ronnie's" books soul/pop — jazz-keyword-filtered; the main room is jazz).
// Set times live on detail pages as "16 July - Doors at 17:00" rows —
// Smalls-style enrichment with reuse. Times are DOORS (their listing
// grammar), noted in details.
import {
  fetchText, makeEvent, applyLateNight, monthNum, isoDate, cleanText,
  htmlToText, sleep,
} from '../lib.js';
import { matchesKnownArtist } from './_jazzartists.js';

const BASE = 'https://www.ronniescotts.co.uk';
const URL_ = `${BASE}/find-a-show`;
const JAZZ_RE = /\bjazz|be-?bop|swing|quartet|quintet|trio|big band|blues|fusion|improvis/i;
const ENRICH_MAX_PAGES = 25;
const ENRICH_CONCURRENCY = 3;

export function parse(html) {
  const events = [];
  const cards = html.match(/<[a-z]+ class="listing">[\s\S]*?(?=<[a-z]+ class="listing">|$)/gi) ?? [];
  for (const card of cards) {
    const room = cleanText((card.match(/listing__show-type[^>]*>([^<]*)/i) ?? [])[1] ?? '');
    const title = cleanText((card.match(/listing__title[^>]*>([\s\S]*?)<\/h\d>/i) ?? [])[1]?.replace(/<[^>]+>/g, ' ') ?? '');
    const dm = card.match(/>\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s*</);
    const url = (card.match(/data-show-event-url="([^"]+)"/i) ?? card.match(/href="(https?:\/\/www\.ronniescotts\.co\.uk\/find-a-show\/[^"]+)"/i) ?? [])[1];
    if (!title || !dm) continue;
    const month = monthNum(dm[2]);
    if (!month) continue;
    const desc = cleanText((card.match(/listing__description[^>]*>([\s\S]*?)<\/p>/i) ?? [])[1]?.replace(/<[^>]+>/g, ' ') ?? '');
    // the main room is jazz by definition; Upstairs books broadly
    if (/upstairs/i.test(room) && !JAZZ_RE.test(`${title} ${desc}`) && !matchesKnownArtist(title)) continue;
    events.push(makeEvent(applyLateNight({
      clubId: 'ronnies',
      title,
      date: isoDate(Number(dm[3]), month, Number(dm[1])),
      sets: [],
      url: url ?? URL_,
      details: /upstairs/i.test(room) ? 'Upstairs at Ronnie’s' : (desc.slice(0, 200) || null),
    })));
  }
  return events;
}

// Detail pages list every performance: "16 July - Doors at 17:00".
export function parseDetailTimes(html, year) {
  const byDate = new Map(); // 'YYYY-MM-DD' -> ['17:00','20:15']
  const txt = htmlToText(html);
  for (const m of txt.matchAll(/(\d{1,2})\s+([A-Za-z]{3,})\s*[-–]\s*Doors at\s+(\d{1,2}):(\d{2})/gi)) {
    const month = monthNum(m[2]);
    if (!month) continue;
    const date = isoDate(year, month, Number(m[1]));
    if (!byDate.has(date)) byDate.set(date, []);
    const t = `${String(m[3]).padStart(2, '0')}:${m[4]}`;
    if (!byDate.get(date).includes(t)) byDate.get(date).push(t);
  }
  return byDate;
}

export async function crawl(ctx = {}) {
  // the listing paginates; fetch a few pages, stop when one repeats/empties
  let html = '';
  const seen = new Set();
  const all = [];
  for (let p = 1; p <= 4; p++) {
    try {
      html = await fetchText(p === 1 ? URL_ : `${URL_}?page=${p}`);
    } catch (err) {
      if (p === 1) throw err;
      break;
    }
    const batch = parse(html).filter((e) => !seen.has(e.id));
    if (!batch.length) break;
    for (const e of batch) seen.add(e.id);
    all.push(...batch);
    await sleep(300);
  }

  const prior = new Map(
    (ctx.previousEvents ?? []).filter((e) => e.sets?.length).map((e) => [e.id, e.sets])
  );
  for (const e of all) {
    if (!e.sets.length && prior.has(e.id)) e.sets = prior.get(e.id);
  }
  const yearByUrl = new Map(all.map((e) => [e.url, Number(e.date.slice(0, 4))]));
  const urls = [...new Set(
    all.filter((e) => !e.sets.length && e.url.includes('/find-a-show/'))
      .sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.url)
  )].slice(0, ENRICH_MAX_PAGES);
  const byUrl = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: ENRICH_CONCURRENCY }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try { byUrl.set(url, parseDetailTimes(await fetchText(url), yearByUrl.get(url))); } catch { /* skip */ }
      await sleep(200);
    }
  }));
  for (const e of all) {
    const times = byUrl.get(e.url)?.get(e.date);
    if (times?.length && !e.sets.length) {
      e.sets = times;
      e.details = e.details ? `${e.details} (doors times)` : 'Doors times shown';
    }
  }
  return all.map((e) => makeEvent(applyLateNight(e)));
}