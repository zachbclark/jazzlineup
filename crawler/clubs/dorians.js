// Dorian's Through The Record Shop (1939 W North Ave, Wicker Park) — jazz
// speakeasy behind a working record shop. The real domain is
// throughtherecordshop.com (dorianschicago.com doesn't resolve). WordPress,
// server-rendered /events/ list: .post blocks with an <h3 class="date-time">
// ("July 10, 2026"), <h2 class="title">, and a description that carries set
// times ("Live at 9PM & 11PM") and the cover. Mostly live jazz with some DJ
// nights — DJ sets are filtered out, the bands stay.
import {
  fetchText, makeEvent, applyLateNight, extractTimes, monthNum, isoDate,
  cleanText, htmlToText,
} from '../lib.js';

const BASE = 'https://throughtherecordshop.com';
const URL_ = `${BASE}/events/`;

const SKIP_RE = /\bDJ\b|sound obsession|listening party|record fair/i;

export function parse(html) {
  const events = [];
  const post = /<div class="post">([\s\S]*?)<h3 class="date-time">\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*<\/h3>\s*<h2 class="title">([\s\S]*?)<\/h2>([\s\S]*?)(?=<div class="post">|<\/div>\s*<\/div>\s*$|$)/gi;
  let m;
  while ((m = post.exec(html))) {
    const [, head, monName, day, year, rawTitle, tail] = m;
    const month = monthNum(monName);
    if (!month) continue;
    const title = cleanText(rawTitle.replace(/<[^>]+>/g, ' '));
    if (!title || SKIP_RE.test(title)) continue;
    const url = (head.match(/href="(https?:\/\/throughtherecordshop\.com\/events\/[^"]+)"/i) ?? [])[1];
    const desc = htmlToText((tail.match(/<div class="description">([\s\S]*?)<\/div>/i) ?? [])[1] ?? '');
    // "Live at 9PM & 11PM" -> set times. Capture ONLY the run of times after
    // "Live at" — a greedy grab would swallow "Happy Hours 6-8pm" next door.
    const live = desc.match(/live at\s+((?:\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\s*(?:&|and|,|\+)?\s*)+)/i);
    const sets = live ? extractTimes(live[1]) : [];
    const price = (desc.match(/\$\d+[^\s.,]*/) ?? [])[0] ?? null;
    events.push(makeEvent(applyLateNight({
      clubId: 'dorians',
      title,
      date: isoDate(Number(year), month, Number(day)),
      sets,
      url: url ?? URL_,
      details: null, // list blurbs are boilerplate (hours / vax / cover)
      priceText: price,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
