// Body & Soul (Minami-Aoyama) — Kyoko Seki's legendary basement since 1974,
// the mama-san room where Tokyo's straight-ahead scene lives. WordPress;
// /schedule server-renders event-archive blocks (verified 2026-07-19):
//   <h2 class="event-arc-title"><a href="https://bodyandsoul.co.jp/event/260719">
//   M.Charge ￥4,800(税込￥5,280)...
//   Open 18:30, 1st 19:30, 2nd 21:00
//   小田桐和寛(ds) 曽我部泰紀(as) 石川広行(tp) 中林薫平(b)
// The show DATE is the event slug: /event/YYMMDD[suffix]. Two sets most
// nights. All jazz — no filter.
import {
  fetchText, makeEvent, htmlToText, isoDate, cleanText, personnelFromJpRun,
} from '../lib.js';
import { applyRomaji, romajiPersonnel } from './_jpromaji.js';

const BASE = 'https://bodyandsoul.co.jp';

export function parse(html) {
  const events = [];
  const seen = new Set();
  const segments = String(html).split(/(?=<h2 class="event-arc-title")/).slice(1);
  for (const seg of segments) {
    const link = seg.match(/href="(https?:\/\/(?:www\.)?bodyandsoul\.co\.jp\/event\/(\d{6})[a-z]?\/?)"/i);
    if (!link) continue;
    const [, url, ymd] = link;
    const date = isoDate(2000 + Number(ymd.slice(0, 2)), Number(ymd.slice(2, 4)), Number(ymd.slice(4, 6)));
    const title = cleanText(htmlToText((seg.match(/<h2 class="event-arc-title">([\s\S]*?)<\/h2>/) ?? [])[1] ?? ''));
    if (!title) continue;
    const txt = htmlToText(seg);
    const sets = [...txt.matchAll(/\b(?:1st|2nd)\s+(\d{1,2}:\d{2})/gi)].map((m) => m[1]);
    const price = (txt.match(/M\.?Charge\s*[￥¥]([\d,]+)/i) ?? [])[1];
    const ev = makeEvent({
      clubId: 'bodyandsoul',
      title,
      titleAlt: applyRomaji(title) ?? undefined,
      date,
      sets,
      url,
      details: null,
      personnel: romajiPersonnel(personnelFromJpRun(txt)),
      priceText: price ? `¥${price}` : null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/schedule`));
}
