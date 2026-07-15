// Elastic Arts (3429 W Diversey Ave #208, Logan Square) — nonprofit loft
// for improvised and creative music; the Improvised Music Series has run
// for two decades. Squarespace: /events?format=json returns the collection
// with epoch startDate and tags. Programming spans film/electronic series
// (Elastro, Night School, VLX) — we keep improvised music and jazz.
import {
  fetchText, makeEvent, htmlToText, chiDate, chiTime, stripPromo,
  applyLateNight, parsePersonnel,
} from '../lib.js';

const BASE = 'https://elasticarts.org';
const URL_ = `${BASE}/events?format=json`;

const KEEP_RE = /jazz|improvis/i; // matches "Improvised Music Series" tag + titles

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const it of j.upcoming ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const tags = (it.tags ?? []).join(' ');
    const excerpt = htmlToText(it.excerpt ?? '');
    if (!KEEP_RE.test(`${it.title} ${tags}`)) continue;
    const time = chiTime(it.startDate);
    const plausible = time >= '12:00' || time < '03:00';
    const personnel = parsePersonnel(excerpt);
    events.push(makeEvent(applyLateNight({
      clubId: 'elasticarts',
      title: it.title,
      date: chiDate(it.startDate),
      sets: plausible ? [time] : [],
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/events`,
      details: personnel.length ? null : stripPromo(excerpt).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
