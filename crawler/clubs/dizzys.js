// Dizzy's Club (Jazz at Lincoln Center) — jazz.org/dizzys server-renders the
// season list: .concert blocks with .concert--date ("Jul 13", "Jul 17-19",
// "Jul 29 - Aug 2"), a title, and a ticketing.jazz.org link.
// Set times are house-standard: Mon-Sat 7:00 & 9:00 PM, Sunday 5:00 & 7:30 PM.
// The ticketing.jazz.org detail pages are server-rendered too (verified
// 2026-07-16) and carry a "PERFORMANCE LINEUP" roster — "Charles McPherson,
// alto saxophone<br>…" — plus real prose between the Description and lineup
// headings. A residency shares one ticketing page, so one fetch enriches
// the whole run.
import {
  fetchText, makeEvent, matchBlocks, htmlToText,
  monthNum, inferYear, isoDate, cleanText, personnelFromLines,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const URL_ = 'https://jazz.org/dizzys/';

export function parseDetail(html) {
  const txt = htmlToText(html);
  const dm = txt.match(/Description\s*\n([\s\S]*?)\n\s*PERFORMANCE LINEUP/i);
  return {
    personnel: personnelFromLines(txt),
    details: dm ? cleanText(dm[1]).slice(0, 300) || null : null,
  };
}

function setsFor(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? ['17:00', '19:30'] : ['19:00', '21:00'];
}

// "Jul 13" | "Jul 17-19" | "Jul 29 - Aug 2" -> [startIso, endIso]
export function parseDateRange(text, today = new Date()) {
  const m = text.match(/([A-Za-z]{3,})\s+(\d{1,2})(?:\s*[-–]\s*(?:([A-Za-z]{3,})\s+)?(\d{1,2}))?/);
  if (!m || !monthNum(m[1])) return null;
  const m1 = monthNum(m[1]);
  const d1 = Number(m[2]);
  const y1 = inferYear(m1, d1, today);
  if (!m[4]) { const iso = isoDate(y1, m1, d1); return [iso, iso]; }
  const m2 = m[3] ? monthNum(m[3]) : m1;
  const d2 = Number(m[4]);
  const y2 = m2 < m1 ? y1 + 1 : y1;
  return [isoDate(y1, m1, d1), isoDate(y2, m2, d2)];
}

export function parse(html, today = new Date()) {
  const events = [];
  for (const c of matchBlocks(html, 'div', /class="[^"]*\bconcert\b(?!-)/)) {
    const dateText = htmlToText(matchBlocks(c, 'div', /class="[^"]*\bconcert--date\b/)[0] ?? '');
    const range = parseDateRange(dateText, today);
    if (!range) continue;

    const titleBlock = matchBlocks(c, 'div', /class="[^"]*\bconcert--title\b/)[0];
    let title = titleBlock ? htmlToText(titleBlock) : htmlToText(c).replace(dateText, '').replace(/GET TICKETS.*/i, '').trim();
    if (!title) continue;

    const href = (c.match(/href="(https?:\/\/ticketing\.jazz\.org[^"]*)"/) ?? [])[1];

    let [d, end] = range;
    for (let i = 0; d <= end && i < 10; i++) {
      events.push(makeEvent({
        clubId: 'dizzys',
        title,
        date: d,
        sets: setsFor(d),
        url: href ? href.split('?')[0] : URL_,
      }));
      const [y, mo, dd] = d.split('-').map(Number);
      const nx = new Date(Date.UTC(y, mo - 1, dd + 1));
      d = isoDate(nx.getUTCFullYear(), nx.getUTCMonth() + 1, nx.getUTCDate());
    }
  }
  return events;
}

export async function crawl(ctx = {}) {
  const events = parse(await fetchText(URL_), ctx.today ?? new Date());
  await enrichFromDetailPages(
    events.filter((e) => e.url !== URL_), // only events with a ticketing page
    ctx,
    { fields: ['personnel', 'details'], extract: parseDetail, maxPages: 30 },
  );
  return events;
}
