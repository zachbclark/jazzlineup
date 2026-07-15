// Sistas' Place (456 Nostrand Ave, Bed-Stuy) — "Music of the Spirit & Music
// As Our Weapon!" Coffeehouse and movement institution; jazz on Saturdays,
// two sets. WordPress, but the REST feeds are stale announcements — the live
// source of truth is the homepage "Featured Event" widget:
//   <article ... aria-label="Reggie Woods Quintet">
//     …Sat., July 18, 2026, Doors Open: 7:30 pm, 1st Show: 8 pm, 2nd Show: 9:30 pm…
import { fetchText, makeEvent, htmlToText, monthNum, isoDate, normalizeTime, prevDay } from '../lib.js';

const BASE = 'https://sistasplace.org';

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  const artRe = /<article[^>]*aria-label="([^"]+)"[\s\S]*?<\/article>/gi;
  let m;
  while ((m = artRe.exec(html))) {
    const title = m[1].trim();
    const body = htmlToText(m[0]);
    const dm = body.match(/([A-Za-z]+)\.?,?\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (!dm || !monthNum(dm[2])) continue;
    const date = isoDate(Number(dm[4]), monthNum(dm[2]), Number(dm[3]));
    // keep current listings only (featured widgets can linger)
    if (date < prevDay(isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate()))) continue;
    if (seen.has(`${date}:${title}`)) continue;
    seen.add(`${date}:${title}`);

    const sets = [];
    const showRe = /(?:1st|2nd|3rd|first|second|third)\s+show:?\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m)/gi;
    let sm;
    while ((sm = showRe.exec(body))) {
      const t = normalizeTime(sm[1]);
      if (t) sets.push(t);
    }
    const doors = body.match(/doors\s+open:?\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m)/i);
    const urlM = m[0].match(/href="(https?:\/\/sistasplace\.org\/[^"]+)"/i);

    events.push(makeEvent({
      clubId: 'sistasplace',
      title,
      date,
      sets,
      url: urlM ? urlM[1] : BASE,
      details: doors ? `Doors ${doors[1]}` : null,
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/`));
}
