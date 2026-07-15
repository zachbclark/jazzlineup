// Constellation (3111 N Western Ave, Roscoe Village) — Mike Reed's
// performance space; the center of Chicago's creative/improvised scene.
// SeeTickets WP plugin, server-rendered cards with (CSS-hidden) genre tags;
// mixed programming, so we keep the jazz. See _seetickets.js.
import { parseSeeTickets, makeSeeTicketsCrawler } from './_seetickets.js';

const CAL = 'https://constellation-chicago.com/calendar/';

export function parse(html, today = new Date()) {
  return parseSeeTickets(html, 'constellation', { fallbackUrl: CAL, today });
}

export const crawl = makeSeeTicketsCrawler({ clubId: 'constellation', calendarUrl: CAL });
