// Caveau de la Huchette (5 rue de la Huchette, Quartier Latin) — swing and
// bebop in a medieval cellar since 1946; the room from La La Land's final
// reverie. Homegrown site: monthly pages (linked from the homepage nav as
// /1/concerts_<mois>_<année>_<id>.html) list the program as French prose:
//   "Lundi 6 juillet : Blues Monday"
//   "Jeudi 16 et vendredi 17 juillet : Sebastian Ellis Rock'N Roll Band"
//   "Du jeudi 9 au samedi 11 juillet : Danger Zone"
// House policy: music nightly from 21h30 (their standing sets note).
// All swing/jazz — no filter.
import { fetchText, makeEvent, htmlToText, isoDate, cleanText, sleep } from '../lib.js';
import { frMonthNum } from './_fr.js';

const BASE = 'https://www.caveaudelahuchette.fr';
const SETS = ['21:30'];
const DAY = '(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)';

// Expand one prose line into [{day, title}] (month applied by caller).
export function expandLine(line) {
  const out = [];
  let m;
  if ((m = line.match(new RegExp(`^Du\\s+${DAY}\\s+(\\d{1,2})(?:er)?\\s+au\\s+${DAY}\\s+(\\d{1,2})(?:er)?\\s+([a-zûéà]+)\\s*:\\s*(.+)$`, 'i')))) {
    const [, from, to, , title] = m;
    for (let d = Number(from); d <= Number(to); d++) out.push({ day: d, title });
    return { entries: out, month: m[3] };
  }
  if ((m = line.match(new RegExp(`^${DAY}\\s+(\\d{1,2})(?:er)?\\s+et\\s+${DAY}\\s+(\\d{1,2})(?:er)?\\s+([a-zûéà]+)\\s*:\\s*(.+)$`, 'i')))) {
    return { entries: [{ day: Number(m[1]), title: m[4] }, { day: Number(m[2]), title: m[4] }], month: m[3] };
  }
  if ((m = line.match(new RegExp(`^${DAY}\\s+(\\d{1,2})(?:er)?\\s+([a-zûéà]+)\\s*:\\s*(.+)$`, 'i')))) {
    return { entries: [{ day: Number(m[1]), title: m[3] }], month: m[2] };
  }
  return { entries: [], month: null };
}

export function parseMonthPage(html, pageUrl) {
  // year + default month from the page itself ("Concerts juillet 2026")
  const head = htmlToText(html);
  const ym = head.match(/Concerts\s+([a-zûéà]+)\s+(\d{4})/i);
  const defaultMonth = ym ? frMonthNum(ym[1]) : null;
  const year = ym ? Number(ym[2]) : new Date().getFullYear();

  const events = [];
  for (const rawLine of head.split('\n')) {
    const line = cleanText(rawLine);
    const { entries, month: lineMonth } = expandLine(line);
    const month = frMonthNum(lineMonth ?? '') ?? defaultMonth;
    if (!month) continue;
    for (const { day, title } of entries) {
      const t = cleanText(title);
      if (!t) continue;
      events.push(makeEvent({
        clubId: 'caveau',
        title: t,
        date: isoDate(year, month, day),
        sets: SETS,
        url: pageUrl,
        details: null,
      }));
    }
  }
  return events;
}

export async function crawl() {
  const home = await fetchText(BASE);
  const links = [...new Set(home.match(/\/1\/concerts_[a-zûéà]+_\d{4}_\d+(?:_0)?\.html/gi) ?? [])]
    .filter((l) => !l.endsWith('_0.html')) // _0 variants are duplicates
    .slice(0, 2); // current + next month
  if (!links.length) throw new Error('caveau: no month pages found on homepage');
  const out = [];
  for (const [i, link] of links.entries()) {
    try {
      out.push(...parseMonthPage(await fetchText(BASE + link), BASE + link));
    } catch (err) {
      if (i === 0) throw err;
    }
    await sleep(400);
  }
  return out;
}
