// Andy's Jazz Club (11 E Hubbard St, River North) — jazz nightly since
// 1977, three shows a night. WordPress + Modern Events Calendar; the
// /music-calendar/ page server-renders every occurrence as an
// <article class="mec-event-article"> with the time range and a link whose
// ?occurrence=YYYY-MM-DD carries the date. Several weeks ship in one page —
// no ajax needed. "1st Set With X" / "2nd Set With X" merge into one event
// with both set times (the Terraza 7 trick). All jazz — no filter.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, cleanText, slug,
} from '../lib.js';

const URL_ = 'https://andysjazzclub.com/music-calendar/';

const SET_PREFIX = /^(?:1st|2nd|3rd|first|second|third)\s+set\s+with\s+/i;

export function parse(html) {
  const found = new Map(); // (date + base-title) -> draft
  const art = /<article[^>]*class="[^"]*mec-event-article[^"]*"[\s\S]{0,2500}?<\/article>/gi;
  let m;
  while ((m = art.exec(html))) {
    const card = m[0];
    const link = card.match(/<h\d[^>]*class="[^"]*mec-event-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)/i);
    if (!link) continue;
    const url = link[1].replace(/&amp;/g, '&');
    const rawTitle = cleanText(link[2]);
    const occ = url.match(/occurrence=(\d{4}-\d{2}-\d{2})/);
    if (!occ) continue;
    const start = normalizeTime((card.match(/mec-event-time[^>]*>[\s\S]{0,80}?(\d{1,2}(?::\d{2})?\s*[ap]m)/i) ?? [])[1]);

    const isSet = SET_PREFIX.test(rawTitle);
    const title = isSet ? rawTitle.replace(SET_PREFIX, '') : rawTitle;
    const key = `${occ[1]}:${slug(title)}`;
    const prev = found.get(key);
    if (prev) {
      if (start && !prev.sets.includes(start)) prev.sets.push(start);
    } else {
      found.set(key, {
        clubId: 'andys',
        title,
        date: occ[1],
        sets: start ? [start] : [],
        url, // first set's link; fine — same event page, ?time differs
      });
    }
  }
  return [...found.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
