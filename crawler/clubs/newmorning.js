// New Morning (7-9 rue des Petites Écuries, 10e) — the legendary big room:
// Chet Baker, Prince, Stan Getz, and today's touring bands. Old-school
// homegrown site whose /programmation page embeds the FULL agenda as a
// JSON-LD Event array — extractJsonLd() from lib reads it directly.
// Quirk: the agenda's startDate is always T00:00:00 (no structural set time),
// so the listing is time-less — but each event's DETAIL page carries the
// roster ("Présentation" block), the concert time, and the price, which we
// pull via detail-page enrichment (see parseDetail + crawl below). All
// jazz-adjacent by curation; no filter (their occasional soul/world bookings
// are core New Morning).
import { fetchText, makeEvent, extractJsonLd, htmlToText, cleanText } from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const BASE = 'https://www.newmorning.com';
const URL_ = `${BASE}/programmation`;

// Their PHP emits the JSON-LD by string concatenation, and one unescaped
// character anywhere makes JSON.parse reject the WHOLE 73-event array (bit
// us on first live crawl: browser tolerated it, extractJsonLd didn't).
// Lenient fallback: pull each event's fields by regex. Field order in
// their template is stable: @type Event -> name -> startDate -> … -> url.
function lenientEvents(html) {
  const nodes = [];
  const re = /"@type"\s*:\s*"Event"[\s\S]{0,400}?"name"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,200}?"startDate"\s*:\s*"([^"]+)"[\s\S]{0,400}?"url"\s*:\s*"([^"]+)"/g;
  for (const m of html.matchAll(re)) {
    let name = m[1];
    try { name = JSON.parse(`"${m[1]}"`); } catch { /* keep raw */ }
    nodes.push({ '@type': 'Event', name, startDate: m[2], url: m[3] });
  }
  return nodes;
}

export function parse(html) {
  // exact type match: their page also carries an "EventVenue" node, which a
  // loose /event/i test matched — making the strict path look successful
  // (1 node, 0 usable events) so the lenient fallback never ran. Diagnosed
  // from live bytes 2026-07-16.
  const strictNodes = extractJsonLd(html).filter((n) => /^(?:Music)?Event$/i.test(String(n['@type'] ?? '')));
  const fromNodes = (nodes) => buildEvents(nodes);
  const strict = fromNodes(strictNodes);
  return strict.length ? strict : fromNodes(lenientEvents(html));
}

function buildEvents(nodes) {
  const events = [];
  const seen = new Set();
  for (const node of nodes) {
    if (!node.name || !node.startDate) continue;
    const date = String(node.startDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const time = (String(node.startDate).match(/T(\d{2}:\d{2})/) ?? [])[1];
    const ev = makeEvent({
      clubId: 'newmorning',
      title: cleanText(node.name),
      date,
      sets: time && time !== '00:00' ? [time] : [],
      url: node.url ?? URL_,
      details: node.description ? htmlToText(node.description).slice(0, 300) : null,
    });
    if (seen.has(ev.id)) continue; // the JSON-LD block repeats on every page
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

// Detail pages carry the roster in a "Présentation" block, one player per
// line as:
//   <div class="lh-sm mb-2"><span><strong>Name</strong></span><br>
//   <span class="fst-italic">Instrument</span></div>
// The block is emitted twice (responsive desktop/mobile variants) — dedupe by
// name. The header also gives the concert start ("20h30 : Concert", after the
// "… : Ouverture des portes" door time), and the JSON-LD offer gives a price.
// Roster, time and price are published independently (a far-out show can list
// its lineup before its time), so only personnel triggers a fetch; time/price
// ride along via alsoFill when present.
export function parseDetail(html) {
  const personnel = [];
  const seen = new Set();
  const re = /<span><strong>([\s\S]*?)<\/strong><\/span>\s*<br>\s*<span class="fst-italic">([\s\S]*?)<\/span>/gi;
  for (const m of html.matchAll(re)) {
    const name = cleanText(htmlToText(m[1]));
    const instrument = cleanText(htmlToText(m[2])).toLowerCase();
    if (!name || !instrument || seen.has(name)) continue;
    seen.add(name);
    personnel.push({ name, instrument });
  }

  const timeM = html.match(/(\d{1,2})\s*h\s*(\d{2})\s*:\s*Concert/i);
  const sets = timeM ? [`${timeM[1].padStart(2, '0')}:${timeM[2]}`] : [];

  const priceM = html.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/);
  const priceText = priceM ? `${Number(priceM[1])}€` : null;

  return { personnel: personnel.length ? personnel : null, sets, priceText };
}

export async function crawl(ctx = {}) {
  const events = parse(await fetchText(URL_));
  await enrichFromDetailPages(
    events.filter((e) => e.url !== URL_),
    ctx,
    { fields: ['personnel'], alsoFill: ['sets', 'priceText'], extract: parseDetail },
  );
  return events;
}
