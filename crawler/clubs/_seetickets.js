// Shared extractor for the SeeTickets WordPress plugin (Constellation and
// Hungry Brain — both Mike Reed rooms on the same setup). The venue's
// /calendar/ page server-renders event cards:
//   <div class="... seetickets-list-event-container ...">
//     <p class="... title"><a href="https://wl.seetickets.us/event/...">TITLE</a></p>
//     <p class="... date">Thu Jul 16</p>                (no year!)
//     <p class="... headliners">...</p> <p class="... supporting-talent">...</p>
//     <p class="... doortime-showtime">Doors: <span>7:30PM</span> / Show: <span>8:00PM</span></p>
//     <p class="... genre">Jazz</p>  <p class="... price">$30.00</p>
// The genre tag is hidden by CSS but present in the markup — that's our
// jazz filter for these mixed-genre rooms.
import {
  makeEvent, applyLateNight, normalizeTime, inferYear, isoDate, monthNum,
  cleanText, fetchText,
} from '../lib.js';

const CARD_RE = /<div[^>]+class="[^"]*seetickets-list-event-container[^"]*"[\s\S]{0,4000}?(?=<div[^>]+class="[^"]*seetickets-list-event-container|<div class="seetickets-list-view-pagination|$)/g;

const field = (card, cls) =>
  (card.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>(?:\\s*<a[^>]*>)?([^<]*)`, 'i')) ?? [])[1] ?? '';

export function parseSeeTickets(html, clubId, { jazzRe = /jazz/i, fallbackUrl, today = new Date() } = {}) {
  const events = [];
  for (const card of html.match(CARD_RE) ?? []) {
    const title = cleanText(field(card, 'title'));
    const dateTxt = cleanText(field(card, 'date')); // "Thu Jul 16"
    const genre = cleanText(field(card, 'genre'));
    if (!title || !dateTxt) continue;
    if (genre && !jazzRe.test(genre)) continue; // mixed room: jazz events only
    if (!genre) continue; // no genre tag = can't vouch for it; skip
    const dm = dateTxt.match(/([A-Za-z]+)\s+(\d{1,2})$/);
    if (!dm) continue;
    const month = monthNum(dm[1]);
    if (!month) continue;
    const day = Number(dm[2]);
    const date = isoDate(inferYear(month, day, today), month, day);
    const show = normalizeTime((card.match(/Show:\s*<span[^>]*>\s*([^<]+)/i) ?? [])[1]);
    const support = cleanText(field(card, 'supporting-talent'));
    const price = cleanText(field(card, 'price'));
    const url = (card.match(/href="(https?:\/\/wl\.seetickets\.us\/event\/[^"]+)"/i) ?? [])[1];
    events.push(makeEvent(applyLateNight({
      clubId,
      title,
      date,
      sets: show ? [show] : [],
      url: url ?? fallbackUrl,
      details: support || null,
      priceText: price || null,
    })));
  }
  return events;
}

export function makeSeeTicketsCrawler({ clubId, calendarUrl, jazzRe }) {
  return async function crawl(ctx = {}) {
    return parseSeeTickets(await fetchText(calendarUrl), clubId, {
      jazzRe, fallbackUrl: calendarUrl, today: ctx.today ?? new Date(),
    });
  };
}
