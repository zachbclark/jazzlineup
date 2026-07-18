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
// Times aren't in this view — sets stay empty (their shows are 2 seatings;
// detail-page enrichment is a future pass). Titles are mostly roman.
import {
  fetchText, makeEvent, htmlToText, isoDate, cleanText, sleep,
} from '../lib.js';
import { applyRomaji } from './_jpromaji.js';

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
    for (const day of days) {
      const ev = makeEvent({
        clubId,
        title,
        titleAlt: applyRomaji(title) ?? undefined,
        date: isoDate(year, month, day),
        sets: [],
        url: siteUrl,
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
  return async function crawl() {
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
    return events;
  };
}
