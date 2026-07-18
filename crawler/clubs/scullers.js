// Scullers Jazz Club (400 Soldiers Field Rd, in the DoubleTree by the
// Charles) — Boston's touring-act room since 1989; DownBeat "best
// international jazz venue" lister. Their own site's calendar is just a
// MusicIDB iframe, so we crawl the widget host directly. It serves
// server-rendered <li class="... listEvent ..."> blocks (verified
// 2026-07-19):
//   <h3 class="date"><span class="monthName dayNameAbb">Thu</span>
//     <span class="monthName">Sep</span> <span class="dayNum">10</span>
//     <span class="yearNum">2026</span></h3>
//   ... <h3 class="titleofevent"><a ...> TITLE </a></h3>
// The widget lists PAST shows too — callers downstream ignore old dates.
// MusicIDB was flaky even to a real browser, so a browser-captured seed
// backs it up (scullers-seed.js). All jazz — no filter.
import { fetchText, makeEvent, matchBlocks, htmlToText, monthNum, isoDate, cleanText } from '../lib.js';
import { SEED } from './scullers-seed.js';

const WIDGET = 'https://musicidb.com/venue/getVenueDetailFrame.htm?venueId=715&showHead=false&showEvents=true&showGigs=true';
const SITE = 'https://scullersjazz.com/calendar/';

// promo prefixes MusicIDB listings wear ("10-TIME GRAMMY AWARD WINNER ...")
const HYPE_RE = /^(?:\d+[- ]TIME\s+)?GRAMMY(?:\s+AWARD)?(?:\s+WINNER|\s+NOMINATED)?\s+|\s*\(on sale now\)/gi;

export function parse(html) {
  const events = [];
  const seen = new Set();
  for (const li of matchBlocks(html, 'li', /class="[^"]*listEvent/)) {
    const mon = monthNum((li.match(/<span class="monthName">\s*([A-Za-z]+)\s*</) ?? [])[1]);
    const day = Number((li.match(/<span class="dayNum">\s*(\d{1,2})\s*</) ?? [])[1]);
    const year = Number((li.match(/<span class="yearNum">\s*(\d{4})\s*</) ?? [])[1]);
    if (!mon || !day || !year) continue;
    const titleHtml = matchBlocks(li, 'h3', /class="titleofevent"/)[0] ?? '';
    const title = cleanText(htmlToText(titleHtml).split('\n')[0].replace(HYPE_RE, ' '));
    if (!title) continue;
    const ev = makeEvent({
      clubId: 'scullers',
      title,
      date: isoDate(year, mon, day),
      sets: [], // summary view carries no times
      url: SITE,
      details: null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export function seedEvents(today = new Date()) {
  const cutoff = today.toISOString().slice(0, 10);
  return SEED.filter(([, date]) => date >= cutoff).map(([title, date]) =>
    makeEvent({ clubId: 'scullers', title, date, sets: [], url: SITE, details: null }));
}

export async function crawl() {
  try {
    const events = parse(await fetchText(WIDGET, { timeoutMs: 45000 }));
    if (events.length) return events;
  } catch { /* fall through to seed */ }
  return seedEvents();
}
