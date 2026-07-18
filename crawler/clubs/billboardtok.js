// Billboard Live Tokyo (Tokyo Midtown, Roppongi) — the big-production
// supper club; jazz, soul, city-pop royalty. Included WHOLESALE per Zach
// (2026-07-19). Their 2026 Next.js relaunch server-renders one day per
// page (/schedules?today=YYYY-MM-DD) with ALL THREE shops' cards on it —
// each card is attributed to a shop by the nearest preceding TOKYO/
// YOKOHAMA/OSAKA marker (an Osaka city would reuse this file with a
// different marker). Markup notes (verified 2026-07-19):
//   <div class="ArtistCardFull_root...">
//     <h3 class="EventHeading_mainTitle__HASH" aria-label="藤木直人">
//     <p class="EventHeading_subTitle...">Naohito Fujiki Live Tour...</p>
//     <li>1st Stage<!-- --> / Open <!-- -->14:00<!-- --> / Start <!-- -->15:00</li>
//   React sprinkles <!-- --> comment nodes through the text — STRIP
//   COMMENTS FIRST (the Duc des Lombards lesson). CSS-module hashes churn
//   per deploy, so match stable class PREFIXES only.
import {
  fetchText, makeEvent, applyLateNight, isoDate, htmlToText, cleanText, sleep,
} from '../lib.js';

const BASE = 'https://www.billboard-live.com';
const DAYS_AHEAD = 35;

export function parse(html, dateIso, shop = 'TOKYO', clubId = 'billboardtok') {
  const events = [];
  const clean = String(html).replace(/<!--[\s\S]*?-->/g, '');
  const cardRe = /class="ArtistCardFull_root/g;
  const cards = [];
  let m;
  while ((m = cardRe.exec(clean))) cards.push(m.index);
  for (let i = 0; i < cards.length; i++) {
    const card = clean.slice(cards[i], cards[i + 1] ?? clean.length);
    // shop attribution: nearest shop marker BEFORE this card
    const before = clean.slice(0, cards[i]);
    const pos = ['TOKYO', 'YOKOHAMA', 'OSAKA']
      .map((s) => [s, before.lastIndexOf('>' + s + '<')])
      .sort((a, b) => b[1] - a[1])[0];
    if (!pos || pos[1] < 0 || pos[0] !== shop) continue;
    const title = cleanText((card.match(/class="EventHeading_mainTitle[^"]*"[^>]*aria-label="([^"]+)"/) ?? [])[1] ?? '');
    if (!title) continue;
    const sub = cleanText(htmlToText((card.match(/class="EventHeading_subTitle[^"]*"[^>]*>([\s\S]*?)<\/p>/) ?? [])[1] ?? ''));
    const sets = [...new Set([...card.matchAll(/Start\s*(\d{1,2}:\d{2})/g)].map((x) => x[1]))];
    const prices = [...card.matchAll(/[￥¥]([\d,]+)/g)].map((x) => Number(x[1].replace(/,/g, ''))).filter((n) => n > 500);
    events.push(makeEvent(applyLateNight({
      clubId,
      title,
      titleAlt: sub && sub !== title ? sub : undefined,
      date: dateIso,
      sets,
      url: `${BASE}/schedules?shop=tokyo`,
      details: null,
      priceText: prices.length ? `from ¥${Math.min(...prices).toLocaleString()}` : null,
    })));
  }
  return events;
}

export async function crawl() {
  const out = [];
  const seen = new Set();
  const base = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const iso = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    try {
      for (const e of parse(await fetchText(`${BASE}/schedules?today=${iso}`), iso)) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    } catch (err) {
      if (i === 0) throw err;
    }
    await sleep(150);
  }
  return out;
}
