// Regenerate web/public/og.png (the social share card), 1200x630.
// The card is plain HTML rendered with the same look as the site (black +
// gold, venue-colored chips) and screenshotted with Playwright. Rerun this
// whenever the pitch line or the venue roster changes:
//   node scripts/make-og.mjs
import { writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUBS } from '../crawler/clubs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'web', 'public', 'og.png');
const DIST = join(__dirname, '..', 'web', 'dist', 'og.png');

// one flagship room per vibe, spanning all six cities
const PICKS = ['vanguard', 'bluenote', 'smalls', 'dizzys', 'greenmill', 'sfjazz',
  'zebulon', 'duc', 'ronnies', 'yoshis', 'bakedpotato'];
const chips = PICKS.map((id) => CLUBS.find((c) => c.id === id)).filter(Boolean);
const rest = CLUBS.length - chips.length;

const chipHtml = chips.map((c) => `
  <span class="chip" style="color:${c.color};border-color:${c.color}">
    <span class="dot" style="background:${c.color}"></span>${c.shortName}
  </span>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: #0d0b08;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 34px; color: #f5efe4;
  }
  h1 { font-size: 84px; font-weight: 800; letter-spacing: -1px; }
  h1 .note { color: #e8b458; font-size: 64px; vertical-align: 6px; margin-right: 18px; }
  h1 .gold { color: #e8b458; }
  .pitch { font-size: 31px; color: #d8d0c0; font-weight: 400; text-align: center; line-height: 1.4; }
  .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px 18px; max-width: 1080px; }
  .chip {
    display: inline-flex; align-items: center; gap: 10px;
    border: 2px solid; border-radius: 999px; padding: 12px 26px;
    font-size: 27px; font-weight: 600;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
  .more { font-size: 24px; color: #8f877a; }
  .site { font-size: 28px; color: #f5efe4; letter-spacing: 0.5px; }
</style></head><body>
  <h1><span class="note">&#9835;</span>Jazz <span class="gold">Lineup</span></h1>
  <div class="pitch">Every jazz club in New York, LA, Chicago, SF, Paris &amp; London.<br>One calendar, updated all day.</div>
  <div class="chips">${chipHtml}</div>
  <div class="more">plus ${rest} more rooms, from legendary basements to living-room sessions</div>
  <div class="site">jazzlineup.com</div>
</body></html>`;

const tmp = join(__dirname, 'og-card.html');
await writeFile(tmp, html);

const { chromium } = await import('playwright').catch(() =>
  import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'));
const browser = await chromium.launch().catch(() =>
  chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }));
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + tmp);
await page.waitForTimeout(300);
await page.screenshot({ path: OUT });
await browser.close();
await copyFile(OUT, DIST).catch(() => {});
console.log(`wrote ${OUT} (${chips.length} chips, "+${rest} more rooms")`);
