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
//
// Each run's artist page has the MEMBER roster ("Simon Phillips(ds)") that
// personnelFromJpRun parses; fetched via detail enrichment, one page per run.
import {
  fetchText, makeEvent, htmlToText, cleanText, sleep, normalizeTime,
  personnelFromJpRun,
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

// Month page -> the show-run ids it lists, in page order.
export function parseMonth(html) {
  const ids = [...String(html).matchAll(/read_event_info\/(\d+)/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

const oneLine = (s) => cleanText(htmlToText(String(s ?? '')).replace(/\s*\n\s*/g, ' '));

// One show-run's JSON -> one event per date.
export function parseEventInfo(info, clubId, siteUrl) {
  const data = typeof info === 'string' ? JSON.parse(info) : info;
  const t = data?.basic_info?.titles ?? {};
  const en = oneLine(`${t.en_prefix ?? ''} ${t.en_title ?? ''}`);
  const jp = oneLine(`${t.jp_prefix ?? ''} ${t.jp_title ?? ''}`);
  const title = en || jp;
  if (!title) return [];
  const titleAlt = en ? (jp && jp !== en ? jp : undefined) : (applyRomaji(jp) ?? undefined);
  const price = (String(data.basic_info?.music_charge_label ?? '').match(/¥\s?[\d,]+/) ?? [])[0];
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
      priceText: price ? price.replace(/\s/g, '') : null,
    }));
  }
  return events;
}

export function makeBlueNoteJpCrawler({ clubId, host, siteUrl }) {
  return async function crawl(ctx = {}) {
    const now = new Date();
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
      try {
        for (const id of parseMonth(await fetchText(`https://${host}/reserve/schedule/move/${ym}`))) {
          if (!ids.includes(id)) ids.push(id);
        }
      } catch (err) {
        if (i === 0) throw err;
      }
      await sleep(400);
    }
    const events = [];
    const seen = new Set();
    for (const id of ids) {
      try {
        const info = await fetchText(`https://${host}/reserve/schedule/read_event_info/${id}`);
        for (const ev of parseEventInfo(info, clubId, siteUrl)) {
          if (seen.has(ev.id)) continue;
          seen.add(ev.id);
          events.push(ev);
        }
      } catch { /* one bad run never sinks the venue */ }
      await sleep(300);
    }
    // rosters live on the artist pages; a run's dates share one page/fetch
    await enrichFromDetailPages(events.filter((e) => e.url !== siteUrl), ctx, {
      fields: ['personnel'],
      extract: parseArtistPage,
      maxPages: 12,
    });
    return events;
  };
}
