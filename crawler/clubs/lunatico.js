// Bar LunÀtico — Squarespace; /calendar?format=json returns the events
// collection as { items: [...] } with startDate epoch ms (includes a time,
// though not always a meaningful one) + title + fullUrl + excerpt.
// Since fall 2026 the calendar is a MONTH view: the plain URL returns only
// the current month, so late in a month it looked nearly empty. Fetch this
// month and next via &month=<name>-<year>&view=calendar.
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, parsePersonnel, applyLateNight, extractTimes } from '../lib.js';

const BASE = 'https://www.barlunatico.com';
const URL_ = `${BASE}/calendar?format=json`;

export function parse(jsonText, today = new Date()) {
  const j = JSON.parse(jsonText);
  const cutoff = nyDate(today.getTime() - 86400000); // keep from yesterday on
  const events = [];
  for (const it of j.items ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const date = nyDate(it.startDate);
    if (date < cutoff) continue;
    // Squarespace startDate carries a time; only trust plausible show times
    // (evening sets, or after-midnight starts the late-night rule handles).
    const time = nyTime(it.startDate);
    const plausible = time >= '16:00' || time < '02:00';
    const excerptRaw = htmlToText(it.excerpt ?? '');
    // "***TWO SETS: 9PM & 10:15PM*** ***$10 (CASH)...***" — mine the sets,
    // then strip every ***...*** shout from the description.
    const setsBlock = excerptRaw.match(/\*{2,}\s*TWO SETS[^*]*\*{2,}/i)?.[0] ?? '';
    const minedSets = extractTimes(setsBlock);
    const excerpt = excerptRaw.replace(/\*{2,}[^*]*\*{2,}/g, ' ').replace(/\*+/g, ' ');
    const personnel = parsePersonnel(excerpt);
    events.push(makeEvent(applyLateNight({
      clubId: 'lunatico',
      title: it.title,
      date,
      sets: minedSets.length ? minedSets : (plausible ? [time] : []),
      url: BASE + (it.fullUrl ?? '/music'),
      details: personnel.length ? null : stripPromo(excerpt).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

export function monthUrl(offset, today = new Date()) {
  const [y, m] = nyDate(today).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${URL_}&month=${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}&view=calendar`;
}

export async function crawl() {
  const seen = new Set();
  const out = [];
  for (const offset of [0, 1]) {
    try {
      for (const e of parse(await fetchText(monthUrl(offset), { headers: { accept: 'application/json' } }))) {
        if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
      }
    } catch (err) {
      if (offset === 0) throw err; // this month must work; next month is best-effort
    }
  }
  return out;
}
