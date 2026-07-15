// Winter's Jazz Club (465 N McClurg Ct, Streeterville) — straight-ahead
// listening room steps off the Mag Mile. Wix site with the real Wix Events
// app; the homepage embeds full event objects in <script
// id="wix-warmup-data"> (see _wixevents.js). All jazz — no filter.
import {
  fetchText, makeEvent, chiDate, chiTime, applyLateNight, htmlToText,
  stripPromo, parsePersonnel,
} from '../lib.js';
import { wixWarmupEvents } from './_wixevents.js';

const BASE = 'https://www.wintersjazzclub.com';

export function parse(html) {
  const events = [];
  for (const ev of wixWarmupEvents(html)) {
    const start = ev.scheduling?.config?.startDate;
    if (!start || !ev.title) continue;
    const desc = htmlToText(ev.description ?? ev.about ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId: 'winters',
      title: ev.title,
      date: chiDate(start),
      sets: [chiTime(start)],
      url: ev.slug ? `${BASE}/events/${ev.slug}` : BASE,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(BASE));
}
