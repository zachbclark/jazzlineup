// Boston venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Boston ------------------------------------------------------------------------
import { parse as wallysGen } from '../clubs/wallys.js';
import { parse as sculParse, seedEvents as sculSeed } from '../clubs/scullers.js';
import { seedEvents as rbSeed } from '../clubs/regattabar.js';
import { parse as lilyParse } from '../clubs/lilypad.js';
import { parse as monkParse, parseDetail as monkDetail } from '../clubs/madmonkfish.js';
import { parse as bhGen } from '../clubs/beehive.js';

ok('wallys: generator emits Tue-Sat jams + nightly night sets', () => {
  const evs = wallysGen(new Date(2026, 6, 20)); // a Monday
  const jams = evs.filter((e) => /Jam Session/.test(e.title));
  const nights = evs.filter((e) => /Night Set/.test(e.title));
  assert.equal(nights.length, 56, 'nightly for 8 weeks');
  assert.equal(jams.length, 40, 'Tue-Sat for 8 weeks');
  assert.ok(!jams.some((e) => ['0', '1'].includes(String(new Date(e.date + 'T12:00:00Z').getUTCDay()))), 'no Sun/Mon jams');
  assert.deepEqual(nights[0].sets, ['21:00']);
});

ok('scullers: musicidb listEvent blocks parse; hype prefix stripped; seed filters past', () => {
  const html = `
  <ul class="eventsList"><li id="event-74988" class="summaryContent listEvent listItem cf">
    <h3 class="date"><span class="monthName dayNameAbb">Thu</span> <span class="monthName">Sep</span>
      <span class="dayNum">10</span> <span class="yearNum">2026</span></h3>
    <div class="listingBody"><h3 class="titleofevent"><a href="#/" title="View Details">
      10-TIME GRAMMY AWARD WINNER ARTURO SANDOVAL </a></h3></div>
  </li></ul>`;
  const evs = sculParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-09-10');
  assert.equal(evs[0].title, 'ARTURO SANDOVAL');
  const seed = sculSeed(new Date(2026, 9, 20)); // Oct 20: only Oct 31 + Dec 12 remain
  assert.equal(seed.length, 2);
});

ok('regattabar: seed merges same-title dates into sets (Coleman two-a-night)', () => {
  const evs = rbSeed(new Date(2026, 7, 1));
  const coleman = evs.filter((e) => /George Coleman/.test(e.title));
  assert.equal(coleman.length, 2, 'two NIGHTS, not four events');
  assert.deepEqual(coleman[0].sets, ['19:00', '21:30']);
  assert.ok(evs.every((e) => e.date >= '2026-08-01'), 'past seed rows dropped');
});

ok('lilypad: gcal links -> NY-time events; non-music filtered; late set shifts', () => {
  const amp = String.fromCharCode(38);
  const html = [
    '<a href="/home/cb2er-63k5x-865f2"><h3>Gill Aharon Trio</h3></a>',
    'google.com/calendar/event?action=TEMPLATE' + amp + 'text=Gill%20Aharon%20Trio' + amp + 'dates=20260716T001500Z/20260716T020000Z',
    'google.com/calendar/event?action=TEMPLATE' + amp + 'amp;text=Jesse%20Gallagher%20%2B%20Steve%20Fell' + amp + 'amp;dates=20260715T230000Z/20260716T000000Z',
    'google.com/calendar/event?action=TEMPLATE' + amp + 'text=The%20Lilypad%20Variety%20Show' + amp + 'dates=20260716T020000Z/20260716T035900Z',
  ].join(' ');
  const evs = lilyParse(html);
  assert.equal(evs.length, 2, 'variety show filtered out');
  const gill = evs.find((e) => /Gill Aharon/.test(e.title));
  assert.equal(gill.date, '2026-07-15', '00:15 UTC = 8:15pm ET the evening before');
  assert.deepEqual(gill.sets, ['20:15']);
  assert.equal(gill.url, 'https://www.lilypadinman.com/home/cb2er-63k5x-865f2', 'per-event page linked');
  assert.match(evs.find((e) => /Gallagher/.test(e.title)).title, /\+ Steve Fell/);
});

ok('madmonkfish: aria-label cards; time tails become sets; midnight show shifts', () => {
  const html = `
  <a class="card__btn" href="/event/724-yoko-miwa-trio/" aria-label="7/24 Yoko Miwa Trio"></a>
  <a class="card__btn" href="/event/722-yulia/" aria-label="7/22 Yulia Musayelyan Quartet 7pm (Mad Monkfish Concert Series)"></a>
  <a class="card__btn" href="/event/718-midnight/" aria-label="7/18 The Midnight Hour w/Camila Quintero 12-1am"></a>`;
  const evs = monkParse(html, new Date(2026, 6, 16));
  assert.equal(evs.length, 3);
  assert.equal(evs[0].date, '2026-07-24');
  assert.deepEqual(evs[0].sets, []);
  const yulia = evs.find((e) => /Yulia/.test(e.title));
  assert.deepEqual(yulia.sets, ['19:00']);
  assert.ok(!/concert series/i.test(yulia.title));
  const mid = evs.find((e) => /Midnight Hour/.test(e.title));
  assert.equal(mid.date, '2026-07-17', '12am show belongs to the previous night');
  assert.equal(mid.late, true);
});

ok('beehive: named fixtures only — Sunday blues + weekend brunch, no nightly filler', () => {
  const evs = bhGen(new Date(2026, 6, 20));
  assert.ok(evs.every((e) => /Bruce Bears|Brunch/.test(e.title)), 'no generic nightly entries');
  const blues = evs.filter((e) => /Bruce Bears/.test(e.title));
  assert.equal(blues.length, 8);
  assert.ok(blues.every((e) => new Date(e.date + 'T12:00:00Z').getUTCDay() === 0));
});

ok('madmonkfish: detail page yields roster lines + prose set times', () => {
  const html = `<article><p>July 24, 2026 07:00 PM until July 24, 2026 10:00 PM</p>
  <p>1st Show: 7:00-8:15pm and 2nd Show: 8:45-10:00pm</p>
  <p>Yoko Miwa, piano</p><p>Matt Stavrakas, acoustic bass</p><p>Scott Goulding, drums</p>
  <p>Miwa's story of becoming a jazz musician is full of serendipity.</p></article>`;
  const d = monkDetail(html);
  assert.deepEqual(d.sets, ['19:00', '20:45']);
  assert.equal(d.personnel.length, 3);
  assert.deepEqual(d.personnel[0], { name: 'Yoko Miwa', instrument: 'piano' });
  assert.deepEqual(d.personnel[1], { name: 'Matt Stavrakas', instrument: 'acoustic bass' });
});
