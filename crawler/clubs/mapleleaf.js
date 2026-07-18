// Maple Leaf Bar (8316 Oak St, Uptown) — fifty funkin' years, home of the
// Rebirth Brass Band's eternal Tuesday. Wix; the shared warmup-data
// extractor (Sam First, Terraza 7) works unchanged.
import { fetchText, makeEvent, applyLateNight, cleanText, tzDate, tzTime } from '../lib.js';
import { wixWarmupEvents } from './_wixevents.js';

const URL_ = 'https://www.mapleleafbar.com/calendar';

export function parse(html) {
  const events = [];
  const seen = new Set();
  for (const item of wixWarmupEvents(html)) {
    const start = item.scheduling?.config?.startDate;
    if (!item.title || !start) continue;
    const ev = makeEvent(applyLateNight({
      clubId: 'mapleleaf',
      title: cleanText(item.title),
      date: tzDate(start, 'America/Chicago'),
      sets: [tzTime(start, 'America/Chicago')].filter(Boolean),
      url: item.slug ? `https://www.mapleleafbar.com/event-details/${item.slug}` : URL_,
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
