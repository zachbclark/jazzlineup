// Blue Note Tokyo (6-3-16 Minami-Aoyama) — Japan's flagship since 1988.
// Runs the shared Blue Note Japan reservation platform; see _bluenotejp.js.
// Legacy-institution policy: include everything they book (Zach 2026-07-19).
import { parseMonth, makeBlueNoteJpCrawler } from './_bluenotejp.js';

export function parse(html, year, month) {
  return parseMonth(html, year, month, 'bluenotetok', 'https://www.bluenote.co.jp/jp/artists/schedule/');
}

export const crawl = makeBlueNoteJpCrawler({
  clubId: 'bluenotetok',
  host: 'reserve.bluenote.co.jp',
  siteUrl: 'https://www.bluenote.co.jp/jp/artists/schedule/',
});
