// The Stone (at The New School's Glass Box Theatre, 55 W 13th St) — John
// Zorn's avant-garde institution, Wed-Sat 8:30pm, one set. Hand-built HTML
// essentially unchanged since 2005; calendar.php lists the current window as
// flat span runs:
//   <span class="date">7/17 Friday <span class="volunteer"></span></span>
//   <span class="time">8:30 pm<br></span>
//   <span class="calendarname">TRIO<br></span>
//   <span class="text">Chris Corsano (drums) Joe Morris (guitar) ...</span>
// Weekly-residency banners (<span class="bannertitle">LARRY OCHS</span>)
// precede their run of dates. Rosters are Name (instrument) runs, but the
// avant instrument list is unbounded (ajaeng, daxophone, objects...) so the
// roster parser trusts the structural guarantee of the text span instead of
// the INSTRUMENTS lexicon.
import { fetchText, makeEvent, applyLateNight, cleanText, normalizeTime, inferYear, isoDate, titleCaseName } from '../lib.js';

const URL_ = 'http://thestonenyc.com/calendar.php';

// "TRIO", "SOLO" etc. name a format, not an act — combine with the residency.
const GENERIC_RE = /^(?:SOLO|DUO|TRIO|QUARTET|QUINTET|SEXTET|SEPTET|OCTET|NONET|ENSEMBLE|BAND)$/i;

// Name (instrument) runs, lexicon-free: the text span is always a roster.
export function parseRoster(text) {
  const personnel = [];
  const re = /([A-ZÀ-Þ][\w.'’À-ÿ-]*(?:\s+[A-ZÀ-Þ][\w.'’À-ÿ-]*){0,3})\s*\(([^)]{1,45})\)/g;
  for (const m of cleanText(text).matchAll(re)) {
    personnel.push({ name: cleanText(m[1]), instrument: cleanText(m[2]).toLowerCase() });
  }
  return personnel;
}

export function parse(html, today = new Date()) {
  const events = [];
  let residency = null;
  const re = /<span class=['"]bannertitle['"]>([\s\S]*?)<\/span>|<span class=['"]date['"]>\s*(\d{1,2})\/(\d{1,2})[\s\S]*?<span class=['"]time['"]>([\s\S]*?)<\/span>\s*<span class=['"]calendarname['"]>([\s\S]*?)<\/span>\s*<span class=['"]text['"]>([\s\S]*?)<\/span>/g;
  for (const m of String(html).matchAll(re)) {
    if (m[1] !== undefined) {
      residency = cleanText(m[1].replace(/<br\s*\/?>/gi, ' ')) || null;
      continue;
    }
    const [, , mo, day, timeRaw, nameRaw, textRaw] = m;
    const y = inferYear(Number(mo), Number(day), today);
    const time = normalizeTime(cleanText(timeRaw.replace(/<br\s*\/?>/gi, ' ')));
    const personnel = parseRoster(textRaw);
    let title = cleanText(nameRaw.replace(/<br\s*\/?>/gi, ' '));
    if (GENERIC_RE.test(title) && residency) {
      title = `${titleCaseName(residency)} ${titleCaseName(title)}`;
    } else if (!title) {
      title = residency ? titleCaseName(residency) : personnel[0]?.name ?? 'The Stone';
    }
    const resName = residency ? titleCaseName(residency) : null;
    events.push(makeEvent(applyLateNight({
      clubId: 'stone',
      title,
      date: isoDate(y, Number(mo), Number(day)),
      sets: time ? [time] : [],
      url: URL_,
      details: resName && !title.includes(resName) ? `${resName} residency` : null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
