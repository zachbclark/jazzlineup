// Alfie (六本木 JAZZ HOUSE alfie, Roppongi) — Chako's listening room since
// 1980, one band nightly. Hand-written monthly pages at
// /schedule/YYYYMM.html (and /schedule/ for the current month); the text is
// regular (verified 2026-07-19):
//   開店:18:45、演奏:19:15~20:45、閉店:23:30
//   1 (wed) [jazz] Ayuko(vo) 松原慶史(g) 高橋佳輝(eb) 塚田陽太(ds) ￥5500
//   6 (mon) close
//   8 (wed) [world] SAYAKA(vln) Carlos Cespedes(vo,g) ... ￥5500
// Genre tags ride the listings ([jazz]/[world]/[latin]...); all kept — the
// room is jazz-first — with non-jazz tags noted in details. The house set
// time is parsed from the header line, not assumed.
import {
  fetchText, makeEvent, htmlToText, isoDate, cleanText, sleep, personnelFromJpRun,
} from '../lib.js';
import { applyRomaji, romajiPersonnel } from './_jpromaji.js';

const BASE = 'https://alfie.tokyo';

export function parse(html, year, month) {
  const events = [];
  const seen = new Set();
  const txt = htmlToText(html).replace(/\n+/g, ' ')
    // drop close-day entries BEFORE matching: a lazy body would otherwise
    // swallow the next real listing along with the "close"
    .replace(/\d{1,2}\s*\((?:mon|tue|wed|thu|fri|sat|sun)\)\s*close/gi, ' ');
  const houseStart = (txt.match(/演奏\s*[:：]\s*(\d{1,2}:\d{2})/) ?? [])[1] ?? null;
  const re = /(?:^|\s)(\d{1,2})\s*\((?:mon|tue|wed|thu|fri|sat|sun)\)\s*(?:\[(\w+)\]\s*)?([\s\S]*?)[￥¥]\s*([\d,]+)/gi;
  let m;
  while ((m = re.exec(txt))) {
    const [, dayStr, genre, body, price] = m;
    const day = Number(dayStr);
    if (!day || day > 31) continue;
    const personnel = romajiPersonnel(personnelFromJpRun(body));
    // quoted band name leads the body when there is one
    const quoted = body.match(/^\s*[“"']([^”"']{2,60})[”"']/);
    let title = quoted ? cleanText(quoted[1]) : '';
    if (!title) title = personnel[0]?.name ?? cleanText(body.slice(0, 30));
    if (!title) continue;
    const ev = makeEvent({
      clubId: 'alfie',
      title,
      titleAlt: applyRomaji(title) ?? undefined,
      date: isoDate(year, month, day),
      sets: houseStart ? [houseStart] : [],
      url: `${BASE}/schedule/`,
      details: genre && !/jazz/i.test(genre) ? `[${genre}]` : null,
      personnel,
      priceText: `¥${Number(price.replace(/,/g, '')).toLocaleString()}`,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  const now = new Date();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear(), mo = d.getMonth() + 1;
    const ym = `${y}${String(mo).padStart(2, '0')}`;
    try {
      for (const e of parse(await fetchText(`${BASE}/schedule/${ym}.html`), y, mo)) {
        if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
      }
    } catch (err) {
      if (i === 0) throw err; // next month may not exist yet
    }
    await sleep(300);
  }
  return out;
}
