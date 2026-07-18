// Cotton Club (Marunouchi, Tokyo Bldg TOKIA 2F) — supper club from the Blue
// Note Japan family; same reservation platform, see _bluenotejp.js.
// Included wholesale per Zach (2026-07-19) — jazz-forward but books soul,
// pop, and kayōkyoku royalty too.
import { parseMonth, makeBlueNoteJpCrawler } from './_bluenotejp.js';

export function parse(html, year, month) {
  return parseMonth(html, year, month, 'cottonclubtok', 'https://www.cottonclubjapan.co.jp/jp/sp/artists/');
}

export const crawl = makeBlueNoteJpCrawler({
  clubId: 'cottonclubtok',
  host: 'reserve.cottonclubjapan.co.jp',
  siteUrl: 'https://www.cottonclubjapan.co.jp/jp/sp/artists/',
});
