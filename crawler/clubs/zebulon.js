// Zebulon (2478 Fletcher Dr, Frogtown) — the Brooklyn-transplant room whose
// bookings run rock/experimental/jazz. Their events page embeds the DICE
// Event List Widget, whose (published, client-side) API key we reuse against
// the same partners endpoint the widget calls:
//   GET https://partners-endpoint.dice.fm/api/v2/events?page[size]=100
//       &filter[venues][]=Zebulon           (x-api-key: <key from their page>)
// -> { data: [{ name, date (UTC ISO), timezone, url, description }] }
// Mixed-genre bookings, so jazz-keyword filter applies (JCAL/Mint policy).
// If the key ever rotates, re-read it from https://zebulon.la/ page source.
import { fetchText, makeEvent, htmlToText, tzDate, tzTime, applyLateNight, stripPromo } from '../lib.js';

const SITE = 'https://zebulon.la/';
const API = 'https://partners-endpoint.dice.fm/api/v2/events?page%5Bsize%5D=100&filter%5Bvenues%5D%5B%5D=Zebulon';
const KEY_RE = /apiKey["'\s:]+["']([A-Za-z0-9]+)["']/;
const JAZZ_RE = /\bjazz|be-?bop|hard bop|improvis|quartet|quintet|trio|big band|free improvisation|spiritual\b/i;

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.data ?? []) {
    if (!ev?.name || !ev?.date) continue;
    const desc = htmlToText(String(ev.description ?? '').replace(/\*\*/g, ''));
    if (!JAZZ_RE.test(`${ev.name} ${desc.slice(0, 800)}`)) continue;
    const tz = ev.timezone || 'America/Los_Angeles';
    events.push(makeEvent(applyLateNight({
      clubId: 'zebulon',
      title: ev.name.trim(),
      date: tzDate(ev.date, tz),
      sets: [tzTime(ev.date, tz)],
      url: ev.url ?? SITE,
      details: stripPromo(desc).slice(0, 300) || null,
    })));
  }
  return events;
}

export async function crawl() {
  // The widget key lives in their page source; fetch it fresh each crawl so
  // a rotation doesn't silently break us.
  const page = await fetchText(SITE);
  const key = page.match(KEY_RE)?.[1];
  if (!key) throw new Error('zebulon: DICE widget apiKey not found on page');
  return parse(await fetchText(API, { headers: { 'x-api-key': key, accept: 'application/json' } }));
}
