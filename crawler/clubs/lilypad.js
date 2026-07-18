// The Lilypad (1353 Cambridge St, Inman Square) — Cambridge's creative-music
// workshop room: jazz, improv, new music, several shows a night. Squarespace,
// but the gift is on the homepage: every event ships an add-to-Google-
// calendar link with EXACT UTC start/end times (verified 2026-07-19, ~160
// events):
//   google.com/calendar/event?action=TEMPLATE&text=Gill%20Aharon%20Trio
//     &dates=20260716T001500Z/20260716T020000Z&location=...
// We parse those links, convert UTC to America/New_York, and merge same
// (date, title) into sets. Light filter per Zach (2026-07-19): the room is
// jazz/improv-first, so keep everything except obvious non-music nights.
import { fetchText, makeEvent, applyLateNight, nyDate, nyTime, cleanText } from '../lib.js';

const URL_ = 'https://www.lilypadinman.com/';

const SKIP_RE = /\bcomedy\b|variety show|\bpoetry\b|open mic|\bfilm\b|\btrivia\b|karaoke|\bstorytell/i;

// "20260716T001500Z" -> ISO "2026-07-16T00:15:00Z"
const gcalToIso = (s) =>
  `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;

export function parse(html) {
  const s = String(html);
  // per-event Squarespace pages (/home/<slug>) precede each tile's gcal
  // link — pair every event with the nearest /home/ href before it
  const homes = [...s.matchAll(/href="(\/home\/[a-z0-9-]{6,})"/g)]
    .map((m) => ({ i: m.index, href: m[1] }));
  let hp = 0; // pointer: homes and gcal links both appear in document order
  const drafts = new Map(); // `${date}:${title}` -> draft
  const re = /google\.com\/calendar\/event\?action=TEMPLATE&(?:amp;)?text=([^&"]+)&(?:amp;)?dates=(\d{8}T\d{6}Z)/g;
  for (const m of s.matchAll(re)) {
    let title;
    try { title = cleanText(decodeURIComponent(m[1].replace(/\+/g, ' '))); } catch { continue; }
    while (hp < homes.length - 1 && homes[hp + 1].i < m.index) hp++;
    const home = homes[hp] && homes[hp].i < m.index ? homes[hp].href : null;
    if (!title || SKIP_RE.test(title)) continue;
    const startIso = gcalToIso(m[2]);
    const date = nyDate(startIso);
    const time = nyTime(startIso);
    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, {
        clubId: 'lilypad', title, date, sets: [],
        url: home ? 'https://www.lilypadinman.com' + home : URL_,
        details: null,
      });
    }
    if (time && !drafts.get(key).sets.includes(time)) drafts.get(key).sets.push(time);
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
