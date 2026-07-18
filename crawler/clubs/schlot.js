// Kunstfabrik Schlot (Invalidenstraße 117, Mitte) — courtyard jazz cellar
// since 1993; jazz most nights with cabaret/comedy sprinkled through, so a
// light title filter keeps the Kleinkunst out. WordPress "Offbeat" theme,
// server-rendered /programm/ list (verified 2026-07-18):
//   <div class="edgtf-el-item">
//     <a class="edgtf-el-item-link-outer" href="https://kunstfabrik-schlot.de/event/<slug>/">
//     <span class="edgtf-el-item-day">18</span>
//     <span class="edgtf-el-item-month">Jul</span>   <- GERMAN months (Okt/Dez/Mär)
//     <h4 class="edgtf-el-item-title">…</h4>
// No year on the list (inferYear) and no times — detail pages carry
// "20:30 Uhr", filled by detail enrichment. "geschlossen" placeholders
// are skipped.
import {
  fetchText, makeEvent, cleanText, htmlToText, monthNum, inferYear, isoDate,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const BASE = 'https://kunstfabrik-schlot.de';
// Kleinkunst filter: the room's non-music programming
const SKIP_RE = /kabarett|cabaret|comedy|lesung|slam|theater|impro|zauber/i;

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  const chunks = String(html).split(/(?=<div[^>]+class=["'][^"']*edgtf-el-item(?![\w-]))/).slice(1);
  for (const chunk of chunks) {
    const day = htmlToText(chunk.match(/class=["'][^"']*edgtf-el-item-day[^"']*["'][^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '').trim();
    const mon = htmlToText(chunk.match(/class=["'][^"']*edgtf-el-item-month[^"']*["'][^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '').trim();
    const title = cleanText(htmlToText(chunk.match(/class=["'][^"']*edgtf-el-item-title[^"']*["'][^>]*>([\s\S]*?)<\/h\d>/)?.[1] ?? ''));
    const month = monthNum(mon);
    if (!day || !month || !title) continue;
    if (/geschlossen|closed/i.test(title) || SKIP_RE.test(title)) continue;
    const url = chunk.match(/href=["'](https?:\/\/(?:www\.)?kunstfabrik-schlot\.de\/event\/[^"']+)["']/)?.[1];
    const ev = makeEvent({
      clubId: 'schlot',
      title,
      date: isoDate(inferYear(month, Number(day), today), month, Number(day)),
      sets: [],
      url: url ?? `${BASE}/programm/`,
      details: null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

// detail pages write "Beginn: 20:30 Uhr" or just "20:30 Uhr"
export function extractDetail(html) {
  const txt = htmlToText(html);
  const t = txt.match(/(?:Beginn|Einlass ab|Start)[:\s]*(\d{1,2})[:.](\d{2})/i)
    ?? txt.match(/\b(\d{1,2})[:.](\d{2})\s*Uhr\b/);
  return { sets: t ? [`${t[1].padStart(2, '0')}:${t[2]}`] : [] };
}

export async function crawl(ctx) {
  const events = parse(await fetchText(`${BASE}/programm/`));
  return enrichFromDetailPages(events, ctx, {
    fields: ['sets'],
    extract: extractDetail,
    maxPages: 8,
  });
}
