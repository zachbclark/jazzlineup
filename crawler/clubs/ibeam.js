// Ibeam Brooklyn (168 7th St, Gowanus) — musician-run improv space.
// Squarespace: /home?format=json returns { upcoming: [...] } (note: NOT
// items — the collection is a blog whose upcoming/past split matters).
// The post body is the program: per-set times as bare "7 pm" lines, then
// line-per-player rosters ("Kris Gruda - Guitar"), then a "$20" line.
import { fetchText, makeEvent, htmlToText, nyDate, nyTime, stripPromo, personnelFromLines, applyLateNight } from '../lib.js';

const BASE = 'https://ibeambrooklyn.com';
const URL_ = `${BASE}/home?format=json`;

export function parse(jsonText, today = new Date()) {
  const j = JSON.parse(jsonText);
  const cutoff = nyDate(today.getTime() - 86400000);
  const events = [];
  for (const it of j.upcoming ?? j.items ?? []) {
    if (!it?.title || !it?.startDate) continue;
    const date = nyDate(it.startDate);
    if (date < cutoff) continue;
    const body = htmlToText(it.body ?? '');
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    // bare "7 pm" / "8:30 pm" lines are the set times
    const sets = [];
    for (const l of lines) {
      const t = l.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
      if (!t) continue;
      let h = Number(t[1]) % 12;
      if (t[3].toLowerCase() === 'pm') h += 12;
      sets.push(`${String(h).padStart(2, '0')}:${t[2] ?? '00'}`);
    }
    const startTime = nyTime(it.startDate);
    const plausible = startTime >= '16:00' || startTime < '02:00';
    const personnel = personnelFromLines(body);
    const priceText = lines.find((l) => /^\$\d+/.test(l))?.match(/^\$\d+(?:\.\d{2})?/)?.[0] ?? null;
    events.push(makeEvent(applyLateNight({
      clubId: 'ibeam',
      title: it.title,
      date,
      sets: sets.length ? sets : (plausible ? [startTime] : []),
      url: BASE + (it.fullUrl ?? '/home'),
      details: personnel.length ? null : stripPromo(body).slice(0, 300) || null,
      personnel,
      priceText,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
