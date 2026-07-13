// Parser smoke tests against fixture snippets that mirror each site's real
// markup (structures verified against the live sites on 2026-07-13).
// Run: node crawler/test.mjs
import assert from 'node:assert';
import { parse as jgParse } from './clubs/jazzgallery.js';
import { parsePage as smParse } from './clubs/smalls.js';
import { parse as vvParse } from './clubs/vanguard.js';
import { parsePage as blParse } from './clubs/birdland.js';
import { parse as dzParse, parseDateRange } from './clubs/dizzys.js';
import { parseMonth as bnParse } from './clubs/bluenote.js';

const TODAY = new Date(2026, 6, 13); // Mon Jul 13 2026
let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}

// --- Jazz Gallery ------------------------------------------------------------
ok('jazzgallery: expands 2-day run, parses sets from excerpt', () => {
  // startDate/endDate are epoch ms; these correspond to Jul 15/16 2026 in NY.
  const fixture = JSON.stringify({
    upcoming: [
      {
        title: 'Miles Okazaki Boomtown', startDate: 1784156400605, endDate: 1784253600605,
        fullUrl: '/calendar/miles-okazaki', excerpt: 'Miles Okazaki - guitar Sets at 7pm + 9pm ET',
      },
      { title: 'SUMMERPASS 2026! All Shows', startDate: 1783526400120, endDate: 1787367600120, fullUrl: '/x', excerpt: '' },
    ],
  });
  const evs = jgParse(fixture);
  assert.equal(evs.length, 2, `expected 2 events, got ${evs.length}`);
  assert.equal(evs[0].date, '2026-07-15');
  assert.equal(evs[1].date, '2026-07-16');
  assert.deepEqual(evs[0].sets, ['19:00', '21:00']);
  assert.match(evs[0].url, /jazzgallery\.org\/calendar\/miles-okazaki/);
});

// --- Smalls / Mezzrow ----------------------------------------------------------
ok('smalls: parses day/venue/event template', () => {
  const tpl = `
  <div class="flex-column day-list">
    <div class="title1">Mon Jul 13</div>
    <div class="venue-group">
      <div class="smalls-color text2">Smalls</div>
      <div class="flex-column day-event">
        <div class="text-grey text2">6:00 PM &amp; 7:30 PM</div>
        <a href="/events/33032-ari-hoenig-trio/?x=1"><div class="text2 day_event_title">Ari Hoenig Trio</div></a>
      </div>
    </div>
    <div class="venue-group">
      <div class="mezzrow-color text2">Mezzrow</div>
      <div class="flex-column day-event">
        <div class="text-grey text2">9:00 PM &amp; 10:30 PM</div>
        <a href="/events/33438-jon-davis-trio/"><div class="text2 day_event_title">Jon Davis Trio</div></a>
      </div>
    </div>
    <div class="venue-group">
      <div class="jazzcultural-color text2">Jazzcultural</div>
      <div class="flex-column day-event">
        <div class="text-grey text2">2:00 PM</div>
        <a href="/events/1-jam/"><div class="text2 day_event_title">Afternoon Jam</div></a>
      </div>
    </div>
  </div>`;
  const evs = smParse(tpl, TODAY);
  assert.equal(evs.length, 2, `expected 2 (jazzcultural excluded), got ${evs.length}`);
  assert.equal(evs[0].clubId, 'smalls');
  assert.equal(evs[0].date, '2026-07-13');
  assert.deepEqual(evs[0].sets, ['18:00', '19:30']);
  assert.equal(evs[0].url, 'https://www.smallslive.com/events/33032-ari-hoenig-trio/');
  assert.equal(evs[1].clubId, 'mezzrow');
});

// --- Village Vanguard ----------------------------------------------------------
ok('vanguard: expands run + generates VJO Mondays', () => {
  const html = `
  <h2>VANGUARD JAZZ ORCHESTRA</h2>
  <h3 class="event-tagline">Every Monday Night</h3>
  <p>The 16-piece big band.</p>
  <a href="https://vv.squadup.com/artists/vanguard-jazz-orchestra?utm=x">TICKETS</a>
  <h2>Ben Wendel</h2>
  <h3>July 14 - July 19</h3>
  <p>Ben Wendel - saxophone</p>
  <a href="https://vv.squadup.com/artists/ben-wendel">TICKETS</a>
  <h2>Makaya McCraven Tet</h2>
  <h3>July 28 - August 2</h3>
  <a href="https://vv.squadup.com/artists/makaya-mccraven">TICKETS</a>
  <h2>COMING SOON!</h2>
  <h3>September 1 - 6</h3>`;
  const evs = vvParse(html, TODAY);
  const vjo = evs.filter((e) => /Vanguard Jazz Orchestra/.test(e.title));
  assert.equal(vjo.length, 8);
  assert.equal(vjo[0].date, '2026-07-13'); // today is a Monday
  const wendel = evs.filter((e) => e.title === 'Ben Wendel');
  assert.equal(wendel.length, 6);
  assert.equal(wendel[0].date, '2026-07-14');
  assert.equal(wendel[5].date, '2026-07-19');
  const makaya = evs.filter((e) => /McCraven/.test(e.title));
  assert.equal(makaya.length, 6);
  assert.equal(makaya[5].date, '2026-08-02'); // month rollover
  assert.deepEqual(wendel[0].sets, ['20:00', '22:00']);
  assert.ok(!evs.some((e) => /coming soon/i.test(e.title)));
});

// --- Birdland -------------------------------------------------------------------
ok('birdland: parses tw-section cards, tags Theater', () => {
  const html = `
  <div class="tw-plugin-upcoming-event-list">
    <div class="tw-section">
      <div class="tw-name"><a href="/tm-event/stella-cole/">Stella Cole</a></div>
      <div class="tw-venue-details"><span class="tw-venue-name">Birdland Jazz Club</span></div>
      <div class="tw-date-time">
        <span class="tw-event-date-complete"><span class="tw-day-of-week">Wed</span> <span class="tw-event-date">Jul 15</span></span>
        <span class="tw-event-door-time-complete"><span class="tw-event-door-time">6:00PM</span></span>
        <span class="tw-event-time-complete"><span class="tw-event-time">7:00PM</span></span>
      </div>
    </div>
    <div class="tw-section">
      <div class="tw-name"><a href="/tm-event/frank-vignola/">Frank Vignola's Guitar Night</a></div>
      <div class="tw-venue-details"><span class="tw-venue-name">Birdland Theater</span></div>
      <div class="tw-date-time">
        <span class="tw-event-date">Jul 15</span>
        <span class="tw-event-time">8:30PM</span>
      </div>
    </div>
  </div>`;
  const evs = blParse(html, TODAY);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Stella Cole');
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['19:00']);
  assert.match(evs[1].title, /\(Theater\)$/);
  assert.match(evs[0].url, /tm-event\/stella-cole/);
});

// --- Dizzy's ---------------------------------------------------------------------
ok("dizzys: date ranges incl. cross-month, Sunday set times", () => {
  assert.deepEqual(parseDateRange('Jul 13', TODAY), ['2026-07-13', '2026-07-13']);
  assert.deepEqual(parseDateRange('Jul 17-19', TODAY), ['2026-07-17', '2026-07-19']);
  assert.deepEqual(parseDateRange('Jul 29 - Aug 2', TODAY), ['2026-07-29', '2026-08-02']);
  const html = `
  <div class="concerts">
    <div class="concert">
      <div class="concert--date">Jul 17-19</div>
      <div class="concert--title">Charles McPherson Quintet</div>
      <a href="https://ticketing.jazz.org/21136/?promo=x">GET TICKETS</a>
    </div>
  </div>`;
  const evs = dzParse(html, TODAY);
  assert.equal(evs.length, 3);
  assert.deepEqual(evs[0].sets, ['19:00', '21:00']); // Fri
  assert.deepEqual(evs[2].sets, ['17:00', '19:30']); // Sun Jul 19
  assert.equal(evs[0].url, 'https://ticketing.jazz.org/21136/');
});

// --- Blue Note ---------------------------------------------------------------------
ok('bluenote: parses calendar table, skips private events', () => {
  const html = `
  <table><tbody><tr>
    <td class="past"><div class="inner"><div class="day">15</div>
      <div class="day-wrap single-show">
        <a class="img-wrap" href="https://www.bluenotejazz.com/nyc/tm-event/wyatt-waddell/" title="Wyatt Waddell"><img alt="Wyatt Waddell" src="x.jpg"/></a>
        <div class="showtimes">8:00 PM &amp; 10:30 PM</div>
        <div class="venue">Blue Note Jazz Club</div>
      </div>
    </div></td>
    <td><div class="inner"><div class="day">29</div>
      <div class="day-wrap single-show">
        <a class="img-wrap" href="/nyc/tm-event/closed/" title="Closed for Private Event"></a>
        <div class="showtimes">8:00 PM</div>
        <div class="venue">Blue Note Jazz Club</div>
      </div>
    </div></td>
  </tr></tbody></table>`;
  const evs = bnParse(html, 2026, 7);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:00', '22:30']);
  assert.equal(evs[0].title, 'Wyatt Waddell');
});

console.log(`\n${passed}/6 test groups passed`);
