// Nublu 151 — nublu.net/program151 (Drupal 7, server-rendered). Each day is a
// table section: <span class="date-display-single" content="2026-07-15T00:00:00-04:00">
// markers, followed by a schpage body whose text reads like
//   "7pm-Masta Ace ... Tickets 10pm-Fernando Garcia ... Tickets"
// with posh.vip ticket links. Multiple acts per night -> separate events.
import { fetchText, makeEvent, htmlToText, normalizeTime, stripPromo } from '../lib.js';

const BASE = 'https://nublu.net';
const URL_ = `${BASE}/program151`;

const NOISE = /sushi reservations?[^]*?(resy\.com|$)|tickets?|\bRSVP\b/gi;

export function parse(html) {
  const events = [];
  // Split the document at each date marker; content attr carries the ISO date.
  const parts = html.split(/<span[^>]*class="[^"]*date-display-single[^"]*"[^>]*content="([\d-]{10})T[^"]*"[^>]*>/i);
  // parts = [pre, date1, chunk1, date2, chunk2, ...] but the same date repeats
  // (day/month/daynum spans) — group chunks by date.
  const byDate = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const date = parts[i];
    byDate.set(date, (byDate.get(date) ?? '') + parts[i + 1]);
  }

  for (const [date, chunk] of byDate) {
    const hrefs = [...chunk.matchAll(/<a[^>]*href="(https?:\/\/(?:posh\.vip|dice\.fm|www\.eventbrite[^"]*)[^"]*)"/gi)]
      .map((m) => m[1].split('?')[0]);
    const text = htmlToText(chunk);
    // segments: a time token, a dash, then the act name until the next time/noise
    const segRe = /(\d{1,2}(?::\d{2})?\s*[ap]m)\s*[-–—]\s*([^]*?)(?=\d{1,2}(?::\d{2})?\s*[ap]m\s*[-–—]|$)/gi;
    let m, idx = 0;
    while ((m = segRe.exec(text))) {
      const time = normalizeTime(m[1]);
      let title = stripPromo(m[2])
        .replace(NOISE, ' ')
        .replace(/\d{1,2}(?::\d{2})?\s*[ap]m/gi, ' ')  // stray range-ends like "-2am"
        .replace(/\s+/g, ' ')
        .replace(/[-–—\s]+$/g, '')
        .trim();
      if (!title || title.length < 3) continue;
      events.push(makeEvent({
        clubId: 'nublu',
        title: title.slice(0, 90),
        date,
        sets: time ? [time] : [],
        url: hrefs[idx] ?? URL_,
      }));
      idx++;
    }
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
