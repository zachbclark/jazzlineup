// 2220 Arts + Archives (2220 Beverly Blvd, Historic Filipinotown) — home of
// LA's creative/avant scene. Their own site is a Google Sites shell, so we
// read their DICE venue profile, a server-rendered Next.js page whose
// <script id="__NEXT_DATA__"> carries profile.sections[].events[]:
//   { name, perm_name, dates:{ event_start_date (ISO+offset), timezone },
//     about:{ description } }
// 2220 programs film + experimental + jazz; the room is curated enough that
// we take all listed events rather than keyword-filter (their jazz rarely
// says "jazz").
import { fetchText, makeEvent, htmlToText, splitIso, stripPromo } from '../lib.js';

const SLUG = '2220-arts--archives-bdyv';
const URL_ = `https://dice.fm/venue/${SLUG}`;

export function parse(html) {
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }
  const sections = data?.props?.pageProps?.profile?.sections ?? [];
  const events = [];
  for (const sec of sections) {
    for (const ev of sec?.events ?? []) {
      const start = ev?.dates?.event_start_date;
      if (!ev?.name || !start) continue;
      const { date, time } = splitIso(start); // offset-local ISO -> LA-local fields
      const desc = htmlToText(String(ev.about?.description ?? '').replace(/\*\*/g, ''));
      events.push(makeEvent({
        clubId: 'twentytwotwenty',
        title: ev.name.trim(),
        date,
        sets: time && time !== '00:00' ? [time] : [],
        url: ev.perm_name ? `https://dice.fm/event/${ev.perm_name}` : URL_,
        details: stripPromo(desc).slice(0, 300) || null,
      }));
    }
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
