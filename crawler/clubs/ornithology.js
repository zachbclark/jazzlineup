// Ornithology (Bushwick) — two rooms, two SpotHopper sites, one parser:
//   • Ornithology Jazz Club  — ornithologyjazzclub.com   (clubId ornithology)
//   • Ornithology Cafe       — cafeornithology.com       (clubId ornithologycafe)
// Events pages are server-rendered:
//   <section><h2>Earlybird Show</h2>
//     <p class="event-main-text event-day">Tuesday July 14th</p>
//     <div class="event-info-text"><p>Kazu Yokoshima (p)</p><p>…(b)</p>…</div>
//     <p class="event-main-text event-time">06:30 PM - 08:30 PM</p></section>
// Personnel lines use instrument abbreviations — best roster data in NYC.
import { fetchText, makeEvent, htmlToText, extractTimes, monthNum, inferYear, isoDate, cleanText } from '../lib.js';

const SITES = [
  { clubId: 'ornithology', url: 'https://ornithologyjazzclub.com/brooklyn-bushwick-williamsburg-ornithology-jazz-club-events' },
  { clubId: 'ornithologycafe', url: 'https://cafeornithology.com/brooklyn-bushwick-williamsburg-cafe-ornithology-events' },
];

const ABBREV = {
  p: 'piano', pno: 'piano', b: 'bass', d: 'drums', dr: 'drums', g: 'guitar', gt: 'guitar',
  ts: 'tenor sax', as: 'alto sax', bs: 'baritone sax', bari: 'baritone sax', ss: 'soprano sax',
  tp: 'trumpet', tpt: 'trumpet', tb: 'trombone', tbn: 'trombone', v: 'vocals', voc: 'vocals',
  vox: 'vocals', org: 'organ', key: 'keys', keys: 'keys', fl: 'flute', cl: 'clarinet',
  vib: 'vibraphone', perc: 'percussion', harm: 'harmonica', acc: 'accordion', cel: 'cello',
  vln: 'violin', el: 'electronics', syn: 'synth',
};

// "Kazu Yokoshima (p)" / "Justin Flynn ()ts)" (site typo) -> {name, instrument}
export function parseAbbrevLine(line) {
  const m = cleanText(line).match(/^(.{2,60}?)\s*\(+\)?\s*([a-z .\/-]{1,24})\s*\)\s*$/i);
  if (!m) return null;
  const name = m[1].trim();
  if (!/^[A-Z]/.test(name) || /\d/.test(name)) return null;
  const raw = m[2].trim().toLowerCase().replace(/\.+$/, '');
  const instrument = ABBREV[raw] ?? (raw.length > 2 ? raw : null);
  return instrument ? { name, instrument } : null;
}

export function parsePage(html, clubId, siteUrl, today = new Date()) {
  const events = [];
  // Each event lives in a <section>; be tolerant of wrapper attrs.
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|<\/main|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = htmlToText(m[1]);
    const body = m[2];
    // "Tuesday July 14th": first token is the weekday — month is token 2.
    const dm = htmlToText(body.match(/event-day[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '')
      .match(/[A-Za-z]+\s+([A-Za-z]+)\s+(\d{1,2})/);
    if (!title || !dm || !monthNum(dm[1])) continue;
    const month = monthNum(dm[1]);
    const day = Number(dm[2]);
    const date = isoDate(inferYear(month, day, today), month, day);

    // "06:30 PM - 08:30 PM" / "11:00 PM - 01:00 AM": the LEFT side is the
    // downbeat (extractTimes sorts, which would misorder overnight ranges).
    const timeText = htmlToText(body.match(/event-time[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
    const start = extractTimes(timeText.split(/\s[-–—]\s/)[0]);
    const sets = start.length ? [start[0]] : [];

    const personnel = [];
    // Capture through to the time paragraph — the info block contains a
    // hidden metadata <div/> whose closing tag would end a lazy </div> match.
    const info = body.match(/event-info-text[^>]*>([\s\S]*?)(?:<p[^>]*event-time|<\/section|$)/i)?.[1] ?? '';
    for (const line of htmlToText(info).split('\n')) {
      const p = parseAbbrevLine(line);
      if (p) personnel.push(p);
    }

    events.push(makeEvent({
      clubId,
      title,
      date,
      sets,
      url: siteUrl,
      personnel,
    }));
  }
  return events;
}

export async function crawl() {
  const out = [];
  const errors = [];
  for (const site of SITES) {
    try {
      out.push(...parsePage(await fetchText(site.url), site.clubId, site.url));
    } catch (err) {
      errors.push(`${site.clubId}: ${err.message}`);
    }
  }
  if (out.length === 0 && errors.length) throw new Error(errors.join(' | '));
  return out;
}
