// New Orleans venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- New Orleans -------------------------------------------------------------------
import { parseGigulator } from '../clubs/_gigulator.js';
import { parse as snugParse } from '../clubs/snugharbor.js';
import { parse as bnileParse } from '../clubs/bluenile.js';
import { parse as presGen } from '../clubs/preservationhall.js';
import { parse as fritzGen } from '../clubs/fritzels.js';

ok('gigulator: bgig rows -> dated events with time; shared by dba + spotted cat', () => {
  const html = `
  <div class="bgig-row bgig-hdr-month"><span class="bgig-hdr-month-txt">July</span> <span class="bgig-hdr-year-txt">2026</span></div>
  <div class='bgig-row bgig-gig bgig-date-new bgig-day-odd'><div class='bgig-cell bgig_cell1'>
    <div class="bgig-date"><span class='bgig-date-1'>Sat</span><span class='bgig-date-2'>Jul</span><span class='bgig-date-3'>18</span></div>
    <div class="bgig-time"><div class='bgig-time-show'>6pm</div></div>
    <span class='bgig-proj-name'>Dana Abbott</span></div></div>
  <div class="bgig-row bgig-gig"><div class="bgig-cell bgig-cell-2">
    <div class="bgig-date"><span class="bgig-date-2">Jul</span><span class="bgig-date-3">18</span></div>
    <div class="bgig-time"><div class="bgig-time-show">10pm</div></div>
    <span class="bgig-proj-name">Colin Davis &amp; Night People</span></div></div>`;
  const evs = parseGigulator(html, 'dbanola', 'https://x', new Date(2026, 6, 19));
  assert.equal(evs.length, 2);
  assert.equal(evs[0].date, '2026-07-18');
  assert.deepEqual(evs[0].sets, ['18:00']);
  assert.equal(evs[1].title, 'Colin Davis & Night People');
  assert.deepEqual(evs[1].sets, ['22:00']);
});

ok('snugharbor: tw listings merge two nightly sets into one event', () => {
  const html = `
  <div class="tw-name"><a href="https://snugjazz.com/tm-event/chris-thomas-king-trio/">Chris Thomas King Trio</a></div>
  <div class="tw-date-time"><span class="tw-event-date">Jul 17</span> <span class="tw-event-time"> 7:30 pm</span></div>
  <div class="tw-name"><a href="https://snugjazz.com/tm-event/chris-thomas-king-trio-2/">Chris Thomas King Trio</a></div>
  <div class="tw-date-time"><span class="tw-event-date">Jul 17</span> <span class="tw-event-time"> 9:30 pm</span></div>`;
  const evs = snugParse(html, new Date(2026, 6, 16));
  assert.equal(evs.length, 1, 'two set rows, one event');
  assert.deepEqual(evs[0].sets, ['19:30', '21:30']);
  assert.equal(evs[0].date, '2026-07-17');
});

ok('bluenile: squarespace json; decorated titles stripped; epoch -> Central time', () => {
  const fixture = JSON.stringify({ upcoming: [
    { title: "The Caesar Brothers' FunkBox \u2022 SAT JUL. 18 \u2022 7:30PM ", startDate: 1784417400000, fullUrl: '/calendar-tickets-/x' },
  ]});
  const evs = bnileParse(fixture);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, "The Caesar Brothers' FunkBox");
  assert.equal(evs[0].date, '2026-07-18');
  assert.equal(evs[0].sets.length, 1);
});

ok('nola generators: Preservation Hall three nightly sets; Fritzels nightly no fake times', () => {
  const p = presGen(new Date(2026, 6, 20));
  assert.equal(p.length, 56);
  assert.deepEqual(p[0].sets, ['17:00', '18:30', '20:00']);
  const f = fritzGen(new Date(2026, 6, 20));
  assert.equal(f.length, 56);
  assert.deepEqual(f[0].sets, []);
});
