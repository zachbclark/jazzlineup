// Jazz Showcase (806 S Plymouth Ct, South Loop) — Joe Segal's room, running
// since 1947; straight-ahead bookings in week-long engagements. Squarespace
// site backed by the month API (same shape as Cellar Dog):
//   GET /api/open/GetItemsByMonth?month=MM-YYYY&collectionId=<id>
// -> [{ title, startDate(epoch ms), fullUrl, excerpt … }], one item per
// night. No crumb/auth needed. All jazz — no filter.
import {
  fetchText, makeEvent, htmlToText, chiDate, chiTime, stripPromo,
  applyLateNight, extractTimes, parsePersonnel,
} from '../lib.js';

const BASE = 'https://www.jazzshowcase.com';
const COLLECTION = '5db851f2a08bbd6576e9a3d1';

function monthParam(offset, today = new Date()) {
  const [y, m] = chiDate(today).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

export function parse(jsonText) {
  const items = JSON.parse(jsonText);
  const events = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it?.title || !it?.startDate) continue;
    const startTime = chiTime(it.startDate);
    const excerpt = htmlToText(it.excerpt ?? '');
    // Engagements usually play two sets ("8 PM & 10 PM" in the blurb);
    // prefer explicit times from the excerpt, fall back to the start time.
    const fromExcerpt = extractTimes((excerpt.match(/(?:sets?|shows?)[^.]{0,60}/i) ?? [excerpt])[0]);
    const plausible = startTime >= '12:00' || startTime < '03:00';
    const sets = fromExcerpt.length ? fromExcerpt : (plausible ? [startTime] : []);
    const personnel = parsePersonnel(excerpt);
    events.push(makeEvent(applyLateNight({
      clubId: 'jazzshowcase',
      title: it.title,
      date: chiDate(it.startDate),
      sets,
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/calendar`,
      details: personnel.length ? null : stripPromo(excerpt).slice(0, 300) || null,
      personnel,
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
