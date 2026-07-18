// Shinjuku Pit Inn (新宿ピットイン, Accord Bldg B1, Shinjuku) — Tokyo's
// hard-core jazz room since 1965, the Village Vanguard of Japan. Plain-HTTP
// WordPress (https is broken — keep http). Server-rendered schedule pages:
//   /schedule        this month, night division (夜の部)
//   /next-schedule   next month, night
//   /schedule-day    this month, afternoon division (昼の部)
// Markup per show (verified 2026-07-19):
//   <div class="day_box"><ul class="day_bar"><li class="date"> 7/2</li>...
//     <div class="day_name">菊地成孔 クインテット</div>
//     <div class="day_title">チケット売り切れ</div>       <- status line
//     <div class="day_open"> Open 19:00 /</div>
//     <div class="day_start"> Start 19:30</div>
//     <div class="day_member">菊地成孔(Sax,Vo)林 正樹(P)...</div>
//     <a href="http://pit-inn.com/artist_live_info/260701kikuchi/">
// Rosters on nearly every show -> personnel gold. All jazz — no filter.
import {
  fetchText, makeEvent, matchBlocks, htmlToText, inferYear, isoDate,
  cleanText, sleep, personnelFromJpRun,
} from '../lib.js';
import { applyRomaji, romajiPersonnel } from './_jpromaji.js';

const BASE = 'http://pit-inn.com';
const PAGES = ['/schedule', '/next-schedule', '/schedule-day'];

export function parse(html, today = new Date()) {
  const events = [];
  const seen = new Set();
  for (const box of matchBlocks(html, 'div', /class="day_box"/)) {
    const dm = htmlToText(matchBlocks(box, 'li', /class="date"/)[0] ?? '').match(/(\d{1,2})\/(\d{1,2})/);
    if (!dm) continue;
    const month = Number(dm[1]), day = Number(dm[2]);
    const title = cleanText(htmlToText(matchBlocks(box, 'div', /class="day_name"/)[0] ?? ''));
    if (!title) continue;
    const start = (htmlToText(matchBlocks(box, 'div', /class="day_start"/)[0] ?? '').match(/(\d{1,2}:\d{2})/) ?? [])[1];
    const status = cleanText(htmlToText(matchBlocks(box, 'div', /class="day_title"/)[0] ?? ''));
    const url = (box.match(/href="(https?:\/\/pit-inn\.com\/artist_live_info\/[^"]+)"/) ?? [])[1];
    const members = htmlToText(matchBlocks(box, 'div', /class="day_member"/)[0] ?? '');
    const personnel = romajiPersonnel(personnelFromJpRun(members));
    const ev = makeEvent({
      clubId: 'pitinn',
      title,
      titleAlt: applyRomaji(title) ?? undefined,
      date: isoDate(inferYear(month, day, today), month, day),
      sets: start ? [start] : [],
      url: url ?? `${BASE}/schedule`,
      details: /売り切れ/.test(status) ? 'Sold out' : null,
      personnel,
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
  for (const [i, page] of PAGES.entries()) {
    try {
      for (const e of parse(await fetchText(BASE + page))) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    } catch (err) {
      if (i === 0) throw err; // this-month page failing = real problem
    }
    await sleep(300);
  }
  return out;
}
