// Shared crawler for the Blue Note Japan reservation platform — Blue Note
// Tokyo (reserve.bluenote.co.jp) and Cotton Club (reserve.cottonclubjapan.
// co.jp) run identical systems.
//
// 2026-11-02 rebuild: the platform was redesigned (~Oct 28) and the old
// <table class="later"> month view is gone, which zeroed both venues. Now:
// - /reserve/schedule/move/YYYYMM lists one card per show-run, each with a
//   data-schedule-modal-endpoint ".../read_event_info/<id>".
// - That endpoint is JSON: en/jp titles, music charge, and schedule_list,
//   one entry per date with per-set start times ("stages"), plus
//   links.detail_page_url, the artist page.
//     { basic_info: { titles: { en_title, jp_title, ... },
//         music_charge_label: "Music Charge ¥9,500", catchphrase },
//       schedule_list: [{ date_iso: "2026-11-01",
//         stages: [{ label: "1st", start_time: "4:30pm" }, ...] }],
//       links: { detail_page_url: "https://www.bluenote.co.jp/jp/artists/kiefer/" } }
// Titles can carry <br/> ("odol ONE-MAN LIVE 2026 <br/>at COTTON CLUB").
// A run that spans two months shows up in both month lists; one fetch each.
// Any failed run fetch fails the whole crawl, so the merge keeps the
// previous shows and the dead-venue alert names it, instead of a partial
// list quietly passing as fresh.
//
// Each run's artist page has the MEMBER roster ("Simon Phillips(ds)") that
// personnelFromJpRun parses; fetched via detail enrichment, one page per run.
import {
  fetchText, fetchJson, makeEvent, htmlToText, cleanText, sleep, normalizeTime,
  personnelFromJpRun, jpDate,
} from '../lib.js';
import { applyRomaji } from './_jpromaji.js';
import { enrichFromDetailPages } from './_enrichdetails.js';

// Artist page rosters, two shapes on one platform family:
// - Blue Note Tokyo: MEMBER table with roman cells <td class="pr20"><p>Name(ds)</p>
// - Cotton Club: a plain MEMBER heading followed by "Joyce Moreno (vo,g)"
//   lines (ends at the next bracketed section like [予約受付開始日])
// (\bMEMBER\b won't match the nav's "MEMBERS" link — the S is a word char.)
export function parseArtistPage(html) {
  const cells = [...String(html).matchAll(/<td[^>]*class="pr20"[^>]*>\s*<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => htmlToText(m[1]).trim()).filter(Boolean);
  let text = cells.join('\n');
  if (!text) {
    const m = htmlToText(html).match(/\bMEMBER\b\s*([\s\S]{0,600}?)(?=\n\s*[\[【]|$)/);
    text = m ? m[1] : '';
  }
  const personnel = personnelFromJpRun(text, { maxName: 40 });
  return personnel.length ? { personnel } : null;
}

// Month page -> each show-run's info URL, as the page gives it, in order.
export function parseMonth(html) {
  return [...String(html).matchAll(/data-schedule-modal-endpoint="([^"]*read_event_info\/\d+)"/g)]
    .map((m) => m[1]);
}

const oneLine = (s) => cleanText(htmlToText(String(s ?? '')).replace(/\s*\n\s*/g, ' '));

// One show-run's info JSON -> one event per date.
export function parseEventInfo(data, clubId, siteUrl) {
  const t = data?.basic_info?.titles ?? {};
  const en = oneLine(`${t.en_prefix ?? ''} ${t.en_title ?? ''}`);
  const jp = oneLine(`${t.jp_prefix ?? ''} ${t.jp_title ?? ''}`);
  const title = en || jp;
  if (!title) return [];
  const titleAlt = en ? (jp && jp !== en ? jp : undefined) : (applyRomaji(jp) ?? undefined);
  // half- or full-width yen ("¥9,500" / "￥9,500"); first price if several
  const price = (String(data.basic_info?.music_charge_label ?? '').match(/[¥￥]\s?([\d,]+)/) ?? [])[1];
  const details = oneLine(data.basic_info?.catchphrase).slice(0, 200) || null;
  const url = data.links?.detail_page_url || siteUrl;
  const events = [];
  for (const day of data.schedule_list ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date_iso ?? '')) continue;
    events.push(makeEvent({
      clubId,
      title,
      titleAlt,
      date: day.date_iso,
      sets: (day.stages ?? []).map((s) => normalizeTime(s.start_time)).filter(Boolean),
      url,
      details,
      priceText: price ? `¥${price}` : null,
    }));
  }
  return events;
}

// Events from every run -> one per id. Two runs with the same title on the
// same night (matinee + evening listed separately) become one event with
// both runs' sets.
export function mergeRuns(eventLists) {
  const byId = new Map();
  for (const ev of eventLists.flat()) {
    const prev = byId.get(ev.id);
    if (prev) prev.sets = [...new Set([...prev.sets, ...ev.sets])].sort();
    else byId.set(ev.id, { ...ev, sets: [...ev.sets] });
  }
  return [...byId.values()];
}

export function makeBlueNoteJpCrawler({ clubId, host, siteUrl }) {
  return async function crawl(ctx = {}) {
    // this month and next in Tokyo time (UTC is 9h behind on the 1st)
    const [y, m] = jpDate(Date.now()).split('-').map(Number);
    const infoUrls = new Set();
    for (let i = 0; i < 2; i++) {
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      try {
        for (const url of parseMonth(await fetchText(`https://${host}/reserve/schedule/move/${ym}`))) infoUrls.add(url);
      } catch (err) {
        if (i === 0) throw err;
      }
      await sleep(400);
    }
    const runs = [];
    for (const url of infoUrls) {
      runs.push(parseEventInfo(await fetchJson(url), clubId, siteUrl));
      await sleep(300);
    }
    const events = mergeRuns(runs);
    // rosters live on the artist pages; a run's dates share one page/fetch
    await enrichFromDetailPages(events.filter((e) => e.url !== siteUrl), ctx, {
      fields: ['personnel'],
      extract: parseArtistPage,
      maxPages: 12,
    });
    return events;
  };
}
