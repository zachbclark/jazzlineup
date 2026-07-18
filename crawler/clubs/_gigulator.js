// Shared parser for Bill's Gigulator — the gloriously named gig-listing
// service half of New Orleans runs on (d.b.a. site 1048, Spotted Cat 1052).
// One URL returns a server-rendered HTML table of upcoming shows:
//   publish.billsgigulator.com/shows.html?site=<id>&lim=45...
// Rows (verified 2026-07-19): month headers <span class="bgig-hdr-month-txt">
// July</span><span class="bgig-hdr-year-txt">2026</span>, then per-gig rows
// with bgig-date-2 (Jul) / bgig-date-3 (18) / bgig-time-show (6pm) /
// bgig-proj-name (artist).
import { fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, inferYear, isoDate, cleanText, htmlToText } from '../lib.js';

export function parseGigulator(html, clubId, siteUrl, today = new Date()) {
  const events = [];
  const seen = new Set();
  // NB: the Gigulator MIXES quote styles (class='bgig-row...' single,
  // class="bgig-pic" double) AND flips hyphens/underscores between its
  // embed and standalone renderers (bgig-date-2 vs bgig_date_2) — every
  // attribute regex accepts all variants
  const rows = String(html).split(/(?=<div class=['"]bgig-row bgig-gig)/).slice(1);
  for (const row of rows) {
    const mon = monthNum((row.match(/class=['"][^'"]*bgig[-_]date[-_]2[^'"]*['"][^>]*>\s*([A-Za-z]{3})\s*</) ?? [])[1]);
    const day = Number((row.match(/class=['"][^'"]*bgig[-_]date[-_]3[^'"]*['"][^>]*>\s*(\d{1,2})\s*</) ?? [])[1]);
    const time = normalizeTime((row.match(/class=['"][^'"]*bgig[-_]time[-_]show[^'"]*['"][^>]*>\s*([^<]{2,12})</) ?? [])[1]);
    const title = cleanText(htmlToText((row.match(/class=['"][^'"]*bgig[-_]proj[-_]name[^'"]*['"][^>]*>([\s\S]*?)<\/span>/) ?? [])[1] ?? ''));
    if (!mon || !day || !title) continue;
    const ev = makeEvent(applyLateNight({
      clubId,
      title,
      date: isoDate(inferYear(mon, day, today), mon, day),
      sets: time ? [time] : [],
      url: siteUrl,
      details: null,
    }));
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export function makeGigulatorCrawler({ clubId, site, siteUrl }) {
  return async function crawl() {
    const url = `https://publish.billsgigulator.com/shows.html?site=${site}&hdr=0&unit=d&lim=60&mhdr=1&datef=D~M~d&lout=I|DTEPKN&tbldiv=1`;
    return parseGigulator(await fetchText(url), clubId, siteUrl);
  };
}
