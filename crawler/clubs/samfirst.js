// Sam First (6171 W Century Blvd, by LAX) — the LA room where the young
// creative scene plays (Paul Cornish's home base). Wix site with the real
// Wix Events app; /upcoming-shows embeds the full event objects in the
// <script id="wix-warmup-data"> JSON. We parse that JSON and walk the tree
// for arrays of { title, slug, scheduling:{ config:{ startDate (UTC ISO),
// timeZoneId 'America/Los_Angeles' } }, description }.
import { fetchText, makeEvent, laDate, laTime, applyLateNight, htmlToText, stripPromo, parsePersonnel } from '../lib.js';

const BASE = 'https://www.samfirstbar.com';
const URL_ = `${BASE}/upcoming-shows`;

export function parse(html) {
  const m = html.match(/<script[^>]*id="wix-warmup-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }

  // Find the first array of event-shaped objects anywhere in the tree.
  let found = null;
  (function walk(o) {
    if (!o || typeof o !== 'object' || found) return;
    if (Array.isArray(o)) {
      if (o.length && o[0] && typeof o[0] === 'object' && o[0].scheduling && o[0].title) { found = o; return; }
      o.forEach(walk);
      return;
    }
    Object.values(o).forEach(walk);
  })(data);

  const events = [];
  for (const ev of found ?? []) {
    const start = ev.scheduling?.config?.startDate;
    if (!start || !ev.title) continue;
    const desc = htmlToText(ev.description ?? ev.about ?? '');
    const personnel = parsePersonnel(desc);
    events.push(makeEvent(applyLateNight({
      clubId: 'samfirst',
      title: ev.title,
      date: laDate(start),
      sets: [laTime(start)],
      url: ev.slug ? `${BASE}/events/${ev.slug}` : URL_,
      details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
      personnel,
    })));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
