// Le Duc des Lombards (42 rue des Lombards, Châtelet) — the polished end of
// the rue des Lombards triangle. Drupal site; /fr/l-agenda is fully
// server-rendered: one <article class="…mosaique-evt-item-container…"> per
// production, holding the title (aria-label), the detail link, and one
// <div class="mosaique-evt-date"> per night with the day number, French
// month ("15 juil.") and each set's time ("19H30", "22H00"). The 23h30 jam
// sessions are their own cards. All jazz — no filter.
import {
  fetchText, makeEvent, applyLateNight, inferYear, isoDate, cleanText,
} from '../lib.js';
import { frMonthNum, frTime } from './_fr.js';

const BASE = 'https://ducdeslombards.com';
const URL_ = `${BASE}/fr/l-agenda`;

export function parse(html, today = new Date()) {
  const events = [];
  // Their template ships a comment listing possible statuses
  // (<!-- $event : 'annule','reporte','termine' … -->) inside EVERY date
  // block — strip comments first or the cancelled-filter eats everything
  // (bug found on first live crawl, 2026-07-16).
  html = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const arts = html.match(/<article[^>]*mosaique-evt-item-container[\s\S]*?(?=<article[^>]*mosaique-evt-item-container|$)/gi) ?? [];
  for (const art of arts) {
    const link = art.match(/<a[^>]*href="(\/fr\/l-agenda\/[^"]+)"[^>]*aria-label="([^"]+)"/i)
      ?? art.match(/<a[^>]*aria-label="([^"]+)"[^>]*href="(\/fr\/l-agenda\/[^"]+)"/i);
    if (!link) continue;
    const [href, title] = link[1].startsWith('/') ? [link[1], link[2]] : [link[2], link[1]];
    const ruban = cleanText((art.match(/mosaique-evt-ruban[^>]*>([^<]*)/i) ?? [])[1] ?? '');
    const dateBlocks = art.match(/<div class="mosaique-evt-date"[\s\S]*?(?=<div class="mosaique-evt-date"|<\/article>|$)/gi) ?? [];
    for (const block of dateBlocks) {
      const dm = block.match(/>\s*(\d{1,2})\s+([a-zA-Zûéà]+)\.?\s*</);
      if (!dm) continue;
      const month = frMonthNum(dm[2]);
      if (!month) continue;
      const day = Number(dm[1]);
      const date = isoDate(inferYear(month, day, today), month, day);
      const sets = [];
      for (const t of block.matchAll(/evt-date-heure[^>]*>\s*(\d{1,2}\s*[hH]\s*\d{0,2})/g)) {
        const time = frTime(t[1]);
        if (time && !sets.includes(time)) sets.push(time);
      }
      // cancelled/postponed nights carry the status as a CLASS, not text
      if (/class="[^"]*\b(?:annule|reporte)\b/i.test(block)) continue;
      events.push(makeEvent(applyLateNight({
        clubId: 'duc',
        title: cleanText(title),
        date,
        sets,
        url: BASE + href,
        details: ruban || null, // their series label ("Piano Master", "Caraïbes")
      })));
    }
  }
  return events;
}

export async function crawl(ctx = {}) {
  return parse(await fetchText(URL_), ctx.today ?? new Date());
}
