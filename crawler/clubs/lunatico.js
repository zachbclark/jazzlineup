// Bar LunÀtico — Squarespace; /calendar?format=json returns the events
// collection as { items: [...] } with startDate epoch ms (includes a time,
// though not always a meaningful one) + title + fullUrl + excerpt.
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, parsePersonnel } from '../lib.js';

const BASE = 'https://www.barlunatico.com';
const URL_ = `${BASE}/calendar?format=json`;

export function parse(jsonText, today = new Date()) {
  const j = JSON.parse(jsonText);
  const cutoff = nyDate(today.getTime() - 86400000); // keep from yesterday on
  const events = [];
  for (const it of j.items ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const date = nyDate(it.startDate);
    if (date < cutoff) continue;
    // Squarespace startDate carries a time; only trust plausible show times.
    const time = nyTime(it.startDate);
    const plausible = time >= '16:00' && time <= '23:59';
    const excerpt = htmlToText(it.excerpt ?? '');
    const personnel = parsePersonnel(excerpt);
    events.push(makeEvent({
      clubId: 'lunatico',
      title: it.title,
      date,
      sets: plausible ? [time] : [],
      url: BASE + (it.fullUrl ?? '/music'),
      details: personnel.length ? null : stripPromo(excerpt).slice(0, 300) || null,
      personnel,
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
