// Cellar Dog (75 Christopher St) — Squarespace calendar page /new-music
// backed by the month API:
//   GET /api/open/GetItemsByMonth?month=July-2026&collectionId=<id>
// -> [{ title, startDate(epoch ms), fullUrl, excerpt … }]
// Jazz nightly plus blues/funk nights; titles sometimes carry "(ends at 2am)".
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, applyLateNight } from '../lib.js';

const BASE = 'https://www.cellardog.net';
const COLLECTION = '6890f9218a403c58f1d40c19';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function monthParam(offset, today = new Date()) {
  const [y, m] = nyDate(today).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

export function parse(jsonText) {
  const items = JSON.parse(jsonText);
  const events = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it?.title || !it?.startDate) continue;
    const time = nyTime(it.startDate);
    const plausible = time >= '12:00' || time < '03:00';
    const title = String(it.title).replace(/\s*\((?:ends?|until|till)[^)]*\)\s*/gi, ' ').trim();
    const excerpt = stripPromo(htmlToText(it.excerpt ?? ''));
    events.push(makeEvent(applyLateNight({
      clubId: 'cellardog',
      title,
      date: nyDate(it.startDate),
      sets: plausible ? [time] : [],
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/new-music`,
      details: excerpt.slice(0, 300) || null,
    })));
  }
  return events;
}

export async function crawl() {
  const out = [];
  for (const offset of [0, 1]) {
    const url = `${BASE}/api/open/GetItemsByMonth?month=${monthParam(offset)}&collectionId=${COLLECTION}`;
    try {
      out.push(...parse(await fetchText(url, { headers: { accept: 'application/json' } })));
    } catch (err) {
      if (offset === 0) throw err; // current month must work; next month is best-effort
    }
  }
  return out;
}
