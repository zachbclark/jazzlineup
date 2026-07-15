// UI test suite — Playwright against the built frontend + real data.
//   npm run test:ui        (build first: npm run build:web)
// First run on a new machine: npm i -D playwright && npx playwright install chromium
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3987;

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

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
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

  await test('loads with correct title, no JS errors', async () => {
    assert.match(await pd.title(), /Jazz Lineup/);
    assert.deepEqual(errors, []);
  });

  await test('calendar is the default view', async () => {
    assert.match(await pd.textContent('.view-toggle button.on'), /Calendar/);
    assert.ok(await pd.$('.grid'));
  });

  await test('footer reports events and clubs', async () => {
    const foot = await pd.textContent('.foot');
    const m = foot.match(/(\d+) shows across (\d+) clubs/);
    assert.ok(m, `footer text unexpected: ${foot}`);
    assert.ok(Number(m[1]) > 100, `suspiciously few events: ${m[1]}`);
    assert.ok(Number(m[2]) >= 7, `expected 7+ clubs, got ${m[2]}`);
  });

  await test('city menu lists all three cities; CHI loads (empty until first crawl)', async () => {
    await pd.click('.city-badge-btn');
    await pd.waitForTimeout(200);
    const options = await Promise.all((await pd.$$('.city-option')).map((o) => o.textContent()));
    assert.deepEqual(options.map((s) => s.trim()), ['NYC', 'LA', 'CHI']);
    await pd.click('.city-option:has-text("CHI")');
    await pd.waitForTimeout(400);
    assert.match(await pd.title(), /CHI/);
    assert.ok(await pd.$('.grid'), 'CHI should render a calendar even with no data');
    assert.deepEqual(errors, [], 'switching to CHI threw');
    // back to NYC for the rest of the suite
    await pd.click('.city-badge-btn');
    await pd.click('.city-option:has-text("NYC")');
    await pd.waitForTimeout(400);
  });

  await test('clicking a day with events opens the inline drawer', async () => {
    // pick any cell with events that is not already open
    await pd.click('.cell.has-events:not(.open) .daynum');
    await pd.waitForTimeout(300);
    assert.ok(await pd.$('.daypanel.inline'), 'drawer did not open');
    assert.ok((await pd.$$('.daypanel.inline .row')).length > 0, 'drawer has no rows');
  });

  await test('click from All selects ONLY that club; more clicks add; All resets', async () => {
    const count = async () => Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const initial = await count();
    const allClubs = await clubCount();
    // first click: exclusive select
    await pd.click('.chip:not(.chip-all)');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1, 'first click must select only that club');
    const solo = await count();
    assert.ok(solo > 0 && solo < initial, `count should be one club's shows: ${solo}`);
    // second click on another chip: additive
    await pd.click('.chip:not(.chip-all):nth-of-type(3)');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 2, 'second click must add');
    assert.ok(await count() > solo, 'adding a club must add shows');
    // "All clubs" resets everything on
    await pd.click('.chip-all');
    await pd.waitForTimeout(250);
    assert.equal(await count(), initial, 'All clubs did not reset');
    assert.equal(await clubCount(), allClubs);
  });

  await test('deselecting the last selected club returns to All', async () => {
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const allClubs = await clubCount();
    await pd.click('.chip:not(.chip-all)'); // only this club
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1);
    await pd.click('.chip:not(.chip-all)'); // deselect the last one -> all
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), allClubs, 'empty selection should flow back to All');
  });

  await test('list view renders grouped days', async () => {
    await pd.click('.view-toggle button:has-text("List")');
    await pd.waitForTimeout(300);
    assert.ok((await pd.$$('.daygroup')).length > 3, 'few or no day groups');
  });

  await test('drag a chip to reorder; order persists in localStorage + reload', async () => {
    const chipNames = async () =>
      Promise.all((await pd.$$('.chip:not(.chip-all)')).map((c) => c.textContent()));
    const before = await chipNames();
    const chips = await pd.$$('.chip:not(.chip-all)');
    const a = await chips[0].boundingBox();
    const b = await chips[2].boundingBox();
    await pd.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await pd.mouse.down();
    // the anti-thrash cooldown (180ms) means a drag lands one hop per pause —
    // move, let the glide settle, nudge again (like a human would)
    await pd.mouse.move(b.x + b.width * 0.9, b.y + b.height / 2, { steps: 8 });
    await pd.waitForTimeout(250);
    await pd.mouse.move(b.x + b.width * 0.9 + 1, b.y + b.height / 2, { steps: 2 });
    await pd.waitForTimeout(250);
    await pd.mouse.move(b.x + b.width * 0.9, b.y + b.height / 2, { steps: 2 });
    await pd.waitForTimeout(250);
    await pd.mouse.up();
    await pd.waitForTimeout(250);
    const after = await chipNames();
    assert.notEqual(after[0], before[0], 'first chip did not move');
    assert.equal(after[2], before[0], 'dragged chip should land at position 3');
    const count = Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    assert.ok(count > 0, 'drop must not toggle the chip off');
    const stored = await pd.evaluate(() => localStorage.getItem('jl.order.nyc.all'));
    assert.ok(stored && JSON.parse(stored).length > 5, 'order not persisted');
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    const reloaded = await chipNames();
    assert.deepEqual(reloaded.slice(0, 3), after.slice(0, 3), 'order lost after reload');
    await pd.evaluate(() => localStorage.removeItem('jl.order.nyc.all'));
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
  });

  await test('chip selection persists across reload (saved off stays off)', async () => {
    const count = async () => Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    const initial = await count();
    await pd.click('.chip:not(.chip-all)'); // toggle first venue off
    await pd.waitForTimeout(250);
    const toggled = await count();
    assert.ok(toggled < initial, 'toggle did not reduce count');
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.equal(await count(), toggled, 'saved selection did not survive reload');
    const saved = await pd.evaluate(() => localStorage.getItem('jl.active.nyc'));
    assert.ok(saved && JSON.parse(saved).length > 0, 'selection not in localStorage');
    await pd.click('.chip:not(.chip-all)'); // toggle back on -> null -> key removed
    await pd.waitForTimeout(250);
    assert.equal(await count(), initial);
    const cleared = await pd.evaluate(() => localStorage.getItem('jl.active.nyc'));
    assert.equal(cleared, null, 'all-on selection should clear the storage key');
  });

  await test('artist search finds shows by personnel name, clear restores', async () => {
    const count = async () => Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    const initial = await count();
    // derive a real artist from the served data so the test isn't brittle
    const artist = await pd.evaluate(async () => {
      const d = await (await fetch('/events-nyc.json')).json();
      const ev = d.events.find((e) => e.personnel?.length);
      return ev ? ev.personnel[0].name : null;
    });
    assert.ok(artist, 'no personnel in data to search for');
    await pd.fill('.search-box input', artist);
    await pd.waitForTimeout(300);
    assert.ok(await pd.$('.search-summary'), 'search summary missing');
    const matches = await count();
    assert.ok(matches > 0 && matches < initial, `unexpected match count: ${matches}`);
    assert.ok((await pd.$$('.daygroup')).length > 0, 'results list missing');
    assert.equal(await pd.$('.filterbar'), null, 'chips should hide while searching');
    await pd.click('.search-clear');
    await pd.waitForTimeout(300);
    assert.equal(await count(), initial, 'clearing search did not restore');
    assert.ok(await pd.$('.filterbar'), 'chips did not return');
  });

  await test('borough filter narrows chips and counts, then clears', async () => {
    const count = async () => Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    const chips = async () => (await pd.$$('.chip:not(.chip-all)')).length;
    const bar = await pd.$('.borough-bar');
    assert.ok(bar, 'borough bar missing (needs 2+ boroughs in data)');
    const allShows = await count();
    const allChips = await chips();
    await pd.click('.borough-btn:has-text("Brooklyn")');
    await pd.waitForTimeout(250);
    const bkShows = await count();
    const bkChips = await chips();
    assert.ok(bkChips > 0 && bkChips < allChips, `chip count did not narrow: ${allChips} -> ${bkChips}`);
    // NB: <= not < — a dataset crawled before the Brooklyn venues landed can
    // legitimately have zero Brooklyn shows; chips narrowing already proves scope.
    assert.ok(bkShows <= allShows, `show count grew?: ${allShows} -> ${bkShows}`);
    await pd.click('.borough-btn:has-text("All")');
    await pd.waitForTimeout(250);
    assert.equal(await count(), allShows, 'clearing borough did not restore');
    assert.equal(await chips(), allChips);
  });
  await pd.close();

  // --- mobile -------------------------------------------------------------------
  const pm = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const merrors = [];
  pm.on('pageerror', (e) => merrors.push(String(e)));
  await pm.goto(BASE, { waitUntil: 'networkidle' });
  await pm.waitForTimeout(600);

  await test('mobile: lands on calendar with compact dot cells', async () => {
    assert.match(await pm.textContent('.view-toggle button.on'), /Calendar/);
    assert.ok((await pm.$$('button.cell')).length > 20, 'compact button cells missing');
    assert.ok((await pm.$$('.dot-sm')).length > 10, 'dot markers missing');
    assert.deepEqual(merrors, []);
  });

  await test('mobile: grouped personnel flows inline (no tall columns)', async () => {
    const section = await pm.$('.personnel.grouped .p-section');
    if (!section) return; // no big band visible today — not a failure
    const display = await section.evaluate((el) => getComputedStyle(el).display);
    assert.equal(display, 'inline', `grouped section display=${display} on mobile`);
  });

  await test('mobile: chip panel collapses to ~2 lines and expands in place', async () => {
    const toggle = await pm.$('.chips-toggle');
    assert.ok(toggle, 'expand strip missing (24 venues must overflow 2 lines)');
    const h1 = await pm.$eval('.filterbar', (el) => el.clientHeight);
    await toggle.click();
    await pm.waitForTimeout(250);
    const h2 = await pm.$eval('.filterbar', (el) => el.clientHeight);
    assert.ok(h2 > h1 * 1.5, `panel did not expand: ${h1} -> ${h2}`);
    await pm.click('.chips-toggle');
    await pm.waitForTimeout(250);
    const h3 = await pm.$eval('.filterbar', (el) => el.clientHeight);
    assert.equal(h3, h1, 'panel did not collapse back');
  });

  await test('mobile: no horizontal overflow', async () => {
    const over = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `page overflows horizontally by ${over}px`);
  });
  await pm.close();
} finally {
  await browser.close();
  server.kill();
}

console.log(`\n${passed}/${passed + failed} UI tests passed`);
process.exit(failed ? 1 : 0);
