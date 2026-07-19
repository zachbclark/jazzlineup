// Zig Zag Jazz Club (Hauptstraße 89, Friedenau) — the room the r/Jazz
// crowd vouched for; big touring names (Dee Dee Bridgewater, Richard
// Bona) alongside the Berlin scene. Squarespace, but the program is a
// hand-built summary page at /programmneu (verified 2026-07-18):
//   <div class="summary-item">
//     <a class="summary-title-link" href="/program-mai/<slug>">
//     <h1 class="summary-title">Tal Arditi Featuring Tim Ries...</h1>
//     <div class="summary-excerpt">(Jazz) description…</div>
//     <time class="summary-metadata-item--date">July 18, 2026</time>
// Dates are ENGLISH ("July 18, 2026") despite the German prose. Every
// excerpt opens with a genre paren and every one we saw contained Jazz —
// non-jazz tags are skipped if they ever appear. Start times live on
// detail pages ("Beginn: 20:00 Uhr (Einlass ab 19:00 Uhr)") — detail
// enrichment fills them a few pages per crawl.
import {
  fetchText, makeEvent, cleanText, htmlToText, monthNum, isoDate,
  personnelFromLines, titleCaseName,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const BASE = 'https://www.zigzag-jazzclub.berlin';

export function parse(html) {
  const events = [];
  const seen = new Set();
  const chunks = String(html).split(/(?=<div[^>]+class=["'][^"']*\bsummary-item\b)/).slice(1);
  for (const chunk of chunks) {
    // raw markup: <div class="summary-title"><a class="summary-title-link">…</a>
    // (the browser upgrades the div to an h1 — don't require a heading tag)
    const title = cleanText(htmlToText(chunk.match(/class=["'][^"']*summary-title-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/)?.[1] ?? ''));
    const dm = htmlToText(chunk.match(/class=["'][^"']*summary-metadata-item--date[^"']*["'][^>]*>([\s\S]*?)<\//)?.[1] ?? '')
      .match(/([A-Za-zÄÖÜäöü]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (!title || !dm) continue;
    const month = monthNum(dm[1]);
    if (!month) continue;
    const genre = htmlToText(chunk.match(/class=["'][^"']*summary-excerpt[^"']*["'][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '')
      .match(/^\s*\(([^)]{2,40})\)/)?.[1];
    if (genre && !/jazz|swing|blues|latin|groove|funk|soul|bossa|chanson/i.test(genre)) continue;
    const url = chunk.match(/class=["'][^"']*summary-title-link[^"']*["'][^>]*href=["']([^"']+)["']/)?.[1]
      ?? chunk.match(/href=["'](\/program-[^"']+)["']/)?.[1];
    const ev = makeEvent({
      clubId: 'zigzag',
      title,
      date: isoDate(Number(dm[3]), month, Number(dm[2])),
      sets: [],
      url: url ? (url.startsWith('http') ? url : BASE + url) : `${BASE}/programmneu`,
      details: genre && !/^jazz$/i.test(genre.trim()) ? genre.trim() : null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

// "Beginn: 20:00 Uhr (Einlass ab 19:00 Uhr)" -> sets ['20:00'].
// The same pages carry a line-per-player roster in chaotic case
// ("TAL ARDITI - Guitar", "tim ries - saxophone") — personnelFromLines
// validates it, then any name without proper mixed case gets title-cased.
export function extractDetail(html) {
  const txt = htmlToText(html);
  const start = txt.match(/Beginn:?\s*(\d{1,2})[:.](\d{2})/i)
    ?? txt.match(/Start:?\s*(\d{1,2})[:.](\d{2})/i);
  const price = txt.match(/Eintritt:?\s*([\d]+(?:[.,]\d{2})?\s*(?:€|Euro))/i)?.[1];
  const personnel = personnelFromLines(txt).map((p) => ({
    ...p,
    name: /\p{Lu}\p{Ll}/u.test(p.name) ? p.name : titleCaseName(p.name),
  }));
  return {
    sets: start ? [`${start[1].padStart(2, '0')}:${start[2]}`] : [],
    priceText: price ? cleanText(price) : null,
    personnel: personnel.length ? personnel : null,
  };
}

export async function crawl(ctx) {
  const events = parse(await fetchText(`${BASE}/programmneu`));
  return enrichFromDetailPages(events, ctx, {
    // sets triggers the fetch; price and roster ride along so shows without
    // a published roster (jams) don't refetch forever (New Morning rule)
    fields: ['sets'],
    alsoFill: ['priceText', 'personnel'],
    extract: extractDetail,
    maxPages: 10,
  });
}
