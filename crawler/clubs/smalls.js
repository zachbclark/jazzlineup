// Smalls + Mezzrow — smallslive.com. The site is jQuery-rendered but the data
// comes from a JSON endpoint: /search/upcoming-ajax/?page=N which returns
// { template: "<html>", page_range: [...] }. The template HTML is structured:
//   .day-list > .title1 (e.g. "Mon Jul 13")
//   .day-list > .venue-group > (.smalls-color|.mezzrow-color) venue label
//   .venue-group > .day-event > .text-grey (times) + .day_event_title + <a href>
import {
  fetchText, makeEvent, matchBlocks, htmlToText, extractTimes,
  monthNum, inferYear, isoDate, sleep, cleanText,
} from '../lib.js';

const BASE = 'https://www.smallslive.com';

function venueOf(groupHtml) {
  if (/smalls-color/.test(groupHtml)) return 'smalls';
  if (/mezzrow-color/.test(groupHtml)) return 'mezzrow';
  if (/jazzcultural-color/.test(groupHtml)) return 'jazzcultural';
  return null;
}

export function parsePage(templateHtml, today = new Date()) {
  const events = [];
  for (const day of matchBlocks(templateHtml, 'div', /class="[^"]*\bday-list\b/)) {
    const titleBlock = matchBlocks(day, 'div', /class="[^"]*\btitle1\b/)[0] ?? '';
    const m = htmlToText(titleBlock).match(/([A-Za-z]{3,})\s+(\d{1,2})/); // "Mon Jul 13" or "Jul 13"
    let mo, dd;
    const parts = htmlToText(titleBlock).match(/([A-Za-z]+)\s+(\d{1,2})/g) ?? [];
    for (const p of parts) {
      const [, name, num] = p.match(/([A-Za-z]+)\s+(\d{1,2})/);
      if (monthNum(name)) { mo = monthNum(name); dd = Number(num); break; }
    }
    if (!mo) continue;
    const date = isoDate(inferYear(mo, dd, today), mo, dd);

    for (const group of matchBlocks(day, 'div', /class="[^"]*\bvenue-group\b/)) {
      const clubId = venueOf(group);
      if (!clubId) continue;
      for (const ev of matchBlocks(group, 'div', /class="[^"]*\bday-event\b/)) {
        const timeText = htmlToText(matchBlocks(ev, 'div', /class="[^"]*\btext-grey\b/)[0] ?? '');
        const title = htmlToText(matchBlocks(ev, 'div', /class="[^"]*\bday_event_title\b/)[0] ?? '');
        if (!title) continue;
        const href = (ev.match(/href="([^"]+)"/) ?? [])[1];
        // "6:00 PM & 7:30 PM"  -> two sets
        // "11:45 PM - 4:00 AM" -> ONE set at the start; the end becomes
        // "until 4:00 AM" (otherwise the end time pollutes sets and sorts
        // the event to the top of the day).
        const range = timeText.match(/^(.+?)\s*[-–]\s*(.+)$/);
        const sets = range ? extractTimes(range[1]) : extractTimes(timeText);
        const details = range ? `until ${range[2].trim()}` : null;
        events.push(makeEvent({
          clubId,
          title,
          date,
          sets,
          url: href ? BASE + href.split('?')[0] : BASE,
          details,
        }));
      }
    }
  }
  return events;
}

// Each event page lists the band as <a class="artist-link">Name / Instrument</a>
// inside <div class="event-band">.
export function parseEventPersonnel(pageHtml) {
  const band = matchBlocks(pageHtml, 'div', /class="[^"]*\bevent-band\b/)[0] ?? '';
  const personnel = [];
  for (const m of band.matchAll(/<a[^>]*class="[^"]*artist-link[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const [name, instrument] = htmlToText(m[1]).split('/').map((x) => cleanText(x));
    if (name && instrument) personnel.push({ name, instrument: instrument.toLowerCase() });
  }
  return personnel;
}

// Personnel come from event detail pages, which is expensive — so reuse
// first, fetch second:
//  1. copy personnel from the PREVIOUS crawl for events whose id already
//     had them (ids are stable: clubId:date:slug)
//  2. fetch pages only for events still missing personnel, nearest dates
//     first, capped per crawl — over a few 4-hour cycles the whole listing
//     window converges to fully enriched, with steady-state fetches limited
//     to newly announced shows.
// Regression that drove this (2026-07-16): Mark Turner in Kurt Rosenwinkel's
// Next Step Band was invisible to search because his date sat beyond the old
// 12-day enrichment horizon.
const ENRICH_CONCURRENCY = 4;
const ENRICH_MAX_PAGES = 120;
const LISTING_MAX_PAGES = 8; // paginated month listing, not event pages

// Pure + exported for tests: copy prior personnel onto matching event ids.
export function reusePersonnel(events, previousEvents = []) {
  const prior = new Map(
    previousEvents.filter((e) => e.personnel?.length).map((e) => [e.id, e.personnel])
  );
  for (const e of events) {
    if (!e.personnel && prior.has(e.id)) e.personnel = prior.get(e.id);
  }
  return events;
}

async function enrichPersonnel(events) {
  const urls = [...new Set(
    events
      .filter((e) => !e.personnel && e.url?.includes('/events/'))
      .sort((a, b) => a.date.localeCompare(b.date)) // nearest nights first
      .map((e) => e.url)
  )].slice(0, ENRICH_MAX_PAGES);

  const byUrl = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: ENRICH_CONCURRENCY }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        const personnel = parseEventPersonnel(await fetchText(url));
        if (personnel.length) byUrl.set(url, personnel);
      } catch { /* skip */ }
      await sleep(150);
    }
  }));

  for (const e of events) {
    const p = byUrl.get(e.url);
    if (p) e.personnel = p;
  }
  return events;
}

export async function crawl(ctx = {}) {
  const events = [];
  let pageRange = [1];
  for (let page = 1; page <= Math.min(LISTING_MAX_PAGES, Math.max(...pageRange)); page++) {
    const body = await fetchText(`${BASE}/search/upcoming-ajax/?page=${page}`, {
      headers: { 'x-requested-with': 'XMLHttpRequest', accept: 'application/json' },
    });
    const j = JSON.parse(body);
    if (Array.isArray(j.page_range) && j.page_range.length) pageRange = j.page_range;
    events.push(...parsePage(j.template ?? ''));
    await sleep(500); // be polite
  }
  return enrichPersonnel(reusePersonnel(events, ctx.previousEvents ?? []));
}
