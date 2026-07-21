// SEEDS (617 Vanderbilt Ave, Prospect Heights) — musician-run creative-music
// space. Their /calendar/ embeds a Tockify calendar (calname seeds.calendar),
// same public API as The World Stage:
//   GET https://tockify.com/api/ngevent?max=60&calname=seeds.calendar
// Descriptions carry dash rosters ("Joel Ross - Vibraphone, Synths ...").
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, parsePersonnel, applyLateNight } from '../lib.js';

const API = 'https://tockify.com/api/ngevent?max=60&calname=seeds.calendar';
const SITE = 'https://seedsbrooklyn.org/calendar/';

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    const ms = ev?.when?.start?.millis;
    const title = ev?.content?.summary?.text;
    if (!ms || !title) continue;
    const time = nyTime(ms);
    const desc = htmlToText(ev.content?.description?.text ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId: 'seeds',
      title,
      date: nyDate(ms),
      sets: time >= '10:00' || time < '02:00' ? [time] : [],
      url: ev.eid?.uid ? `https://tockify.com/seeds.calendar/detail/${ev.eid.uid}/${ms}` : SITE,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(API, { headers: { accept: 'application/json' } }));
}
