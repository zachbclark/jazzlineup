// Shared crawler for the Blue Note Japan reservation platform — Blue Note
// Tokyo (reserve.bluenote.co.jp) and Cotton Club (reserve.cottonclubjapan.
// co.jp) run identical systems. /reserve/schedule/move/YYYYMM serves a
// server-rendered month: one <table class="later"> PER SHOW-RUN, dayBox
// cells for each date in the run (rowspan joins them), a title span, then a
// priceBox and a details block after the table (verified 2026-07-19):
//   <table class="later"><tr>
//     <td class="dayBox sat"><span class="day">1</span>...</td>
//     <td class="scheduleBox" rowspan="2"><span class="title">MASATO HONDA
//       B.B.STATION</span>...</tr>
//     <tr><td class="dayBox sun"><span class="day">2</span>...</td></tr></table>
//   <div class="priceBox">...Music charge &yen;<span class="price">8,000</span>
//   <span class="intro">スター・サックス奏者率いる...</span>
// Titles are mostly roman.
//
// 2026-07-18 pass (the "future pass" the first version promised):
// - SET TIMES are in this view after all — the details block lists per-date
//   seatings ("7.23 thu., 7.24 fri.  [1st]Open5:00pm Start6:00pm
//   [2nd]Open7:45pm Start8:30pm"); both Start times become sets, per the
//   Billboard Live convention.
// - Each run links its artist page (www.<site>/jp/artists/<slug>/) whose
//   MEMBER table carries a roman roster column ("Simon Phillips(ds)") that
//   personnelFromJpRun parses; fetched via detail enrichment, one page per
//   run, and the artist page replaces the generic schedule URL on events.
import {
  fetchText, makeEvent, htmlToText, isoDate, cleanText, sleep, normalizeTime,
  personnelFromJpRun,
} from '../lib.js';
import { applyRomaji } from './_jpromaji.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

// The details text block -> Map of 'M.D' -> ['HH:MM', ...] plus a fallback
// list for runs that print one seating line with no per-date scoping.
export function parseShowtimes(text) {
  const byDate = new Map();
  let fallback = [];
  let pendingDates = [];
  for (const line of String(text).split('\n')) {
    const starts = [...line.matchAll(/Start\s*(\d{1,2}:\d{2}\s*[ap]m)/gi)]
      .map((m) => normalizeTime(m[1])).filter(Boolean);
    const dates = [...line.matchAll(/(?:^|[\s,])(\d{1,2})\.(\d{1,2})(?=\s|$)/g)]
      .map((m) => `${Number(m[1])}.${Number(m[2])}`);
    if (starts.length) {
      if (pendingDates.length || dates.length) {
        for (const d of (dates.length ? dates : pendingDates)) byDate.set(d, starts);
      } else {
        fallback = starts;
      }
      pendingDates = [];
    } else if (dates.length) {
      // "2026 7.4 sat., 7.5 sun." full-run summary lines also match here;
      // they're harmlessly overwritten by the scoped lines that follow
      pendingDates = dates;
    }
  }
  return { byDate, fallback };
}

// Artist page rosters, two shapes on one platform family:
// - Blue Note Tokyo: MEMBER table with roman cells <td class="pr20"><p>Name(ds)</p>
// - Cotton Club: a plain MEMBER heading followed by "Joyce Moreno (vo,g)"
//   lines (ends at the next bracketed section like [予約受付開始日])
// (\bMEMBER\b won't match the nav's "MEMBERS" link — the S is a word char.)
export function parseArtistPage(html) {
  const cells = [...String(html).matchAll(/<td[^>]*class="pr20"[^>]*>\s*<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => htmlToText(m[1]).trim()).filter(Boolean);
  let text = cells.join('\n');
  if (!text) {
    const m = htmlToText(html).match(/\bMEMBER\b\s*([\s\S]{0,600}?)(?=\n\s*[\[【]|$)/);
    text = m ? m[1] : '';
  }
  const personnel = personnelFromJpRun(text, { maxName: 40 });
  return personnel.length ? { personnel } : null;
}

export function parseMonth(html, year, month, clubId, siteUrl) {
  const events = [];
  const seen = new Set();
  // one segment per show-run: the table plus everything until the next table
  const segments = String(html).split(/(?=<table class="later")/).slice(1);
  for (const seg of segments) {
    const tablePart = seg.split('</table>')[0];
    const afterTable = seg.slice(tablePart.length);
    const days = [...tablePart.matchAll(/<span class="day">(\d{1,2})<\/span>/g)].map((m) => Number(m[1]));
    const title = cleanText(htmlToText((tablePart.match(/<span class="title">([\s\S]*?)<\/span>/) ?? [])[1] ?? ''));
    if (!title || !days.length) continue;
    const price = (afterTable.match(/<span class="price">([\d,]+)<\/span>/) ?? [])[1];
    const intro = cleanText(htmlToText((afterTable.match(/<span class="intro">([\s\S]*?)<\/span>/) ?? [])[1] ?? '')).slice(0, 200);
    const times = parseShowtimes(htmlToText(afterTable));
    const artistUrl = (seg.match(/href="(https?:[^"]*\/artists\/[^"]+)"/i) ?? [])[1];
    for (const day of days) {
      const ev = makeEvent({
        clubId,
        title,
        titleAlt: applyRomaji(title) ?? undefined,
        date: isoDate(year, month, day),
        sets: times.byDate.get(`${month}.${day}`) ?? times.fallback,
        url: artistUrl ?? siteUrl,
        details: intro || null,
        priceText: price ? `¥${price}` : null,
      });
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      events.push(ev);
    }
  }
  return events;
}

export function makeBlueNoteJpCrawler({ clubId, host, siteUrl }) {
  return async function crawl(ctx = {}) {
    const now = new Date();
    const events = [];
    for (let i = 0; i < 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const ym = `${y}${String(m).padStart(2, '0')}`;
      try {
        events.push(...parseMonth(await fetchText(`https://${host}/reserve/schedule/move/${ym}`), y, m, clubId, siteUrl));
      } catch (err) {
        if (i === 0) throw err;
      }
      await sleep(400);
    }
    // rosters live on the artist pages; a run's dates share one page/fetch
    await enrichFromDetailPages(events.filter((e) => e.url !== siteUrl), ctx, {
      fields: ['personnel'],
      extract: parseArtistPage,
      maxPages: 12,
    });
    return events;
  };
}
