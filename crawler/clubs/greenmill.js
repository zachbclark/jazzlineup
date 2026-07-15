// Green Mill (4802 N Broadway, Uptown) — Chicago's landmark room, jazz
// nightly since Capone drank here. WordPress + Events Manager plugin;
// /calendar/ is fully server-rendered and, remarkably, self-sufficient:
// every <li> in the month grid carries the event link (slug ends in the
// date), the time range + cover charge in <div id="caltime">, and the FULL
// BAND ROSTER hiding in the add-to-Google-Calendar link's `details` param.
// Month paging is /calendar/?mo=<M>&yr=<YYYY>. All jazz — no filter.
import {
  fetchText, makeEvent, applyLateNight, decodeEntities, normalizeTime,
  parsePersonnel, sleep, isoDate, cleanText,
} from '../lib.js';

const BASE = 'https://greenmilljazz.com';

// "(8pm - midnight) ALFONSO PONTICELLI" -> title without the time prefix
function stripTimePrefix(text) {
  return cleanText(text).replace(/^\(\s*[^)]*\)\s*/, '');
}

// The gcal `details` param packs the roster without separators between an
// instrument and the next player ("...- guitarSteve Gibons - violin...").
// Re-seam it so parsePersonnel can split cleanly.
function personnelFromGcal(details) {
  const t = decodeEntities(decodeURIComponent(String(details).replace(/\+/g, ' ')))
    .replace(/([a-z)])([A-Z])/g, '$1 $2') // "guitarSteve" -> "guitar Steve"
    .replace(/\s-([a-z])/g, ' - $1'); // "Rummage -drums" -> "Rummage - drums"
  return parsePersonnel(t);
}

// "8:00pm - 12:00am<br />$10 cover" -> { sets: ['20:00'], priceText: '$10 cover' }
function parseCaltime(html) {
  const [timePart, ...rest] = String(html).split(/<br\s*\/?>/i);
  const start = normalizeTime((cleanText(timePart).match(/^([^–—-]+)/) ?? [])[1]);
  const priceText = cleanText(rest.join(' ').replace(/<[^>]+>/g, ' ')) || null;
  return { sets: start ? [start] : [], priceText };
}

export function parseMonth(html) {
  const events = [];
  // Each listing: <li><a href=".../events/<slug>-YYYY-MM-DD/">(time) TITLE</a>
  //   <div id="caltime">8:00pm - 12:00am<br/>$10 cover</div> ... gcal link
  const li = /<li>\s*<a href="(https?:\/\/greenmilljazz\.com\/events\/[^"]*?(\d{4})-(\d{2})-(\d{2})\/?)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = li.exec(html))) {
    const [, url, y, mo, d, linkText, tail] = m;
    const title = stripTimePrefix(linkText.replace(/<[^>]+>/g, ' '));
    if (!title) continue;
    const cal = tail.match(/id="caltime"[^>]*>([\s\S]*?)<\/div>/i);
    const { sets, priceText } = cal ? parseCaltime(cal[1]) : { sets: [], priceText: null };
    // the & separators in the gcal URL arrive as &, &amp; or &#038;
    const gcal = tail.match(/[?&](?:amp;|#0?38;)?details=([^&"]*)/i);
    const personnel = gcal ? personnelFromGcal(gcal[1]) : [];
    events.push(makeEvent(applyLateNight({
      clubId: 'greenmill',
      title,
      date: isoDate(Number(y), Number(mo), Number(d)),
      sets,
      url,
      details: null, // roster or nothing; the calendar has no prose blurbs
      personnel,
      priceText,
    })));
  }
  return events;
}

export async function crawl(today = new Date()) {
  const out = [];
  const y = today.getFullYear();
  const mo = today.getMonth() + 1;
  const next = mo === 12 ? { mo: 1, yr: y + 1 } : { mo: mo + 1, yr: y };
  for (const [i, page] of [`${BASE}/calendar/`, `${BASE}/calendar/?mo=${next.mo}&yr=${next.yr}`].entries()) {
    try {
      out.push(...parseMonth(await fetchText(page)));
    } catch (err) {
      if (i === 0) throw err; // current month must work; next month is best-effort
    }
    await sleep(400);
  }
  // month grids overlap at the edges (trailing/leading days) — de-dupe by id
  const byId = new Map(out.map((e) => [e.id, e]));
  return [...byId.values()];
}
