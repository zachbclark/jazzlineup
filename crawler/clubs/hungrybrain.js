// Hungry Brain (2319 W Belmont Ave, Roscoe Village) — Constellation's
// scrappier sister room (same Mike Reed orbit); home of the long-running
// Sunday improvised-music series. Same SeeTickets WP plugin — see
// _seetickets.js. Mixed bookings (country, DJ, readings), genre-filtered.
import { parseSeeTickets, makeSeeTicketsCrawler } from './_seetickets.js';

const CAL = 'https://hungrybrainchicago.com/calendar/';

export function parse(html, today = new Date()) {
  return parseSeeTickets(html, 'hungrybrain', { fallbackUrl: CAL, today });
}

export const crawl = makeSeeTicketsCrawler({ clubId: 'hungrybrain', calendarUrl: CAL });
