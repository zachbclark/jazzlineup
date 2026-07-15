// Vibrato Grill Jazz (2930 Beverly Glen Cir, Bel Air) — Herb Alpert's supper
// club. Squarespace events collection: /music?format=json -> { upcoming: […] }
// with startDate epoch ms. Same family as Bar Bayeux / LunÀtico, LA timezone.
import { fetchText, makeEvent, htmlToText, laDate, laTime, stripPromo, applyLateNight, parsePersonnel } from '../lib.js';

const BASE = 'https://www.vibratogrilljazz.com';
const URL_ = `${BASE}/music?format=json`;

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const it of j.upcoming ?? j.items ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const time = laTime(it.startDate);
    const plausible = time >= '16:00' || time < '02:00';
    const excerpt = htmlToText(it.excerpt ?? '');
    const personnel = parsePersonnel(excerpt);
    events.push(makeEvent(applyLateNight({
      clubId: 'vibrato',
      title: it.title,
      date: laDate(it.startDate),
      sets: plausible ? [time] : [],
      url: it.fullUrl ? BASE + it.fullUrl : `${BASE}/music`,
      details: personnel.length ? null : stripPromo(excerpt).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
