// UI test suite — Playwright against the built frontend + real data.
//   npm run test:ui        (build first: npm run build:web)
// First run on a new machine: npm i -D playwright && npx playwright install chromium
//
// Suites live in web/tests/ and share one server + browser boot. They run in
// order and several tests depend on state left by earlier ones (and clean up
// after themselves — the test hygiene rule); keep the sequence.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summary } from './tests/_harness.mjs';
import desktopBasics from './tests/desktop-basics.mjs';
import chips from './tests/chips.mjs';
import searchRouting from './tests/search-routing.mjs';
import mobile from './tests/mobile.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3987;

// Real data files are required and gitignored (since 2026-07-20) — several
// tests derive their inputs from upcoming events in them.
if (!existsSync(join(__dirname, '..', 'data', 'events-nyc.json'))) {
  console.error('No local data files. Run: npm run data:pull   (or npm run crawl)');
  process.exit(1);
}

async function loadPlaywright() {
  try { return await import('playwright'); }
  catch {
    // sandbox fallback (globally installed playwright)
    return import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs');
  }
}

async function launch(chromium) {
  try { return await chromium.launch(); }
  catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  }
}

// --- boot server ---------------------------------------------------------------
const server = spawn('node', [join(__dirname, '..', 'server', 'index.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1200));

const { chromium } = await loadPlaywright();
const browser = await launch(chromium);
const BASE = `http://localhost:${PORT}`;

try {
  // --- desktop ------------------------------------------------------------------
  const pd = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  pd.on('pageerror', (e) => errors.push(String(e)));
  await pd.goto(BASE, { waitUntil: 'networkidle' });
  await pd.waitForTimeout(600);

  await desktopBasics({ pd, errors });
  await chips({ pd });
  await searchRouting({ pd, BASE });
  await pd.close();

  // --- mobile -------------------------------------------------------------------
  const pm = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const merrors = [];
  pm.on('pageerror', (e) => merrors.push(String(e)));
  await pm.goto(BASE, { waitUntil: 'networkidle' });
  await pm.waitForTimeout(600);

  await mobile({ pm, merrors });
  await pm.close();
} finally {
  await browser.close();
  server.kill();
}

summary();
