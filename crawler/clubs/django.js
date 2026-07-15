// The Django (Roxy Hotel cellar, Tribeca) — WordPress, server-rendered
// /events/ page. Each show is an <article class="event_card"> carrying an
// exact ISO datetime:
//   <article class="event_card" data-datetime="2026-07-14T20:00:00.000-0400">
//     <h3 class="event__title">Helio Alves Quintet</h3>
//     <p class="event_card__time-pair"><span>7:00PM</span>…<span>8:45PM</span></p>
//     <a class="details-container" href="…/events/slug/?selected_date=…">Details</a>
import { fetchText, makeEvent, matchBlocks, htmlToText, extractTimes, splitIso } from '../lib.js';

const URL_ = 'https://www.thedjangonyc.com/events/';

export function parse(html) {
  const events = [];
  for (const card of matchBlocks(html, 'article', /event_card/)) {
    // date from the card's own datetime attr… which sits on the OPENING tag,
    // so re-find it: matchBlocks returns inner HTML only. Fall back to the
    // group wrapper's data-date when absent (defensive).
    const title = htmlToText(card.match(/<h3[^>]*event__title[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
    if (!title) continue;
    const timePair = card.match(/<p[^>]*event_card__time-pair[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const sets = extractTimes(htmlToText(timePair).replace(/(\d)(AM|PM)/gi, '$1 $2'));
    const urlM = card.match(/<a[^>]*details-container[^>]*href="([^"]*\/events\/[^"]*)"/i)
      ?? card.match(/href="(https?:\/\/www\.thedjangonyc\.com\/events\/[^"]+)"/i);
    const dateM = card.match(/selected_date=(\d{4}-\d{2}-\d{2})/);
    if (!dateM) continue;
    events.push(makeEvent({
      clubId: 'django',
      title,
      date: dateM[1],
      sets,
      url: urlM ? urlM[1].replace(/&amp;/g, '&') : URL_,
    }));
  }
  // The datetime attr lives on the opening tag which matchBlocks strips, so
  // when the ?selected_date fallback also failed for every card, re-scan the
  // raw page pairing opening tags with titles (keeps the parser honest if
  // they drop the Details links).
  if (events.length === 0) {
    const re = /<article[^>]*event_card[^>]*data-datetime="([^"]+)"[\s\S]*?event__title[^>]*>([\s\S]*?)<\/h3>/gi;
    let m;
    while ((m = re.exec(html))) {
      const { date, time } = splitIso(m[1]);
      const title = htmlToText(m[2]);
      if (!title || !date) continue;
      events.push(makeEvent({ clubId: 'django', title, date, sets: time ? [time] : [], url: URL_ }));
    }
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
