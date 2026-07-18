// Donau115 (Donaustraße 115, Neukölln) — "MUSIK UND EXPERIMENTE", the
// Neukölln scene room where the young Berlin players actually hang. Their
// Wix site is client-rendered, but it loads events from a PUBLIC Firebase
// Realtime Database feed (found 2026-07-18 watching the page's requests):
//   .../events.json -> { <key>: { bandName, date: "2026-07-31",
//     description, members: ["Name -- instrument" | "Name (abbr)"], live } }
// ISO dates, structured rosters, a live/draft flag — better than most
// venues' actual websites. Times hide in prose ("start 20:00", "MUSIC
// STARTS 20:00"). Two-Song Tuesday is a songwriter open mic, not jazz —
// skipped; Thursday Jazz Jam stays.
import {
  fetchText, makeEvent, cleanText, personnelFromJpRun, parsePersonnel,
  isInstrumentWord,
} from '../lib.js';

const FEED = 'https://shifts-a77a1-default-rtdb.europe-west1.firebasedatabase.app/events.json';
const SITE = 'https://donau115.de';
const SKIP_RE = /two[- ]song tuesday/i;

// members arrays mix shapes: "Kit Downes (p)", "Jonathan Reisin -
// Saxophone" (single or double dash), and "Thiago Duarte: Double Bass"
// (colon — the Quique Sinesi lesson). Parsed per member; a member that
// fits no shape is dropped without sinking the rest of the roster.
const GUEST_RE = /^(?:special guest|feat\.?|featuring|with|w\/)[,:]?\s*/i;
export function membersToPersonnel(members) {
  if (!Array.isArray(members) || !members.length) return null;
  const parts = members.map((m) => cleanText(String(m)));
  if (parts.some((p) => /[（(]/.test(p))) {
    const run = personnelFromJpRun(parts.join(' '), { maxName: 40 });
    if (run.length) return run;
  }
  const out = [];
  for (const p of parts) {
    const m = p.match(/^(.{2,60}?)\s*(?:[-–—]{1,2}|:)\s*(.{2,80})$/);
    if (!m) continue;
    let name = cleanText(m[1].replace(GUEST_RE, ''));
    let instrument = cleanText(m[2]).toLowerCase().replace(/[.,;]+(?=\S)/g, ', ');
    if (!name || !instrument) continue;
    // some rosters flip a line ("Sax - Ori Jacobson"): if the left side is
    // all instrument words and the right side isn't, swap them
    const allInstr = (s) => s.split(/[\s,/&]+/).filter(Boolean).every(isInstrumentWord);
    if (allInstr(name) && !allInstr(instrument)) {
      [name, instrument] = [cleanText(m[2]).replace(GUEST_RE, ''), name.toLowerCase()];
    }
    out.push({ name, instrument });
  }
  return out.length >= 2 ? out : null;
}

export function parse(jsonText, todayIso) {
  const j = JSON.parse(jsonText);
  const events = [];
  const seen = new Set();
  for (const item of Object.values(j ?? {})) {
    if (!item || item.live !== true) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date ?? '')) continue;
    if (todayIso && item.date < todayIso) continue;
    let title = cleanText(item.bandName ?? '');
    if (!title || SKIP_RE.test(title)) continue;
    // "(MUSIC STARTS 20:00)" style suffixes carry the time, not the name
    const inlineTime = title.match(/\(([^)]*?(\d{1,2}[:.]\d{2})[^)]*)\)\s*$/);
    if (inlineTime) title = cleanText(title.slice(0, title.length - inlineTime[0].length));
    const desc = String(item.description ?? '');
    const start = inlineTime?.[2]
      ?? desc.match(/(?:music\s*starts|start|beginn|concert)[:\s]*(\d{1,2}[:.]\d{2})/i)?.[1];
    const personnel = membersToPersonnel(item.members)
      ?? (parsePersonnel ? parsePersonnel(desc) : null);
    const ev = makeEvent({
      clubId: 'donau115',
      title,
      date: item.date,
      sets: start ? [start.replace('.', ':')] : [],
      url: SITE,
      details: null,
      personnel: personnel && personnel.length >= 2 ? personnel : null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export async function crawl() {
  const today = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  return parse(await fetchText(FEED, { headers: { accept: 'application/json' } }), today);
}
