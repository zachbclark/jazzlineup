// Quasimodo (Kantstraße 12A, Charlottenburg) — the cellar under the
// Delphi cinema, booking jazz/blues/funk since the 70s. Mixed-genre room:
// disco and 80s parties share the calendar, so we TRUST THEIR GENRE TAGS
// (the DICE lesson) — quasimodo.club runs WordPress Events Manager and
// publishes tag archive pages that reuse the same a.event-item markup
// (verified 2026-07-18):
//   <a class="event-item" href="https://quasimodo.club/events/<slug>">
//     <div class="event-data visible-xs"><div class="date">20.11.2026 - 22:00</div></div>
//     <h4 class="event-title">Jazz Night ft. Flow Rea (Est)</h4>
// Numeric dd.mm.yyyy dates — no German month names to parse. We union the
// jazz-family tag pages; a title-keyword rescue over the full /events list
// catches brass/blues bookings the tags miss.
import { fetchText, makeEvent, cleanText, htmlToText, sleep } from '../lib.js';

const BASE = 'https://quasimodo.club';
const TAG_PAGES = ['jazz', 'latin-jazz', 'blues'];
// rescue net for untagged-but-obvious bookings on the full list
const TITLE_RE = /\b(jazz|brass band|blues|swing|bebop)\b/i;

export function parse(html, { titleFilter = false } = {}) {
  const events = [];
  const seen = new Set();
  const chunks = String(html).split(/(?=<a[^>]+class=["'][^"']*event-item)/).slice(1);
  for (const chunk of chunks) {
    const url = chunk.match(/href=["'](https?:\/\/quasimodo\.club\/events\/[^"']+)["']/)?.[1];
    const dm = chunk.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*[-–]\s*(\d{1,2}:\d{2}))?/);
    const title = cleanText(htmlToText(chunk.match(/class=["'][^"']*event-title[^"']*["'][^>]*>([\s\S]*?)<\/h\d>/)?.[1] ?? ''));
    if (!dm || !title) continue;
    if (titleFilter && !TITLE_RE.test(title)) continue;
    const ev = makeEvent({
      clubId: 'quasimodo',
      title,
      date: `${dm[3]}-${dm[2]}-${dm[1]}`,
      sets: dm[4] ? [dm[4]] : [],
      url: url ?? `${BASE}/events`,
      details: null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  const out = [];
  const seen = new Set();
  const add = (evs) => {
    for (const e of evs) {
      if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    }
  };
  let firstErr = null;
  for (const tag of TAG_PAGES) {
    try {
      add(parse(await fetchText(`${BASE}/events/tags/${tag}`)));
    } catch (err) {
      if (tag === TAG_PAGES[0]) firstErr = err;
    }
    await sleep(250);
  }
  try {
    add(parse(await fetchText(`${BASE}/events`), { titleFilter: true }));
  } catch (err) {
    if (!out.length) throw firstErr ?? err;
  }
  if (!out.length && firstErr) throw firstErr;
  return out;
}
