// b-flat (Dircksenstraße 40, Mitte) — acoustic music & jazz club since
// 1995; Wednesday jam is a Berlin fixture. Squarespace EVENTS collection,
// so this is the Blue Nile pattern (verified 2026-07-18):
//   /events?format=json -> { upcoming: [{ title, startDate (epoch ms),
//     excerpt (roster: "Hervé Hartock (dr), Samuel Appapoulay (keyb.)…"),
//     tags: ["Doors open: 20:00 – Concert: 21:00"], fullUrl }] }
// The concert time rides the tags; the roster rides the excerpt in
// Name(abbr) form — personnelFromJpRun with the western name cap. The
// startDate's clock time is unreliable (often 01:00), so DATE comes from
// startDate in Europe/Berlin but TIME comes from the Concert tag.
// All jazz — no filter.
import {
  fetchText, makeEvent, applyLateNight, cleanText, htmlToText, deDate,
  personnelFromJpRun,
} from '../lib.js';

const BASE = 'https://b-flat-berlin.de';

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  const seen = new Set();
  for (const item of j.upcoming ?? j.items ?? []) {
    if (!item?.title || !item?.startDate) continue;
    const title = cleanText(item.title);
    const tagLine = (item.tags ?? []).join(' ');
    const start = tagLine.match(/Concert:?\s*(\d{1,2}[:.]\d{2})/i)?.[1]
      ?? tagLine.match(/(\d{1,2}[:.]\d{2})\s*$/)?.[1];
    const excerpt = cleanText(htmlToText(String(item.excerpt ?? '')));
    const personnel = personnelFromJpRun(excerpt, { maxName: 40 });
    const ev = makeEvent(applyLateNight({
      clubId: 'bflat',
      title,
      date: deDate(item.startDate),
      sets: start ? [start.replace('.', ':')] : [],
      url: item.fullUrl ? BASE + item.fullUrl : `${BASE}/programm`,
      details: null,
      personnel: personnel.length ? personnel : null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/events?format=json`, { headers: { accept: 'application/json' } }));
}
