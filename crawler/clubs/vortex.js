// Vortex Jazz Club (11 Gillett Square, Dalston) — London's serious
// listening room, the European improv axis. Their Events Calendar install
// hides its REST API but publishes a clean 50-event iCal feed; see _ics.js.
// All jazz — no filter.
import { fetchText, makeEvent, applyLateNight, htmlToText, stripPromo, parsePersonnel, cleanText } from '../lib.js';
import { parseIcs } from './_ics.js';

const BASE = 'https://www.vortexjazz.co.uk';
const FEED = `${BASE}/events/?ical=1`;
const TZ = 'Europe/London';

export function parse(icsText) {
  const events = [];
  for (const ev of parseIcs(icsText, { defaultTz: TZ })) {
    if (!ev.summary || !ev.date) continue;
    const desc = htmlToText(ev.description);
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId: 'vortex',
      title: cleanText(ev.summary),
      date: ev.date,
      sets: ev.time && ev.time !== '00:00' ? [ev.time] : [],
      url: ev.url ?? `${BASE}/events/`,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(FEED, { headers: { accept: 'text/calendar,*/*;q=0.8' } }));
}
