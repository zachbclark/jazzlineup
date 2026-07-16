// Blue Note Los Angeles (6372 W Sunset Blvd, Hollywood) — opened August
// 2025 next to the old ArcLight. Identical WordPress platform to Blue Note
// NYC; see bluenote.js for the markup notes. Includes both rooms: the main
// club and B-Side (their bar stage) — the room name lands in details.
import { parseMonth, makeBlueNoteCrawler } from './bluenote.js';

export function parse(html, year, month) {
  return parseMonth(html, year, month, { clubId: 'bluenotela', region: 'la' });
}

export const crawl = makeBlueNoteCrawler({ clubId: 'bluenotela', region: 'la' });
