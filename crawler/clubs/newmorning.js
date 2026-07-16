// New Morning (7-9 rue des Petites Écuries, 10e) — the legendary big room:
// Chet Baker, Prince, Stan Getz, and today's touring bands. Old-school
// homegrown site whose /programmation page embeds the FULL agenda as a
// JSON-LD Event array — extractJsonLd() from lib reads it directly.
// Quirk: startDate is always T00:00:00 (they never publish set times
// structurally), so events ship time-less. All jazz-adjacent by curation;
// no filter (their occasional soul/world bookings are core New Morning).
import { fetchText, makeEvent, extractJsonLd, htmlToText, cleanText } from '../lib.js';

const BASE = 'https://www.newmorning.com';
const URL_ = `${BASE}/programmation`;

export function parse(html) {
  const events = [];
  const seen = new Set();
  for (const node of extractJsonLd(html)) {
    if (!/event/i.test(String(node['@type'] ?? ''))) continue;
    if (!node.name || !node.startDate) continue;
    const date = String(node.startDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const time = (String(node.startDate).match(/T(\d{2}:\d{2})/) ?? [])[1];
    const ev = makeEvent({
      clubId: 'newmorning',
      title: cleanText(node.name),
      date,
      sets: time && time !== '00:00' ? [time] : [],
      url: node.url ?? URL_,
      details: node.description ? htmlToText(node.description).slice(0, 300) : null,
    });
    if (seen.has(ev.id)) continue; // the JSON-LD block repeats on every page
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
