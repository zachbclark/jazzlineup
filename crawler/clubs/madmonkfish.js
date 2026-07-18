// The Mad Monkfish (524 Massachusetts Ave, Central Square) — sushi house
// with the Jazz Baroness Room (60 seats) and jazz nightly, plus midnight
// sessions. BentoBox site; /jazz-schedule/?p=N server-renders 10 cards per
// page (verified 2026-07-19):
//   <a class="card__btn" href="/event/SLUG/"
//      aria-label="7/24 Yoko Miwa Trio">           <- date + title, no year
//   aria-label="7/17 Midnight at the Mad Monkfish w/Mikayla Shirley 12-1am"
// Times, when present, ride the END of the title ("7pm", "(3pm-6pm)",
// "12-1am" — that last one is a true after-midnight set and gets the
// late-night shift). It's the JAZZ schedule — no filter.
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, inferYear, isoDate,
  cleanText, sleep, htmlToText, personnelFromLines,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const BASE = 'https://www.themadmonkfish.com';
const MAX_PAGES = 5;

// trailing time noise on titles: "7pm", "(3pm-6pm)", "12-1am"
const TIME_TAIL_RE = /\s*\(?(\d{1,2}(?::\d{2})?)\s*(?:-\s*\d{1,2}(?::\d{2})?\s*)?([ap]m)\)?\s*$/i;

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  const re = /<a[^>]*class="card__btn"[^>]*href="(\/event\/[^"]+)"[^>]*aria-label="(\d{1,2})\/(\d{1,2})\s+([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, href, monStr, dayStr] = m;
    let title = cleanText(m[4])
      .replace(/\s*\((?:mad monkfish )?concert series\)\s*$/i, '').trim();
    const sets = [];
    const t = title.match(TIME_TAIL_RE);
    if (t) {
      // "12-1am": the START (12am) is the show time; am/pm comes from the tail
      const time = normalizeTime(t[1] + t[2]);
      if (time) sets.push(time);
      title = cleanText(title.replace(TIME_TAIL_RE, ''));
    }
    if (!title) continue;
    const month = Number(monStr), day = Number(dayStr);
    if (!month || !day || month > 12 || day > 31) continue;
    const ev = makeEvent(applyLateNight({
      clubId: 'madmonkfish',
      title,
      date: isoDate(inferYear(month, day, today), month, day),
      sets,
      url: BASE + href,
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

// Detail pages carry the roster line-per-player ("Yoko Miwa, piano") and
// the real set times as prose: "1st Show: 7:00-8:15pm and 2nd Show:
// 8:45-10:00pm" — written without am/pm on the start time, so evening is
// assumed for hours below 11.
export function parseDetail(html) {
  const txt = htmlToText(html);
  const sets = [];
  for (const m of txt.matchAll(/\b(?:1st|2nd)\s+Show:\s*(\d{1,2}):(\d{2})/gi)) {
    let h = Number(m[1]);
    if (h < 11) h += 12;
    const t = `${String(h).padStart(2, '0')}:${m[2]}`;
    if (!sets.includes(t)) sets.push(t);
  }
  return { personnel: personnelFromLines(txt), sets: sets.sort() };
}

export async function crawl(ctx = {}) {
  const out = [];
  const seen = new Set();
  for (let p = 1; p <= MAX_PAGES; p++) {
    let added = 0;
    try {
      for (const e of parse(await fetchText(`${BASE}/jazz-schedule/?p=${p}`))) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
        added++;
      }
    } catch (err) {
      if (p === 1) throw err;
      break;
    }
    if (!added) break;
    await sleep(250);
  }
  await enrichFromDetailPages(out, ctx, {
    fields: ['personnel', 'sets'],
    extract: parseDetail,
    maxPages: 20,
  });
  return out;
}
