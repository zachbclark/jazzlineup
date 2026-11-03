// Downstairs at 180 (180 St John Street, Clerkenwell) — basement jazz room:
// Tuesday jam plus trios and quartets. Requested by Harrison (2026-09-08).
// Squarespace events collection, so /calendar?format=json returns
// { upcoming:[…] }. The startDate is doors (7:30); the body says the real
// start ("8PM Start", "8PM til close"), the cover ("£15 Cover"), and the
// lineup one per line ("Paul Sikivie - Bass"). Bodies also carry
// Squarespace <style> blocks, which htmlToText drops. All jazz, no filter.
import { fetchText, makeEvent, htmlToText, cleanText, decodeEntities, personnelFromLines, sqStartDate, tzDate, tzTime } from '../lib.js';

const BASE = 'https://downstairsat180.co.uk';
const URL_ = `${BASE}/calendar?format=json`;
const TZ = 'Europe/London';

function startTime(text) {
  const m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(?:start|til)/im);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

export function parse(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const events = [];
  for (const it of data.upcoming ?? []) {
    const start = sqStartDate(it);
    const title = cleanText(decodeEntities(it.title ?? ''));
    if (!start || !title) continue;
    const text = htmlToText(it.body ?? '');
    const sets = [startTime(text) ?? tzTime(start, TZ)];
    const price = (text.match(/£\s?\d+(?:\.\d{2})?/) ?? [])[0];
    events.push(makeEvent({
      clubId: 'downstairs180',
      title,
      date: tzDate(start, TZ),
      sets,
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/calendar`,
      personnel: personnelFromLines(text),
      priceText: price ?? null,
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
