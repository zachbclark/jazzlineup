// 38 Riv (38 rue de Rivoli, Le Marais) — vaulted-cellar jazz club, two sets
// most nights plus weekly jams. Drupal; /concerts server-renders the agenda
// (title + aria-label + date like "JEU. 16/ JUILLET 07/ 2026" — numeric
// month included). Set TIMES only live on detail pages ("VEN. 17 /07 /2026
// 19:30" rows), so we enrich like Smalls: copy sets from the previous crawl
// by stable event id, fetch detail pages only for events still missing
// them. All jazz — no filter.
import { fetchText, makeEvent, applyLateNight, htmlToText, isoDate, cleanText, sleep, personnelFromLines } from '../lib.js';

const BASE = 'https://38riv.com';
const URL_ = `${BASE}/concerts`;
const ENRICH_MAX_PAGES = 30;
const ENRICH_CONCURRENCY = 3;

export function parse(html) {
  const events = [];
  const seen = new Set();
  const rows = html.match(/<article[^>]*agenda-item-container[\s\S]*?(?=<article[^>]*agenda-item-container|$)/gi) ?? [];
  for (const row of rows) {
    const link = row.match(/href="(\/concerts\/[^"]+)"[^>]*aria-label="([^"]+)"/i);
    if (!link) continue;
    const txt = htmlToText(row.replace(/<img[^>]*>/gi, ' '));
    const dm = txt.match(/(\d{1,2})\s*\/\s*[A-Za-zÛÉÀûéà]+\.?\s*(\d{2})\s*\/\s*(\d{4})/);
    if (!dm) continue;
    const ev = makeEvent({
      clubId: 'riv38',
      title: cleanText(link[2]),
      date: isoDate(Number(dm[3]), Number(dm[2]), Number(dm[1])),
      sets: [],
      url: BASE + link[1],
      details: null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

// Detail pages also usually list the band one player per line — grab the
// roster while we're already there for the set times.
export function parseDetailPersonnel(html) {
  return personnelFromLines(htmlToText(html));
}

// Detail pages list one dated row per set: "VEN. 17 /07 /2026 19:30".
export function parseDetailSets(html) {
  const byDate = new Map(); // 'YYYY-MM-DD' -> ['19:30','21:30']
  const txt = htmlToText(html);
  for (const m of txt.matchAll(/(\d{1,2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})\s+(\d{2}:\d{2})/g)) {
    const date = isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
    if (!byDate.has(date)) byDate.set(date, []);
    if (!byDate.get(date).includes(m[4])) byDate.get(date).push(m[4]);
  }
  return byDate;
}

export async function crawl(ctx = {}) {
  const events = parse(await fetchText(URL_));

  // reuse sets AND personnel found by earlier crawls (ids are stable)
  const prior = new Map((ctx.previousEvents ?? []).map((e) => [e.id, e]));
  for (const e of events) {
    const p = prior.get(e.id);
    if (!p) continue;
    if (!e.sets.length && p.sets?.length) e.sets = p.sets;
    if (!e.personnel && p.personnel?.length) e.personnel = p.personnel;
  }

  const urls = [...new Set(
    events.filter((e) => !e.sets.length || !e.personnel)
      .sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.url)
  )].slice(0, ENRICH_MAX_PAGES);
  const byUrl = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: ENRICH_CONCURRENCY }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        const html = await fetchText(url);
        byUrl.set(url, { sets: parseDetailSets(html), personnel: parseDetailPersonnel(html) });
      } catch { /* skip */ }
      await sleep(200);
    }
  }));
  for (const e of events) {
    const got = byUrl.get(e.url);
    if (!got) continue;
    const sets = got.sets.get(e.date);
    if (sets?.length && !e.sets.length) e.sets = sets;
    if (got.personnel.length && !e.personnel) e.personnel = got.personnel;
  }
  return events.map((e) => makeEvent(applyLateNight(e)));
}
