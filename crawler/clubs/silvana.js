// Silvana (300 W 116th St) + Shrine (2271 Adam Clayton Powell Jr Blvd) —
// sister Harlem venues on one homegrown PHP calendar. calendar.php is
// server-rendered with ~a month visible, one <td> per day:
//   <span class="wh">July 15</span>            (Shrine uses class="dy")
//   <p><a onclick="return popCal(2);" id="t2">7pm-8pm: Junho Lee - Jazz Guitarist</a></p>
//   <div class="hid" id="x2">…act description…</div>
// Both book across genres nightly, so acts are kept only when the genre
// tag / title / description reads jazz-ish (precision-first, as elsewhere).
import { fetchText, makeEvent, htmlToText, monthNum, inferYear, isoDate, normalizeTime, cleanText } from '../lib.js';

const SITES = {
  silvana: 'https://silvana-nyc.com',
  shrine: 'https://shrinenyc.com',
};
const JAZZ_RE = /\bjazz|blues|swing|be-?bop|bossa|fusion|quartet|quintet|trio|big band|improvis\b/i;

export function parsePage(html, clubId, today = new Date()) {
  // description lookup: <div class="hid" id="xN">text</div>
  const descs = {};
  const dRe = /<div[^>]*class=["']hid["'][^>]*id=["']x(\d+)["'][^>]*>([\s\S]*?)<\/div>/gi;
  let dm;
  while ((dm = dRe.exec(html))) descs[dm[1]] = htmlToText(dm[2]);

  const events = [];
  // split by day headers (Silvana: class="wh", Shrine: class="dy")
  const dayRe = /<span[^>]*class=["'](?:wh|dy)["'][^>]*>\s*([A-Za-z]+)\s+(\d{1,2})\s*<\/span>([\s\S]*?)(?=<span[^>]*class=["'](?:wh|dy)["']|$)/gi;
  let m;
  while ((m = dayRe.exec(html))) {
    const [, monName, dayNum, block] = m;
    if (!monthNum(monName)) continue;
    const month = monthNum(monName);
    const date = isoDate(inferYear(month, Number(dayNum), today), month, Number(dayNum));

    const actRe = /<a[^>]*onclick=["']return popCal\((\d+)\);["'][^>]*>([\s\S]*?)<\/a>/gi;
    let a;
    while ((a = actRe.exec(block))) {
      const [, num, raw] = a;
      const text = cleanText(htmlToText(raw));
      // "7pm-8pm: Junho Lee - Jazz Guitarist" — time range, colon, act
      const tm = text.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*:\s*(.+)$/i);
      if (!tm) continue; // "HAPPY HOUR! 6pm-8pm" etc. carry no colon+act
      const start = normalizeTime(/am|pm/i.test(tm[1]) ? tm[1] : tm[1] + 'pm');
      const rest = tm[2].trim();
      const parts = rest.split(/\s+[-–]\s+/);
      const genre = parts.length > 1 ? parts[parts.length - 1] : '';
      const title = (parts.length > 1 ? parts.slice(0, -1).join(' - ') : rest).trim();
      const desc = descs[num] ?? '';
      if (!JAZZ_RE.test(`${title} ${genre} ${desc.slice(0, 300)}`)) continue;
      events.push(makeEvent({
        clubId,
        title,
        date,
        sets: start ? [start] : [],
        url: `${SITES[clubId]}/calendar.php`,
        details: genre ? `${genre}${desc ? ' — ' + desc.slice(0, 240) : ''}` : desc.slice(0, 300) || null,
      }));
    }
  }
  return events;
}

export async function crawl() {
  const out = [];
  const errors = [];
  for (const [clubId, base] of Object.entries(SITES)) {
    try {
      out.push(...parsePage(await fetchText(`${base}/calendar.php`), clubId));
    } catch (err) {
      errors.push(`${clubId}: ${err.message}`);
    }
  }
  if (out.length === 0 && errors.length) throw new Error(errors.join(' | '));
  return out;
}
