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
let passed = 0, total = 0;
function ok(name, fn) {
  total++;
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}
process.on('exit', () => console.log(`\n${passed}/${total} test groups passed`));

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
  assert.equal(evs.length, 3, `expected 3 (incl. jazzcultural), got ${evs.length}`);
  assert.equal(evs[2].clubId, 'jazzcultural');
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
// NB: the live site serves SINGLE-quoted attributes (class='day') — this
// fixture mirrors that (caught in production on 2026-07-14: the original
// double-quote-only parser returned 0 events). Sony Hall shows share the
// calendar and must be filtered out by venue.
ok('bluenote: parses single-quoted markup, filters Sony Hall + private events', () => {
  const html = `
  <table><tbody><tr>
    <td class='past'><div class='inner'><div class='day'>15</div>
      <div class='day-wrap single-show'>
        <a class='img-wrap' href='https://www.bluenotejazz.com/nyc/tm-event/wyatt-waddell/'><div class='the-image' data-src='x.jpg'></div></a>
        <h3><a href='https://www.bluenotejazz.com/nyc/tm-event/wyatt-waddell/'>Wyatt Waddell</a></h3>
        <div class='showtimes'><a href='#'><time>8:00 PM</time> &amp; <time>10:30 PM</time></a><div class='venue'>Blue Note Jazz Club</div></div>
      </div>
      <div class='day-wrap '>
        <h3><a href='/nyc/tm-event/other-band/'>Somebody Else</a></h3>
        <div class='showtimes'><time>7:00 PM</time><div class='venue'>Sony Hall</div></div>
      </div>
    </div></td>
    <td><div class='inner'><div class='day'>29</div>
      <div class='day-wrap single-show'>
        <h3><a href='/nyc/tm-event/closed/'>Closed for Private Event</a></h3>
        <div class='showtimes'><time>8:00 PM</time><div class='venue'>Blue Note Jazz Club</div></div>
      </div>
    </div></td>
  </tr></tbody></table>`;
  const evs = bnParse(html, 2026, 7);
  assert.equal(evs.length, 1, `expected 1 event (no Sony Hall, no private), got ${evs.length}`);
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:00', '22:30']);
  assert.equal(evs[0].title, 'Wyatt Waddell');
});



// --- personnel parsing --------------------------------------------------------
import { parsePersonnel, stripPromo } from './lib.js';
ok('personnel: parses rosters, strips promo, rejects prose', () => {
  const jg = parsePersonnel(
    'Miles Okazaki - guitar Caroline Davis - alto saxophone Anna Webber - tenor saxophone ' +
    'Zekkereya El-Magharbel - trombone Matt Mitchell - piano Dan Weiss - drums ' +
    'Sets at 7pm + 9pm ET FREE WITH SUMMERPASS TICKETS & MORE INFO'
  );
  assert.equal(jg.length, 6);
  assert.deepEqual(jg[0], { name: 'Miles Okazaki', instrument: 'guitar' });
  assert.deepEqual(jg[3], { name: 'Zekkereya El-Magharbel', instrument: 'trombone' });

  const vv = parsePersonnel('Bill Frisell – Guitar Greg Tardy – Saxophone Gerald Clayton – Piano Johnathan Blake – Drums');
  assert.equal(vv.length, 4);
  assert.equal(vv[1].instrument, 'saxophone');

  assert.deepEqual(parsePersonnel('A powerful story brought to life through big band jazz'), []);
  assert.deepEqual(parsePersonnel('Jean-Michel at the Cafe - special guest'), []);
  assert.equal(stripPromo('Great band! FREE WITH SUMMERPASS GET TICKETS'), 'Great band!');
});

ok('personnel: survives makeEvent end-to-end (jazzgallery)', () => {
  const fixture = JSON.stringify({ upcoming: [{
    title: 'Test Band', startDate: 1784156400605, endDate: 1784156400605,
    fullUrl: '/calendar/test',
    excerpt: 'Alice Smith - piano Bob Jones - drums Sets at 7pm + 9pm ET',
  }]});
  const evs = jgParse(fixture);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].personnel?.length, 2, 'personnel must survive makeEvent');
  assert.deepEqual(evs[0].personnel[0], { name: 'Alice Smith', instrument: 'piano' });
  assert.equal(evs[0].details, null);
});

// --- Smoke ---------------------------------------------------------------------
import { parse as smokeParse } from './clubs/smoke.js';
ok('smoke: groups performances into events with NY-time sets', () => {
  const fixture = JSON.stringify([
    { id: 1, datetime: '2026-07-15T22:30:00Z', show_id: 11747, show: { id: 11747, name: 'Jane Monheit', price_per_person: '$45' } },
    { id: 2, datetime: '2026-07-16T00:30:00Z', show_id: 11747, show: { id: 11747, name: 'Jane Monheit', price_per_person: '$45' } },
    { id: 3, datetime: '2026-07-17T02:00:00Z', show_id: 11800, show: { id: 11800, name: 'Late Night Session' } },
  ]);
  const evs = smokeParse(fixture);
  // 22:30Z = 6:30pm ET; 00:30Z next day = 8:30pm ET SAME NY date -> one event, two sets
  assert.equal(evs.length, 2);
  const jane = evs.find((e) => /Monheit/.test(e.title));
  assert.equal(jane.date, '2026-07-15');
  assert.deepEqual(jane.sets, ['18:30', '20:30']);
  assert.match(jane.url, /\/shows\/11747\//);
  const late = evs.find((e) => /Late Night/.test(e.title));
  assert.equal(late.date, '2026-07-16'); // 02:00Z = 10pm ET on the 16th
  assert.deepEqual(late.sets, ['22:00']);
});

// --- Nublu -----------------------------------------------------------------------
import { parse as nubluParse } from './clubs/nublu.js';
ok('nublu: splits day rows into per-act events with ticket links', () => {
  const html = `
  <tr><td class="schpage-date2"><span class="date-display-single" content="2026-07-15T00:00:00-04:00">Wednesday</span></td></tr>
  <tr><td class="schpage-date3"><span class="date-display-single" content="2026-07-15T00:00:00-04:00">July</span> <span class="date-display-single" content="2026-07-15T00:00:00-04:00">15</span></td></tr>
  <tr><td class="schpage-blue"><div class="schpage-body">
    <p>7pm-Masta Ace "Disposable Arts"<br/><a href="https://posh.vip/e/masta-ace?x=1">Tickets</a></p>
    <p>10pm-Fernando Garcia &amp; The Lux Quintet<br/><a href="https://posh.vip/e/fernando-garcia">Tickets</a></p>
    <p>Sushi Reservations at Resy.com</p>
  </div></td></tr>
  <tr><td class="schpage-date2"><span class="date-display-single" content="2026-07-16T00:00:00-04:00">Thursday</span></td></tr>
  <tr><td class="schpage-blue"><div class="schpage-body"><p>11pm - 1am Ilhan Ersahin Session <a href="https://posh.vip/e/ilhan">Tickets</a></p></div></td></tr>`;
  const evs = nubluParse(html);
  assert.equal(evs.length, 3, `expected 3 acts, got ${evs.length}: ${evs.map((e) => e.title).join(' | ')}`);
  assert.equal(evs[0].date, '2026-07-15');
  assert.match(evs[0].title, /Masta Ace/);
  assert.deepEqual(evs[0].sets, ['19:00']);
  assert.equal(evs[0].url, 'https://posh.vip/e/masta-ace');
  assert.match(evs[1].title, /Fernando Garcia/);
  assert.deepEqual(evs[1].sets, ['22:00']);
  assert.equal(evs[2].date, '2026-07-16');
  assert.match(evs[2].title, /Ilhan/);
});

// --- Bar LunÀtico -------------------------------------------------------------------
import { parse as luParse } from './clubs/lunatico.js';
ok('lunatico: items with plausible times become sets, past filtered', () => {
  const mk = (title, iso, excerpt = '') => ({
    title, startDate: new Date(iso).getTime(), fullUrl: '/calendar/2026/x/' + title.toLowerCase(), excerpt,
  });
  const fixture = JSON.stringify({ items: [
    mk('Tumbao', '2026-07-18T21:00:00-04:00'),
    mk('Morning Thing', '2026-07-19T09:00:00-04:00'),
    mk('Old Show', '2026-06-01T21:00:00-04:00'),
    mk('Duo Night', '2026-07-20T20:30:00-04:00', 'Ana Smith - guitar Ben Lee - bass'),
  ]});
  const evs = luParse(fixture, new Date(2026, 6, 15));
  assert.equal(evs.length, 3); // Old Show filtered
  assert.deepEqual(evs[0].sets, ['21:00']);
  assert.deepEqual(evs[1].sets, []); // 9am not a plausible set time
  assert.equal(evs[2].personnel.length, 2);
});

// --- Jazz Cultural (via the Smalls feed) ----------------------------------------------
ok('smalls feed: jazzcultural venue now included', () => {
  const tpl = `
  <div class="flex-column day-list">
    <div class="title1">Wed Jul 15</div>
    <div class="venue-group">
      <div class="jazzcultural-color text2">Jazzcultural</div>
      <div class="flex-column day-event">
        <div class="text-grey text2">2:00 PM</div>
        <a href="/events/33187-afternoon-jam/"><div class="text2 day_event_title">Afternoon Jam in the Cafe</div></a>
      </div>
    </div>
  </div>`;
  const evs = smParse(tpl, TODAY);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].clubId, 'jazzcultural');
  assert.deepEqual(evs[0].sets, ['14:00']);
});

// --- crawl merge integration (failure isolation rules) --------------------------
import { mergeCrawlResults } from './run.js';
ok('merge: zero events = suspect, failures keep previous, dedupe + sort', () => {
  const prev = [
    { id: 'a:2026-07-10:old', clubId: 'a', date: '2026-07-10', sets: [] },
    { id: 'b:2026-07-11:keep', clubId: 'b', date: '2026-07-11', sets: [] },
    { id: 'c:2026-07-12:keep', clubId: 'c', date: '2026-07-12', sets: [] },
  ];
  const results = [
    { status: 'fulfilled', value: { mod: './clubs/a.js', events: [
      { id: 'a:2026-07-20:new', clubId: 'a', date: '2026-07-20', sets: ['19:00'] },
      { id: 'a:2026-07-20:new', clubId: 'a', date: '2026-07-20', sets: ['19:00'] }, // dupe
    ] } },
    { status: 'fulfilled', value: { mod: './clubs/b.js', events: [] } },   // suspect
    { status: 'rejected', reason: new Error('site down') },               // failure
  ];
  const out = mergeCrawlResults(results, { previousEvents: prev, targetIds: new Set(['a', 'b', 'c']) });
  // club a: fresh replaces old; club b: suspect -> previous kept; club c: untargeted-by-results -> kept
  assert.deepEqual(out.events.map((e) => e.id),
    ['b:2026-07-11:keep', 'c:2026-07-12:keep', 'a:2026-07-20:new']);
  assert.equal(out.freshCount, 2); // pre-dedupe count of fresh
  assert.equal(out.keptCount, 2);
  assert.equal(out.errors.length, 2);
  assert.ok(out.errors.some((e) => /0 events/.test(e)));
  assert.ok(out.errors.some((e) => /site down/.test(e)));
});
