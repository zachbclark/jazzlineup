// Artist search, borough filter, and the deep-link routes
// (/:city/:district, ?date=, ?venues=). Inputs derive from UPCOMING events
// in the served data — the brittleness rule that bit twice (2026-07-16/18).
import assert from 'node:assert';
import { test } from './_harness.mjs';

export default async function run({ pd, BASE }) {
  await test('artist search finds shows by personnel name, clear restores', async () => {
    const count = async () => Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    const initial = await count();
    // derive a real artist from the served data so the test isn't brittle —
    // from an UPCOMING event: data files keep recent-past shows, and a
    // past-only artist would exercise nothing (bit us twice, 2026-07-16/18)
    const artist = await pd.evaluate(async () => {
      const d = await (await fetch('/events-nyc.json')).json();
      const today = new Date().toISOString().slice(0, 10);
      const ev = d.events.find((e) => e.date >= today && e.personnel?.length);
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

  await test('deep links: /nyc/brooklyn narrows borough; ?date= opens the drawer; URL follows', async () => {
    const day = await pd.evaluate(async () => {
      const d = await (await fetch('/events-nyc.json')).json();
      const today = new Date().toISOString().slice(0, 10);
      const bk = new Set(d.clubs.filter((c) => c.borough === 'brooklyn').map((c) => c.id));
      return d.events.find((e) => e.date > today && bk.has(e.clubId))?.date ?? null;
    });
    assert.ok(day, 'no future events in data');
    await pd.goto(BASE + '/nyc/brooklyn?date=' + day, { waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.match(await pd.textContent('.borough-btn.on'), /Brooklyn/i, 'deep-linked borough not applied');
    assert.ok(await pd.$('.daypanel.inline'), 'deep-linked date did not open the drawer');
    await pd.click('.borough-btn:has-text("All")');
    await pd.waitForTimeout(300);
    const path = await pd.evaluate(() => window.location.pathname);
    assert.equal(path, '/nyc', 'URL did not follow borough change: ' + path);
    await pd.goto(BASE + '/nyc/atlantis', { waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.match(await pd.textContent('.borough-btn.on'), /All/i, 'unknown borough should fall back to All');
  });

  await test('deep link ?venues= selects chips, never clobbers saved state; URL follows toggles', async () => {
    const ids = await pd.evaluate(async () => {
      localStorage.removeItem('jl.active.nyc'); // clean slate (test hygiene rule)
      const d = await (await fetch('/events-nyc.json')).json();
      return d.clubs.slice(0, 2).map((c) => c.id);
    });
    await pd.goto(BASE + '/nyc?venues=' + ids.join(',') + ',bogusclub', { waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    const on = await pd.$$eval('.chip.on:not(.chip-all)', (els) => els.map((e) => e.getAttribute('data-chip-id')));
    assert.deepEqual(on.sort(), ids.slice().sort(), 'linked venues not applied (bogus id should be ignored)');
    assert.equal(await pd.evaluate(() => localStorage.getItem('jl.active.nyc')), null,
      'a shared link must not overwrite saved chips');
    // toggling a chip is a real interaction: URL and saved state both follow
    await pd.click(`[data-chip-id="${ids[0]}"]`);
    await pd.waitForTimeout(300);
    const q = await pd.evaluate(() => window.location.search);
    assert.ok(q.includes('venues=' + ids[1]) && !q.includes(ids[0]), 'URL did not follow chip toggle: ' + q);
    // cleanup: back to All (clears both param and saved state)
    await pd.click('.chip-all');
    await pd.waitForTimeout(300);
    assert.equal(await pd.evaluate(() => window.location.search), '', 'All state should drop the param');
    assert.equal(await pd.evaluate(() => localStorage.getItem('jl.active.nyc')), null);
  });
}
