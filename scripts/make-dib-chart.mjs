// r/dataisbeautiful chart: "Which night of the week has the most live jazz?"
// City × weekday heatmap from the data files. Reads every data/events-*.json
// present, renders a self-contained dark chart page, screenshots it at 2x:
//   node scripts/make-dib-chart.mjs        -> /tmp/jazz-nights.png
// Rerun on fresh data any time; the chart footer stamps the event count.
// Form notes (dataviz method): magnitude in a grid -> heatmap, sequential
// single-hue (brand gold, brighter = more), % share within each city so
// venue-count differences between cities don't drown the pattern.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUT = '/tmp/jazz-nights.png';

const CITY_LABELS = { nyc: 'New York', la: 'Los Angeles', chi: 'Chicago', sf: 'SF Bay Area', par: 'Paris', lon: 'London' };
const CITY_ORDER = ['nyc', 'la', 'chi', 'sf', 'par', 'lon'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const today = new Date().toISOString().slice(0, 10);
const rows = [];
let total = 0;
const files = (await readdir(DATA_DIR)).filter((f) => /^events-[a-z]+\.json$/.test(f));
for (const id of CITY_ORDER) {
  if (!files.includes(`events-${id}.json`)) continue;
  const d = JSON.parse(await readFile(join(DATA_DIR, `events-${id}.json`), 'utf8'));
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const e of d.events) {
    if (e.date < today) continue;
    counts[(new Date(e.date + 'T12:00:00Z').getUTCDay() + 6) % 7]++;
    n++;
  }
  if (!n) continue;
  rows.push({ id, label: CITY_LABELS[id] ?? id, n, pct: counts.map((c) => (100 * c) / n) });
  total += n;
}
if (rows.length < CITY_ORDER.length) {
  console.warn(`NOTE: only ${rows.length} cities present — rerun with all data files`);
}

const max = Math.max(...rows.flatMap((r) => r.pct));
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const ramp = (t) => {
  const from = [33, 27, 16], to = [245, 205, 120]; // #211b10 -> #f5cd78
  return `rgb(${lerp(from[0], to[0], t)},${lerp(from[1], to[1], t)},${lerp(from[2], to[2], t)})`;
};
const inkFor = (t) => (t > 0.55 ? '#14100a' : '#d8d0c0');

const cells = rows.map((r) => {
  const peak = r.pct.indexOf(Math.max(...r.pct));
  return `<div class="rowlabel">${r.label}<span class="n">${r.n} shows</span></div>` + r.pct.map((p, i) => {
    const t = p / max;
    return `<div class="cell${i === peak ? ' peak' : ''}" style="background:${ramp(t)};color:${inkFor(t)}">${p.toFixed(0)}%</div>`;
  }).join('');
}).join('');

const keySteps = [0, 0.25, 0.5, 0.75, 1].map((t) => `<span style="background:${ramp(t)}"></span>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; background: #0d0b08; color: #f5efe4; padding: 52px 60px 40px;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.3px; }
  .sub { color: #a89f8e; font-size: 15.5px; margin: 8px 0 34px; }
  .grid { display: grid; grid-template-columns: 190px repeat(7, 1fr); gap: 2px; }
  .head { color: #a89f8e; font-size: 13px; font-weight: 600; text-align: center; padding: 0 0 8px; }
  .rowlabel { color: #f5efe4; font-size: 14.5px; font-weight: 600; padding-right: 14px; display: flex; flex-direction: column; justify-content: center; }
  .rowlabel .n { color: #8f877a; font-size: 11.5px; font-weight: 400; margin-top: 2px; }
  .cell {
    height: 64px; display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 600; border-radius: 4px;
    font-variant-numeric: tabular-nums;
  }
  .cell.peak { outline: 2px solid #f5efe4; outline-offset: -2px; font-weight: 800; }
  .keyrow { display: flex; align-items: center; gap: 10px; margin-top: 22px; color: #a89f8e; font-size: 12.5px; }
  .key { display: inline-flex; }
  .key span { width: 26px; height: 10px; }
  .key span:first-child { border-radius: 3px 0 0 3px; } .key span:last-child { border-radius: 0 3px 3px 0; }
  .foot { display: flex; justify-content: space-between; margin-top: 26px; color: #8f877a; font-size: 12.5px; }
  .foot .site { color: #e8b458; font-weight: 600; }
</style></head><body>
  <h1>Which night of the week has the most live jazz?</h1>
  <div class="sub">Share of each city's upcoming club dates by night — ${total.toLocaleString()} shows at 72 jazz venues. Outlined cell = the city's busiest night.</div>
  <div class="grid">
    <div class="head"></div>${DAYS.map((d) => `<div class="head">${d}</div>`).join('')}
    ${cells}
  </div>
  <div class="keyrow"><span>fewer</span><span class="key">${keySteps}</span><span>more of the city's shows</span></div>
  <div class="foot">
    <span>Every show is a real listed club date, crawled from venue websites.</span>
    <span class="site">jazzlineup.com</span>
  </div>
</body></html>`;

const tmp = join(__dirname, 'dib-chart.html');
await writeFile(tmp, html);

const { chromium } = await import('playwright').catch(() =>
  import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'));
const browser = await chromium.launch().catch(() =>
  chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }));
const page = await browser.newPage({ viewport: { width: 1200, height: 200 }, deviceScaleFactor: 2 });
await page.goto('file://' + tmp);
await page.waitForTimeout(200);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log(`wrote ${OUT} — ${total} shows, ${rows.length} cities`);
