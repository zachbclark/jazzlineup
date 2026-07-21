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
    await pd.click('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1, 'first click must select only that club');
    const solo = await count();
    assert.ok(solo > 0 && solo < initial, `count should be one club's shows: ${solo}`);
    // second click on another chip: additive. nth-of-type counts ALL sibling
    // buttons and the Save picks offer appeared after the first pick, so
    // venue2 is now the 4th button (All, Save picks, venue1, venue2).
    await pd.click('.chip:not(.chip-all):not(.chip-mine):not(.chip-save):nth-of-type(4)');
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
    await pd.click('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)'); // only this club
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1);
    await pd.click('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)'); // deselect the last one -> all
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
      Promise.all((await pd.$$('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)')).map((c) => c.textContent()));
    const before = await chipNames();
    const chips = await pd.$$('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)');
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

  await test('selection is a session view: URL restores it, storage never written', async () => {
    const count = async () => Number((await pd.textContent('.foot')).match(/(\d+) shows/)[1]);
    const initial = await count();
    await pd.click('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)');
    await pd.waitForTimeout(250);
    const solo = await count();
    assert.ok(solo < initial, 'solo select did not narrow');
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.equal(await count(), solo, 'view must survive reload via the ?venues= mirror');
    const stored = await pd.evaluate(() => ({
      mine: localStorage.getItem('jl.mine.nyc'), legacy: localStorage.getItem('jl.active.nyc'),
    }));
    assert.deepEqual(stored, { mine: null, legacy: null }, 'casual selection must never write storage');
    await pd.click('.chip-all');
    await pd.waitForTimeout(250);
    assert.equal(await count(), initial);
  });

  await test('Save picks makes the selection durable; casual toggles never touch it', async () => {
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const allClubs = await clubCount();
    await pd.click('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)'); // solo pick
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.chip-save'), 'Save picks offer appears with a selection');
    await pd.click('.chip-save');
    await pd.waitForTimeout(250);
    assert.equal(await pd.$('.chip-save'), null, 'offer retires once saved');
    assert.ok(await pd.$('.chip-mine.on'), 'My clubs lights as the active view');
    let mine = await pd.evaluate(() => JSON.parse(localStorage.getItem('jl.mine.nyc')));
    assert.equal(mine.length, 1);
    // casual browsing on top: add a second club — My clubs must not move
    const others = await pd.$$('.chip:not(.chip-all):not(.chip-mine):not(.chip-save)');
    await others[1].click();
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.chip-save'), 'a differing view re-offers saving');
    mine = await pd.evaluate(() => JSON.parse(localStorage.getItem('jl.mine.nyc')));
    assert.equal(mine.length, 1, 'casual toggle must not rewrite My clubs');
    await pd.click('.chip-mine');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1, 'My clubs returns to the saved pick');
    await pd.click('.chip-all');
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.chip-mine'), 'picks survive browsing All');
    // hygiene: All view first (URL param already dropped), then clear picks
    await pd.evaluate(() => localStorage.removeItem('jl.mine.nyc'));
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.equal(await clubCount(), allClubs, 'pristine all-on state restored');
  });

  await test('legacy jl.active picks are adopted as My clubs on load', async () => {
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const allClubs = await clubCount();
    await pd.evaluate(async () => {
      const d = await (await fetch('/events-nyc.json')).json();
      localStorage.setItem('jl.active.nyc', JSON.stringify(d.clubs.slice(0, 2).map((c) => c.id)));
      localStorage.removeItem('jl.mine.nyc');
    });
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.ok(await pd.$('.chip-mine.on'), 'legacy picks open as the My clubs view');
    assert.equal(await clubCount(), 2, 'both legacy clubs selected');
    // hygiene: back to All (drops ?venues=), clear both keys, pristine reload
    await pd.click('.chip-all');
    await pd.waitForTimeout(250);
    await pd.evaluate(() => {
      localStorage.removeItem('jl.active.nyc');
      localStorage.removeItem('jl.mine.nyc');
    });
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.equal(await clubCount(), allClubs);
  });
}
