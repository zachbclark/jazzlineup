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
    await pd.click('.chip');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1, 'first click must select only that club');
    const solo = await count();
    assert.ok(solo > 0 && solo < initial, `count should be one club's shows: ${solo}`);
    // second click on another chip: additive. The bar holds only venue
    // chips now, so nth-of-type counts venues directly.
    await pd.click('.chip:nth-of-type(2)');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 2, 'second click must add');
    assert.ok(await count() > solo, 'adding a club must add shows');
    // "All clubs" resets everything on
    await pd.click('.seg-all');
    await pd.waitForTimeout(250);
    assert.equal(await count(), initial, 'All clubs did not reset');
    assert.equal(await clubCount(), allClubs);
  });

  await test('deselecting the last selected club returns to All', async () => {
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const allClubs = await clubCount();
    await pd.click('.chip'); // only this club
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), 1);
    await pd.click('.chip'); // deselect the last one -> all
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
      Promise.all((await pd.$$('.chip')).map((c) => c.textContent()));
    const before = await chipNames();
    const chips = await pd.$$('.chip');
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
    await pd.click('.chip');
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
    await pd.click('.seg-all');
    await pd.waitForTimeout(250);
    assert.equal(await count(), initial);
  });

  await test('starring a chip saves the club; unstar removes; storage follows', async () => {
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const allClubs = await clubCount();
    assert.equal(await pd.$('.chip-star'), null, 'no stars at rest');
    await pd.click('.chip');
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.chip-star'), 'active chip grows a star');
    assert.equal(await pd.$('.seg-mine'), null, 'no My clubs before the first star');
    await pd.click('.chip-star');
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.chip-star.starred'), 'star fills once saved');
    let mine = await pd.evaluate(() => JSON.parse(localStorage.getItem('jl.mine.nyc')));
    assert.equal(mine.length, 1, 'star writes My clubs');
    assert.ok(await pd.$('.seg-mine'), 'My clubs button appears');
    assert.ok(await pd.$('.seg-mine.on'), 'view == starred set, so My clubs glows gold');
    const count = await clubCount();
    assert.equal(count, 1, 'starring must not change the view');
    await pd.click('.chip-star');
    await pd.waitForTimeout(250);
    mine = await pd.evaluate(() => localStorage.getItem('jl.mine.nyc'));
    assert.equal(mine, null, 'unstarring the last club clears the key');
    assert.equal(await pd.$('.seg-mine'), null, 'button retires with it');
    await pd.click('.seg-all');
    await pd.waitForTimeout(250);
    assert.equal(await clubCount(), allClubs, 'hygiene: back to All');
  });

  await test('My clubs is a working view: star more clubs from inside it', async () => {
    const clubCount = async () => Number((await pd.textContent('.foot')).match(/across (\d+) clubs/)[1]);
    const allClubs = await clubCount();
    await pd.click('.chip');
    await pd.waitForTimeout(250);
    await pd.click('.chip-star');
    await pd.waitForTimeout(250);
    const second = (await pd.$$('.chip'))[1];
    await second.click();
    await pd.waitForTimeout(250);
    assert.equal(await pd.$('.seg-all.on'), null, 'ad-hoc view: neither button glows');
    assert.equal(await pd.$('.seg-mine.on'), null, 'peeked view differs from saved: quiet');
    const stars = await pd.$$('.chip-star:not(.starred)');
    await stars[0].click();
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.seg-mine.on'), 'starring the peeked club makes view == saved: glow');
    // tapping My clubs snaps the view to exactly the saved set
    await pd.click('.seg-mine');
    await pd.waitForTimeout(250);
    assert.ok(await pd.$('.seg-mine.on'), 'My clubs glows when you land on it');
    const mine = await pd.evaluate(() => JSON.parse(localStorage.getItem('jl.mine.nyc')));
    assert.equal(mine.length, 2);
    // casual toggles still write nothing: deselect both, storage keeps 2
    await pd.click('.seg-all');
    await pd.waitForTimeout(250);
    assert.equal((await pd.evaluate(() => JSON.parse(localStorage.getItem('jl.mine.nyc')))).length, 2,
      'browsing All never touches the saved set');
    await pd.evaluate(() => localStorage.removeItem('jl.mine.nyc'));
    await pd.reload({ waitUntil: 'networkidle' });
    await pd.waitForTimeout(600);
    assert.equal(await clubCount(), allClubs, 'pristine state restored');
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
    assert.ok(await pd.$('.seg-mine'), 'legacy picks arrive as My clubs');
    assert.equal(await clubCount(), 2, 'both legacy clubs selected');
    // hygiene: back to All (drops ?venues=), clear both keys, pristine reload
    await pd.click('.seg-all');
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
