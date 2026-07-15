// The World Stage (4321 Degnan Blvd, Leimert Park) — the legendary
// performance/education space co-founded by Billy Higgins. Their events page
// embeds a Tockify calendar, whose public API serves clean JSON:
//   GET https://tockify.com/api/ngevent?max=60&calname=the.world.stage
// -> { events: [{ eid:{uid}, when:{ start:{ millis, tzid } }, content:{
//      summary:{text}, description:{text} } }] }
import { fetchText, makeEvent, htmlToText, laDate, laTime, stripPromo, applyLateNight } from '../lib.js';

const API = 'https://tockify.com/api/ngevent?max=60&calname=the.world.stage';
const SITE = 'https://www.theworldstage.org/events.html';

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const ev of j.events ?? []) {
    const ms = ev?.when?.start?.millis;
    const title = ev?.content?.summary?.text;
    if (!ms || !title) continue;
    const time = laTime(ms);
    const desc = htmlToText(ev.content?.description?.text ?? '');
    events.push(makeEvent(applyLateNight({
      clubId: 'worldstage',
      title,
      date: laDate(ms),
      sets: time >= '10:00' || time < '02:00' ? [time] : [],
      url: ev.eid?.uid ? `https://tockify.com/the.world.stage/detail/${ev.eid.uid}/${ms}` : SITE,
      details: stripPromo(desc).slice(0, 300) || null,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(API, { headers: { accept: 'application/json' } }));
}
