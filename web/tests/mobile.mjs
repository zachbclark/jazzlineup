// Mobile viewport: compact calendar, inline personnel flow, the collapsing
// chip panel, and the no-horizontal-overflow guarantee.
import assert from 'node:assert';
import { test } from './_harness.mjs';

export default async function run({ pm, merrors }) {
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
}
