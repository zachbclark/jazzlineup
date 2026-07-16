// The Baked Potato (3787 Cahuenga Blvd, Studio City) — Don Randi's fusion
// basement since 1970, the session-player hang. Their site's calendar is a
// ThunderTix iframe; we crawl the ticketing host directly, which serves
// plain HTML (verified 2026-07-16):
//   <div class="panel panel-default event_box"> blocks with an <h1> title,
//   <div class="event_date"> Thursday July 16, 2026 </div>, a Buy link
//   (/events/NNNNNN), and the description as <h3> lines that usually ARE
//   the band: "MIKE KENEALLY - GUITAR/KEYS" — personnel on nearly every
//   show. Set times live only on the /events/NNNNNN detail pages
//   ("Thursday, July 16, 2026 - 08:00 PM PDT", typically 8:00 + 10:00).
// All jazz/fusion nightly — no filter (same legacy-institution policy as
// Yoshi's and Blue Note).
import {
  fetchText, makeEvent, applyLateNight, normalizeTime, monthNum, isoDate,
  htmlToText, cleanText, sleep, personnelFromLines,
} from '../lib.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

const BASE = 'https://thebakedpotato.thundertix.com';
const MAX_LIST_PAGES = 5; // 16 events/page ≈ 2.5 months of nights

export function parse(html) {
  const drafts = new Map(); // `${date}:${title}` -> draft
  const blocks = html.split(/(?=<div class="panel panel-default event_box")/).slice(1);
  for (const block of blocks) {
    const title = cleanText(htmlToText(block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''));
    if (!title) continue;
    const dm = htmlToText(block.match(/class="event_date"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
      .match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (!dm) continue;
    const month = monthNum(dm[1]);
    if (!month) continue;
    const date = isoDate(Number(dm[3]), month, Number(dm[2]));
    const href = (block.match(/href="(\/events\/\d+)"/i) ?? [])[1];

    const descHtml = block.match(/event_description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
    const descText = htmlToText(descHtml);
    const personnel = personnelFromLines(descText);
    const rosterNames = new Set(personnel.map((p) => p.name.toLowerCase()));
    const details = descText.split('\n')
      .map((l) => cleanText(l))
      .find((l) => l.length > 12 && !rosterNames.has(l.split(/\s*[-–—]\s*/)[0].trim().toLowerCase()))
      ?.slice(0, 250) ?? null;

    const key = `${date}:${title.toLowerCase()}`;
    if (!drafts.has(key)) {
      drafts.set(key, {
        clubId: 'bakedpotato', title, date, sets: [],
        url: href ? BASE + href : BASE, details, personnel,
      });
    }
  }
  return [...drafts.values()].map((d) => makeEvent(applyLateNight(d)));
}

// Detail page lists that night's performances: "… - 08:00 PM PDT".
export function parseDetailSets(html) {
  const sets = [...new Set(
    [...String(html).matchAll(/-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*P[DS]T/gi)]
      .map((m) => normalizeTime(m[1])).filter(Boolean)
  )].sort();
  return { sets };
}

export async function crawl(ctx = {}) {
  const out = [];
  const seen = new Set();
  for (let p = 1; p <= MAX_LIST_PAGES; p++) {
    let added = 0;
    try {
      for (const e of parse(await fetchText(p === 1 ? `${BASE}/` : `${BASE}/?page=${p}`))) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
        added++;
      }
    } catch (err) {
      if (p === 1) throw err;
      break;
    }
    if (!added) break;
    await sleep(250);
  }
  await enrichFromDetailPages(out, ctx, {
    fields: ['sets'],
    extract: parseDetailSets,
    maxPages: 25,
  });
  return out;
}
