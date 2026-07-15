// Terraza 7 (40-19 Gleane St, Elmhurst, Queens) — Latin jazz / Andean /
// world sanctuary with performances nearly nightly. Wix Events site: the
// homepage warmup data carries the event objects (same platform as Sam
// First). Sets arrive as separate events titled "… | First Set" /
// "… | Second Set" — we merge them.
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, applyLateNight, stripPromo } from '../lib.js';
import { wixWarmupEvents } from './_wixevents.js';

const BASE = 'https://www.terraza7.com';

const SET_SUFFIX = /\s*\|?\s*(?:first|second|third|1st|2nd|3rd)\s+set\s*$/i;

export function parse(html) {
  const grouped = new Map();
  for (const ev of wixWarmupEvents(html)) {
    const start = ev.scheduling?.config?.startDate;
    if (!start || !ev.title) continue;
    const date = nyDate(start);
    const title = ev.title.replace(SET_SUFFIX, '').trim();
    const key = `${date}:${title.toLowerCase()}`;
    if (!grouped.has(key)) {
      const desc = htmlToText(ev.description ?? ev.about ?? '');
      grouped.set(key, {
        clubId: 'terraza7',
        title,
        date,
        sets: [],
        // their Wix events have no per-event detail pages — link the listing
        url: `${BASE}/events`,
        details: stripPromo(desc).slice(0, 300) || null,
      });
    }
    grouped.get(key).sets.push(nyTime(start));
  }
  return [...grouped.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/events`));
}
