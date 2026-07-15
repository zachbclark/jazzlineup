// Catalina Jazz Club (6725 W Sunset Blvd, Hollywood) — WordPress with the
// TicketWeb events plugin, the same family as Birdland's markup:
//   <div class="tw-section"> … <div class="tw-name"><a href="…/tm-event/slug/">Title</a></div>
//     <span class="name-of-month">Jul</span> <span class="date-of-month">15</span>
//     <span class="tw-event-time">8:30 pm</span> <span class="tw-event-door-time">7:00 pm</span>
import { fetchText, makeEvent, matchBlocks, htmlToText, monthNum, inferYear, isoDate, normalizeTime } from '../lib.js';

const BASE = 'https://catalinajazzclub.com';

export function parse(html, today = new Date()) {
  const events = [];
  for (const sec of matchBlocks(html, 'div', /tw-section/)) {
    const title = htmlToText(sec.match(/tw-name[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
    const mon = htmlToText(sec.match(/name-of-month[^>]*>([\s\S]*?)<\//i)?.[1] ?? '');
    const day = htmlToText(sec.match(/date-of-month[^>]*>([\s\S]*?)<\//i)?.[1] ?? '');
    if (!title || !monthNum(mon) || !/^\d{1,2}$/.test(day)) continue;
    const month = monthNum(mon);
    const date = isoDate(inferYear(month, Number(day), today), month, Number(day));

    const showTime = normalizeTime(htmlToText(sec.match(/tw-event-time(?:-complete)?[^>]*>([\s\S]*?)<\/(?:span|div)>/i)?.[1] ?? ''));
    const doorTime = normalizeTime(htmlToText(sec.match(/tw-event-door-time[^>]*>([\s\S]*?)<\/(?:span|div)>/i)?.[1] ?? ''));
    const url = sec.match(/href="([^"]*tm-event[^"]*)"/i)?.[1] ?? `${BASE}/calendar/`;

    events.push(makeEvent({
      clubId: 'catalina',
      title,
      date,
      sets: showTime ? [showTime] : [],
      url,
      details: doorTime && doorTime !== showTime ? `Doors @ ${htmlToText(sec.match(/tw-event-door-time[^>]*>([\s\S]*?)<\/(?:span|div)>/i)?.[1] ?? '').trim()}` : null,
    }));
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/`));
}
