// Chip selection, list view, drag-to-reorder, and localStorage persistence.
// Each test restores the all-on state it started from (test hygiene rule).
import assert from 'node:assert';
import { test } from './_harness.mjs';

export default async function run({ pd }) {
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
}
