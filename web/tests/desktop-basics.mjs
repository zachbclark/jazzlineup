// Desktop basics: load, default view, footer, info tip, city hint + switcher,
// and the day drawer. Runs first — later suites assume NYC is the active city.
import assert from 'node:assert';
import { test } from './_harness.mjs';

export default async function run({ pd, errors }) {
  await test('loads with correct title, no JS errors', async () => {
    assert.match(await pd.title(), /Jazz Lineup/);
    assert.deepEqual(errors, []);
  });

  await test('site sets ZERO first-party cookies (GTM consent-denied guard)', async () => {
    // the no-banner stance depends on this: consent defaults deny storage,
    // so tags added in the GTM console must never set cookies. If a _ga
    // cookie ever shows up here, a tag is misconfigured — do not "fix" the
    // test; fix the tag (or ship a consent banner first).
    const cookies = (await pd.context().cookies()).filter((c) => c.domain.includes('localhost'));
    assert.deepEqual(cookies.map((c) => c.name), [], 'unexpected first-party cookies');
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

  await test('info tip opens, mentions drag reorder, closes on Escape', async () => {
    await pd.click('.info-btn');
    await pd.waitForTimeout(150);
    const menu = await pd.textContent('.info-menu');
    assert.match(menu, /Drag chips to reorder/);
    await pd.keyboard.press('Escape');
    await pd.waitForTimeout(150);
    assert.equal(await pd.$('.info-menu'), null, 'Escape should close tips');
  });

  await test('first-visit city hint shows once, dies on switcher touch', async () => {
    assert.ok(await pd.$('.city-hint'), 'hint missing on first visit');
  });

  await test('city menu lists all ten cities; CHI loads (empty until first crawl)', async () => {
    await pd.click('.city-badge-btn');
    assert.equal(await pd.$('.city-hint'), null, 'hint must vanish once touched');
    await pd.waitForTimeout(200);
    const options = await Promise.all((await pd.$$('.city-option')).map((o) => o.textContent()));
    assert.deepEqual(options.map((s) => s.trim()), ['NYC', 'LA', 'CHICAGO', 'SF', 'PARIS', 'LONDON', 'BOSTON', 'TOKYO', 'NOLA', 'BERLIN']);
    await pd.click('.city-option:has-text("CHICAGO")');
    await pd.waitForTimeout(400);
    assert.match(await pd.title(), /CHI/);
    assert.ok(await pd.$('.grid'), 'CHI should render a calendar even with no data');
    assert.deepEqual(errors, [], 'switching to CHI threw');
    // back to NYC for the rest of the suite
    await pd.click('.city-badge-btn');
    await pd.click('.city-option:has-text("NYC")');
    await pd.waitForTimeout(400);
  });

  await test('wordmark is a real home link for the current city', async () => {
    assert.equal(await pd.getAttribute('.brand-link', 'href'), '/nyc');
    await pd.click('.brand-link');
    await pd.waitForTimeout(800);
    assert.equal(await pd.evaluate(() => location.pathname), '/nyc');
    assert.ok(await pd.$('.grid'), 'calendar renders after home click');
  });

  await test('clicking a day with events opens the inline drawer', async () => {
    // pick any cell with events that is not already open
    await pd.click('.cell.has-events:not(.open) .daynum');
    await pd.waitForTimeout(300);
    assert.ok(await pd.$('.daypanel.inline'), 'drawer did not open');
    assert.ok((await pd.$$('.daypanel.inline .row')).length > 0, 'drawer has no rows');
  });
}
