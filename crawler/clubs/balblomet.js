// Le Bal Blomet (33 rue Blomet, 15e) — the 1924 "Bal Nègre" ballroom where
// Paris first danced to biguine, reborn as a cabaret and jazz room.
// WordPress with the Eventer plugin; the /agenda page server-renders items
// and honors term filters in the URL, so we ask for the jazz family only:
//   /agenda/?terms_cats=59,60,63   (59 Jazz · 60 Jazz Manouche · 63 Improvisation)
// Their classical, tango, and film-music cabaret stays out (jazz EVENTS,
// not jazz venues). Items carry the date twice: in the visible text
// ("10-09-2026 20:00") and in the link (/evenement/<slug>/edate/YYYY-MM-DD).
import {
  fetchText, makeEvent, applyLateNight, cleanText, matchBlocks, htmlToText,
  personnelFromLines,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const BASE = 'https://www.balblomet.fr';
const JAZZ_CATS = '59,60,63'; // term ids seen 2026-07-16; comment in sync with filter UI
const URL_ = `${BASE}/agenda/?terms_cats=${encodeURIComponent(JAZZ_CATS)}`;

export function parse(html) {
  const events = [];
  const seen = new Set();
  // matchBlocks handles the nested <li>s inside each item's share widget
  const items = matchBlocks(html, 'li', /class="[^"]*\beventer-event-item\b/);
  for (const item of items) {
    const link = item.match(/href="(https?:\/\/www\.balblomet\.fr\/evenement\/[^"]+\/edate\/(\d{4}-\d{2}-\d{2}))"/i);
    const title = (item.match(/<span class="eventer-event-title">([\s\S]*?)<\/span>/i) ?? [])[1];
    if (!link || !title) continue;
    const time = (item.match(/\d{2}-\d{2}-\d{4}\s+(\d{2}:\d{2})/) ?? [])[1];
    const ev = makeEvent(applyLateNight({
      clubId: 'balblomet',
      title: cleanText(title.replace(/<[^>]+>/g, ' ')),
      date: link[2],
      sets: time ? [time] : [],
      url: link[1],
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

// Event pages open with a dash roster right above the program note
// (verified 2026-07-18):
//   Paul Lay – piano
//   Baptiste Herbin – saxophone
//   Tea for Two réunit deux figures exceptionnelles du jazz français…
// personnelFromLines picks the roster (strict: whole right side must be
// instrument words, 2+ players); the first long prose line becomes details.
export function parseDetail(html) {
  const text = htmlToText(html);
  const personnel = personnelFromLines(text);
  const prose = text.split('\n').map((l) => l.trim())
    .find((l) => l.length > 80 && !/@|©|\bhttp/i.test(l));
  return {
    personnel: personnel.length ? personnel : null,
    details: prose ? cleanText(prose).slice(0, 300) : null,
  };
}

export async function crawl(ctx = {}) {
  const events = parse(await fetchText(URL_));
  await enrichFromDetailPages(events, ctx, {
    fields: ['personnel', 'details'],
    extract: parseDetail,
    // a residency's dates share one page — the /edate/ suffix only picks the
    // night (the Django ?selected_date precedent)
    urlKey: (url) => url.split('/edate/')[0],
  });
  return events;
}
