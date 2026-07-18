// Sometime (吉祥寺サムタイム, Kichijoji) — basement institution since 1975,
// jazz nightly plus weekend matinees. Website-builder markup is span soup,
// but the RENDERED TEXT is perfectly regular (verified 2026-07-19):
//   07.01 wed 2set サキソフォビア 井上JUJUヒロシ（sax） 岡 淳（sax）... ✴︎Charge 3,000yen
//   07.04 sat 昼の部 2set 佐藤 達哉（sax） 瀬田 創太（p） ✴︎Charge2,000yen
// So: htmlToText the page, split on date markers, roster from the
// full-width parens, title = leading band name or else the leader. The
// year+month rides the page header ("2026.07"); /live.html is the current
// month and /liveYYYYMM.html the archive pattern — next month's page
// appears late in the month and 404s harmlessly until then.
import {
  fetchText, makeEvent, htmlToText, isoDate, cleanText, sleep, personnelFromJpRun,
} from '../lib.js';
import { applyRomaji, romajiPersonnel } from './_jpromaji.js';

const BASE = 'https://www.sometime.co.jp';
const URL_ = `${BASE}/sometime/live.html`;

export function parse(html) {
  const events = [];
  const seen = new Set();
  const txt = htmlToText(html).replace(/\n+/g, ' ');
  const ym = txt.match(/(\d{4})\.(\d{2})\s*LIVE SCHEDULE/i) ?? txt.match(/(\d{4})\.(\d{2})/);
  if (!ym) return events;
  const year = Number(ym[1]), month = Number(ym[2]);
  // one chunk per listing: from a "MM.DD dow" marker to the Charge line
  const re = /(\d{2})\.(\d{2})\s+(?:mon|tue|wed|thu|fri|sat|sun)\s+(昼の部\s+)?(?:\d?\s*set\s+)?([\s\S]*?)[✴︎*]*\s*Charge\s*([\d,]+)\s*yen/gi;
  let m;
  while ((m = re.exec(txt))) {
    const [, monStr, dayStr, matinee, body, price] = m;
    if (Number(monStr) !== month) continue; // stray text, not a listing
    const personnel = romajiPersonnel(personnelFromJpRun(body));
    // title: text before the first roster pair = band name; else the leader.
    // The roster parser trims run-on prefixes off its first name, so the
    // band name (if any) is whatever of the head the leader doesn't claim.
    let title = '';
    const firstParen = body.search(/[（(]/);
    if (firstParen > 0) {
      const head = cleanText(body.slice(0, firstParen));
      const leader = personnel[0]?.name ?? '';
      title = leader && head.endsWith(leader)
        ? cleanText(head.slice(0, head.length - leader.length))
        : head;
    }
    if (!title) title = personnel[0]?.name ?? cleanText(body.slice(0, 30));
    if (!title) continue;
    if (matinee) title += ' (昼の部)';
    const ev = makeEvent({
      clubId: 'sometimetok',
      title,
      titleAlt: applyRomaji(title) ?? undefined,
      date: isoDate(year, month, Number(dayStr)),
      sets: [],
      url: URL_,
      details: null,
      personnel,
      priceText: `¥${price}`,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  const out = [];
  const seen = new Set();
  for (const e of parse(await fetchText(URL_))) {
    if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
  }
  // next month's page exists only late in the month — 404 is fine
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const ym = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}`;
  try {
    await sleep(300);
    for (const e of parse(await fetchText(`${BASE}/sometime/live${ym}.html`))) {
      if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    }
  } catch { /* not published yet */ }
  return out;
}
