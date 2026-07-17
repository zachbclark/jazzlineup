// Parser smoke tests against fixture snippets that mirror each site's real
// markup (structures verified against the live sites on 2026-07-13).
// Run: node crawler/test.mjs
import assert from 'node:assert';
import { parse as jgParse } from './clubs/jazzgallery.js';
import { parsePage as smParse, parseEventPersonnel as smParseEventPersonnel } from './clubs/smalls.js';
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

ok('smalls: time ranges -> start-time set + "until" detail', () => {
  const tpl = `
  <div class="flex-column day-list">
    <div class="title1">Mon Jul 13</div>
    <div class="venue-group">
      <div class="smalls-color text2">Smalls</div>
      <div class="flex-column day-event">
        <div class="text-grey text2">11:45 PM - 4:00 AM</div>
        <a href="/events/1-jam/"><div class="text2 day_event_title">Late Jam</div></a>
      </div>
    </div>
  </div>`;
  const evs = smParse(tpl, TODAY);
  assert.deepEqual(evs[0].sets, ['23:45'], 'end time must not become a set');
  assert.equal(evs[0].details, 'until 4:00 AM');
  assert.equal(evs[0].late, true, '11pm+ starts wear the late tag (no date shift)');
  assert.equal(evs[0].date, '2026-07-13', 'same-day late show must NOT shift days');
});

ok('smalls: event-page band block parses into personnel', () => {
  const page = `
  <div class="title5">The Band</div>
  <div class="event-band">
    <a class="artist-link" href="/search/?q=1">Jonathan Thomas / Piano</a>
    <a class="artist-link" href="/search/?q=2">Ahmed McLemore / Bass</a>
    <a class="artist-link" href="/search/?q=3">Drew Hoschar / Drums</a>
  </div>
  <div class="flex-row event-set-selector"></div>`;
  const p = smParseEventPersonnel(page);
  assert.deepEqual(p, [
    { name: 'Jonathan Thomas', instrument: 'piano' },
    { name: 'Ahmed McLemore', instrument: 'bass' },
    { name: 'Drew Hoschar', instrument: 'drums' },
  ]);
});

// --- Village Vanguard ----------------------------------------------------------
ok('vanguard: expands run + generates VJO Mondays', () => {
  const html = `
  <h2>VANGUARD JAZZ ORCHESTRA</h2>
  <h3 class="event-tagline">Every Monday Night</h3>
  <p>The 16-piece big band.</p>
  <a href="https://vv.squadup.com/artists/vanguard-jazz-orchestra?utm=x">TICKETS</a>
  <h2>Ben Wendel</h2>
  <h3>July 14 &#8209; July 19</h3>
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
  // &#8209; above is U+2011 non-breaking hyphen — the exact character that
  // made the real Ben Wendel week vanish (NYCJR audit catch, 2026-07-16)
  const wendel = evs.filter((e) => e.title === 'Ben Wendel');
  assert.equal(wendel.length, 6, 'U+2011 date range must still parse');
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
  assert.equal(evs[0].details, 'Birdland Jazz Club — Doors @ 6:00PM');
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

// --- Blue Note LA (same platform, region 'la') ---------------------------------
import { parse as bnlaParse } from './clubs/bluenotela.js';
ok('bluenotela: same markup maps to LA club id; B-Side room kept with details', () => {
  const html = `
  <table><tbody><tr>
    <td><div class='inner'><div class='day'>16</div>
      <div class='day-wrap single-show'>
        <h3><a href='https://www.bluenotejazz.com/la/tm-event/robert-glasper/'>Robert Glasper</a></h3>
        <div class='showtimes'><time>8:00 PM</time> &amp; <time>10:30 PM</time><div class='venue'>Blue Note Los Angeles</div></div>
      </div>
      <div class='day-wrap '>
        <h3><a href='/la/tm-event/late-hang/'>Late Hang</a></h3>
        <div class='showtimes'><time>11:30 PM</time><div class='venue'>B-Side at Blue Note Los Angeles</div></div>
      </div>
    </div></td>
  </tr></tbody></table>`;
  const evs = bnlaParse(html, 2026, 7);
  assert.equal(evs.length, 2, 'both rooms kept');
  assert.ok(evs.every((e) => e.clubId === 'bluenotela'));
  assert.equal(evs[0].title, 'Robert Glasper');
  assert.match(evs[0].url, /\/la\/tm-event\/robert-glasper/);
  const bside = evs.find((e) => /B-Side/.test(e.details ?? ''));
  assert.ok(bside, 'B-Side room name rides along as details');
  assert.equal(bside.late, true, '11:30 PM start wears the late tag');
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

  // comma-run rosters: the ", and" seam and trailing punctuation never
  // reach the UI, and "With" never joins a name (Pre-War Ponies, 2026-07-16)
  const pw = parsePersonnel('With Daria Grace - vocals & baritone ukulele, J. Walter Hawkes - trombone, ukulele & vocals, Jim Whitney - bass, and Willie Martinez - drums.');
  assert.equal(pw.length, 4);
  assert.deepEqual(pw[0], { name: 'Daria Grace', instrument: 'vocals & baritone ukulele' });
  assert.deepEqual(pw[2], { name: 'Jim Whitney', instrument: 'bass' });
  assert.deepEqual(pw[3], { name: 'Willie Martinez', instrument: 'drums' });
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
  assert.equal(jane.personnel, null, 'no description -> no personnel');
  // ?date= is load-bearing: without it Smoke's Show Detail page can't
  // resolve the night (bug found by Zach clicking through, 2026-07-16)
  assert.equal(jane.url, 'https://tickets.smokejazz.com/shows/11747/?date=2026-07-15');
  const late = evs.find((e) => /Late Night/.test(e.title));
  assert.equal(late.date, '2026-07-16'); // 02:00Z = 10pm ET on the 16th
  assert.deepEqual(late.sets, ['22:00']);
});

ok('late-night rule: after-midnight starts belong to the previous evening', () => {
  // 04:30Z Jul 17 = 12:30am ET Jul 17 -> attributed to the evening of Jul 16
  const fixture = JSON.stringify([
    { id: 9, datetime: '2026-07-17T04:30:00Z', show_id: 12000, show: { id: 12000, name: 'After Hours Hang' } },
  ]);
  const evs = smokeParse(fixture);
  assert.equal(evs[0].date, '2026-07-16');
  assert.equal(evs[0].late, true);
  assert.deepEqual(evs[0].sets, ['00:30']);
});

ok('smoke: show.description roster becomes personnel with no extra fetch', () => {
  // real Turntable API shape (verified 2026-07-16): description is HTML with
  // boilerplate + prices + line-per-player roster + press-quote prose
  const desc = '<p>*PLEASE NOTE: All 6:30PM and 8:30PM shows at Smoke are Dinner Shows</p><p><br></p>'
    + '<p>$25.00 / $40.00 / $50.00 / $55.00 – Wed, Thu, Fri &amp; Sun</p>'
    + '<p>Jane Monheit – vocals</p><p>Max Haymer – piano</p><p>Neal Miner – bass</p><p>Rick Montalbano – drums</p>'
    + '<p>“A voice of phenomenal beauty.” <em>– The New York Times</em></p>'
    + '<p>Vocalist Jane Monheit brings her signature warmth, joined by her acclaimed trio: pianist Max Haymer, bassist Neal Miner, and drummer Rick Montalbano.</p>';
  const fixture = JSON.stringify([
    { id: 1, datetime: '2026-07-16T22:30:00Z', show_id: 11747, show: { id: 11747, name: 'Jane Monheit Sings Cole Porter', description: desc } },
  ]);
  const evs = smokeParse(fixture);
  assert.equal(evs[0].personnel.length, 4, 'roster lines parsed, prose/prices rejected');
  assert.deepEqual(evs[0].personnel[0], { name: 'Jane Monheit', instrument: 'vocals' });
  assert.deepEqual(evs[0].personnel[3], { name: 'Rick Montalbano', instrument: 'drums' });
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

ok('lunatico: *** promo blocks stripped, TWO SETS times mined', () => {
  const fixture = JSON.stringify({ items: [{
    title: 'Bobby Hawk', startDate: new Date('2026-07-20T21:00:00-04:00').getTime(),
    fullUrl: '/calendar/2026/bobby',
    excerpt: '***TWO SETS: 9PM &amp; 10:15PM*** ***$10 (CASH) SUGGESTED DONATION*** A completely improvised body of work.',
  }]});
  const evs = luParse(fixture, new Date(2026, 6, 15));
  assert.deepEqual(evs[0].sets, ['21:00', '22:15']);
  assert.ok(!evs[0].details.includes('*'), 'details still contain ***');
  assert.match(evs[0].details, /improvised/);
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

// --- ViewCy venues (Barbès, Close Up) --------------------------------------------
import { parse as barbesParse } from './clubs/barbes.js';
import { parse as closeupParse } from './clubs/closeup.js';
ok('viewcy: UTC starts -> NY dates, set-merging, personnel-less details', () => {
  const fixture = JSON.stringify({ data: [
    {
      name: 'SLAVIC SOUL PARTY', url: 'https://www.viewcy.com/event/ssp',
      description: '<div><strong>Every Tuesday.</strong><br>Fiery brass band.</div>',
      timezone: 'America/New_York',
      events: [{ name: 'SLAVIC SOUL PARTY', starts_at: '2026-07-15T01:00:00.000Z', book_url: 'https://www.viewcy.com/event/ssp' }],
    },
    {
      name: 'KALIA VANDEVER', url: 'https://www.viewcy.com/event/kv',
      description: '',
      events: [
        { name: 'KALIA VANDEVER - Set 1', starts_at: '2026-07-19T00:00:00.000Z', book_url: 'https://www.viewcy.com/event/kv' },
        { name: 'KALIA VANDEVER - Set 2', starts_at: '2026-07-19T02:00:00.000Z', book_url: 'https://www.viewcy.com/event/kv' },
      ],
    },
  ], total_count: 2, has_more: false });
  const evs = barbesParse(fixture);
  assert.equal(evs.length, 2);
  const ssp = evs.find((e) => /SLAVIC/.test(e.title));
  assert.equal(ssp.date, '2026-07-14'); // 01:00Z = 9pm ET the night before
  assert.deepEqual(ssp.sets, ['21:00']);
  assert.equal(ssp.clubId, 'barbes');
  assert.match(ssp.details, /Fiery brass band/);
  const kv = evs.find((e) => /VANDEVER/.test(e.title));
  assert.equal(kv.title, 'KALIA VANDEVER', 'Set 1/Set 2 suffixes merge');
  assert.deepEqual(kv.sets, ['20:00', '22:00']);
  assert.equal(kv.date, '2026-07-18');
  const cu = closeupParse(fixture);
  assert.equal(cu[0].clubId, 'closeup');
});

ok('viewcy: bolded-name roster parses clean (Pre-War Ponies, found by Zach 2026-07-16)', () => {
  // real Barbès description — the old parser shipped "With Daria Grace",
  // "trombone,", "bass, and", "drums." to the UI
  const desc = '<div><a href="http://www.prewarponies.com/"><strong>THE PRE-WAR PONIES.</strong></a> '
    + '20s, 30s and 40s forgotten gems by the likes of Irving Berlin and Hoagy Carmichael.</div>'
    + '<div>&nbsp;With <strong>Daria Grace</strong> - vocals &amp; baritone ukulele, '
    + '<strong>J. Walter Hawkes</strong> - trombone, ukulele &amp; vocals, '
    + '<strong>Jim Whitney</strong> - bass, and <strong>Willie Martinez</strong> - drums.&nbsp;</div>'
    + '<div><strong><em>$20 suggested</em></strong></div>';
  const fixture = JSON.stringify({ data: [{
    name: 'THE PRE-WAR PONIES', url: 'https://www.viewcy.com/event/ponies',
    description: desc,
    events: [{ name: 'THE PRE-WAR PONIES', starts_at: '2026-07-16T23:00:00.000Z', book_url: 'https://www.viewcy.com/event/ponies' }],
  }], total_count: 1, has_more: false });
  const evs = barbesParse(fixture);
  assert.deepEqual(evs[0].personnel, [
    { name: 'Daria Grace', instrument: 'vocals & baritone ukulele' },
    { name: 'J. Walter Hawkes', instrument: 'trombone, ukulele & vocals' },
    { name: 'Jim Whitney', instrument: 'bass' },
    { name: 'Willie Martinez', instrument: 'drums' },
  ]);
});

// --- The Django ---------------------------------------------------------------------
import { parse as djParse } from './clubs/django.js';
ok('django: event_card articles -> dated events with set pairs', () => {
  const html = `
  <div class="grid__listings--group js-grid-group -show" data-date="2026-07-14">
    <h3 class="events__date tilda-petite">Tuesday, July 14</h3>
    <article class="event_card" data-controller="event-card" data-datetime="2026-07-14T20:00:00.000-0400">
      <h3 class="event__title">Helio Alves Quintet</h3>
      <div class="event__info"><p class="event__date">Tuesday, July 14</p>
        <div class="event__times"><p class="event_card__time-pair"><span>7:00PM</span><span class="time-divider">|</span><span>8:45PM</span></p></div>
      </div>
      <div class="event__ctas">
        <a class="details-container" href="https://www.thedjangonyc.com/events/helio-alves-31/?selected_date=2026-07-14">Details</a>
        <a class="details-container" target="_blank" href="https://resy.com/cities/new-york-ny/venues/the-django?date=2026-07-14&amp;seats=2">Reserve</a>
      </div>
    </article>
    <article class="event_card" data-controller="event-card" data-datetime="2026-07-14T22:30:00.000-0400">
      <h3 class="event__title">Late Night Hang</h3>
      <div class="event__times"><p class="event_card__time-pair"><span>10:30PM</span></p></div>
      <div class="event__ctas"><a class="details-container" href="https://www.thedjangonyc.com/events/late-hang/?selected_date=2026-07-14">Details</a></div>
    </article>
  </div>`;
  const evs = djParse(html);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Helio Alves Quintet');
  assert.equal(evs[0].date, '2026-07-14');
  assert.deepEqual(evs[0].sets, ['19:00', '20:45']);
  assert.match(evs[0].url, /helio-alves-31/);
  assert.ok(!evs[0].url.includes('resy.com'), 'details link, not the resy link');
  assert.deepEqual(evs[1].sets, ['22:30']);
});

// --- Cellar Dog -----------------------------------------------------------------------
import { parse as cdParse } from './clubs/cellardog.js';
ok('cellardog: month items -> events, "(ends at 2am)" stripped', () => {
  const fixture = JSON.stringify([
    { title: 'Jihee Heo Quartet (ends at 2am)', startDate: new Date('2026-07-18T22:00:00-04:00').getTime(), fullUrl: '/new-music/jihee-heo' },
    { title: 'Afternoon Blues', startDate: new Date('2026-07-19T05:00:00-04:00').getTime(), fullUrl: '/new-music/blues' },
  ]);
  const evs = cdParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Jihee Heo Quartet');
  assert.equal(evs[0].date, '2026-07-18');
  assert.deepEqual(evs[0].sets, ['22:00']);
  assert.match(evs[0].url, /cellardog\.net\/new-music\/jihee-heo/);
  assert.deepEqual(evs[1].sets, [], '5am startDate is not a plausible set time');
});

// --- Arthur's Tavern ---------------------------------------------------------------------
import { parse as atParse } from './clubs/arthurs.js';
ok("arthurs: weekly residencies generate dated events", () => {
  const html = `
  <h1>Performances</h1>
  <p>MONDAYS Grove Street Stompers Dixieland Jazz Band (7pm - 10pm) Toni Menage (10pm)
  TUESDAYS Yuka Mito Jazz Quartet (7pm - 9:30pm)
  SATURDAYS Sweet Georgia Brown (10pm - 2:30am)</p>`;
  const evs = atParse(html, TODAY); // Mon Jul 13
  const mondays = evs.filter((e) => e.date === '2026-07-13');
  assert.equal(mondays.length, 2, `expected 2 Monday acts, got ${mondays.length}`);
  assert.match(mondays[0].title, /Grove Street Stompers/);
  assert.deepEqual(mondays[0].sets, ['19:00'], 'range end is closing time, not a set');
  assert.deepEqual(mondays[1].sets, ['22:00']);
  const tue = evs.filter((e) => e.date === '2026-07-14');
  assert.equal(tue.length, 1);
  assert.match(tue[0].title, /Yuka Mito/);
  // 3 weeks x (2 Mon + 1 Tue + 1 Sat) = 12
  assert.equal(evs.length, 12);
});

// --- Zinc Bar ---------------------------------------------------------------------------
import { parse as zbParse } from './clubs/zincbar.js';
ok('zincbar: tribe events; midnight start_date -> times mined from text', () => {
  const fixture = JSON.stringify({ total: 2, events: [
    {
      title: 'Monday Jam hosted by Obed Calvaire', start_date: '2026-07-14 00:00:00',
      url: 'https://www.zincbar.com/event/monday-jam/',
      description: '<p>Showtimes: 7:30PM and 9:00PM | Tickets: $40 at the door. Hosted jam session.</p>',
    },
    {
      title: 'Samba Night', start_date: '2026-07-15 20:00:00',
      url: 'https://zincjazz.com/event/samba/',
      description: '<p>Brazilian grooves all night.</p>',
    },
  ]});
  const evs = zbParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].date, '2026-07-14');
  assert.deepEqual(evs[0].sets, ['19:30', '21:00'], 'mined from description');
  assert.equal(evs[0].priceText, '$40', 'price mined from description');
  assert.deepEqual(evs[1].sets, ['20:00'], 'exact API time wins when present');
  assert.match(evs[1].details, /Brazilian/);
});

// --- The Pocket -------------------------------------------------------------------------
import { parse as pkParse } from './clubs/pocket.js';
ok('pocket: month grid days -> events; desktop+mobile dupes merge into sets', () => {
  const html = `
  <div id="simple-events-calendar-day-2026-07-20" class="simple-events-calendar-month__day-cell simple-events-calendar-month__day-cell--desktop">
    <div class="simple-events-calendar-month__events">
      <article class="simple-events-calendar-month__calendar-event">
        <div class="simple-events-calendar-month__calendar-event-datetime"><time datetime="19:00">7:00 pm</time></div>
        <h3 class="simple-events-calendar-month__calendar-event-title"><a href="https://thepocketnyc.com/event/mingus-big-band-7/?se-date=4223" title="Mingus Big Band">Mingus Big Band</a></h3>
      </article>
      <article class="simple-events-calendar-month__calendar-event">
        <div class="simple-events-calendar-month__calendar-event-datetime"><time datetime="21:00">9:00 pm</time></div>
        <h3 class="simple-events-calendar-month__calendar-event-title"><a href="https://thepocketnyc.com/event/mingus-big-band-7/?se-date=4224">Mingus Big Band</a></h3>
      </article>
    </div>
  </div>
  <div id="simple-events-calendar-day-2026-07-20" class="simple-events-calendar-month__day-cell simple-events-hidden-desktop">
    <article class="simple-events-calendar-month__calendar-event">
      <div class="simple-events-calendar-month__calendar-event-datetime"><time datetime="19:00">7:00 pm</time></div>
      <h3 class="simple-events-calendar-month__calendar-event-title"><a href="https://thepocketnyc.com/event/mingus-big-band-7/?se-date=4223">Mingus Big Band</a></h3>
    </article>
  </div>
  <div id="simple-events-calendar-day-2026-07-21" class="simple-events-calendar-month__day-cell">
    <article class="simple-events-calendar-month__calendar-event">
      <div class="simple-events-calendar-month__calendar-event-datetime"><time datetime="19:30">7:30 pm</time></div>
      <h3 class="simple-events-calendar-month__calendar-event-title"><a href="https://thepocketnyc.com/event/immanuel-wilkins/?se-date=4300">Immanuel Wilkins Quartet</a></h3>
    </article>
  </div>`;
  const evs = pkParse(html);
  assert.equal(evs.length, 2, `expected 2 merged events, got ${evs.length}`);
  const mingus = evs.find((e) => /Mingus/.test(e.title));
  assert.equal(mingus.date, '2026-07-20');
  assert.deepEqual(mingus.sets, ['19:00', '21:00'], 'two sets merged, dupes dropped');
  assert.equal(mingus.url, 'https://thepocketnyc.com/event/mingus-big-band-7/');
  const wilkins = evs.find((e) => /Wilkins/.test(e.title));
  assert.equal(wilkins.date, '2026-07-21');
  assert.deepEqual(wilkins.sets, ['19:30']);
});

// --- Ornithology (both rooms) --------------------------------------------------------------
import { parsePage as orParse, parseAbbrevLine } from './clubs/ornithology.js';
ok('ornithology: sections -> events; abbreviated personnel expand', () => {
  assert.deepEqual(parseAbbrevLine('Kazu Yokoshima (p)'), { name: 'Kazu Yokoshima', instrument: 'piano' });
  assert.deepEqual(parseAbbrevLine('Greg Carleton (saxophone)'), { name: 'Greg Carleton', instrument: 'saxophone' });
  assert.deepEqual(parseAbbrevLine('Justin Flynn ()ts)'), { name: 'Justin Flynn', instrument: 'tenor sax' }, 'site typo tolerated');
  assert.equal(parseAbbrevLine('Doors open at 6pm (limited)'), null);

  const html = `
  <section id="1001"><div class="row event-content"><div class="event-content-item event-text-holder">
    <h2>Earlybird Show</h2>
    <p class="event-main-text event-day">Tuesday July 14th</p>
    <div class="event-info-text">
      <div data-event-id="9" style="display: none"></div>
      <p style="text-align: center;">Kazu Yokoshima (p)</p>
      <p style="text-align: center;">Leighton Harrell (b)</p>
      <p style="text-align: center;">Mike Camacho (d)</p>
    </div>
    <p class="event-main-text event-time">06:30 PM - 08:30 PM</p>
  </div></div></section>
  <section id="1002"><div class="row event-content"><div class="event-content-item">
    <h2>Late Night Jam</h2>
    <p class="event-main-text event-day">Tuesday July 14th</p>
    <div class="event-info-text"><p>Ben Wolstein (b)</p><p>Will Hill III (p)</p></div>
    <p class="event-main-text event-time">11:00 PM - 01:00 AM</p>
  </div></div></section>`;
  const evs = orParse(html, 'ornithologycafe', 'https://cafeornithology.com/x', TODAY);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].clubId, 'ornithologycafe');
  assert.equal(evs[0].date, '2026-07-14');
  assert.deepEqual(evs[0].sets, ['18:30'], 'range end is the end time, not a set');
  assert.equal(evs[0].personnel.length, 3);
  assert.deepEqual(evs[0].personnel[1], { name: 'Leighton Harrell', instrument: 'bass' });
  assert.equal(evs[1].late, true, '11pm start wears the late tag');
  assert.equal(evs[1].date, '2026-07-14', 'same-day 11pm start must not shift days');
});

// --- Bar Bayeux ----------------------------------------------------------------------------
import { parse as bxParse } from './clubs/barbayeux.js';
ok('barbayeux: day/time prefix stripped, roster split into details', () => {
  const fixture = JSON.stringify({ upcoming: [
    {
      title: 'TUES 8-11pm Jam Session. House Band Set - Miki Yamanaka, Matt Dwonszyk, Diego Voglino',
      startDate: new Date('2026-07-14T20:00:00-04:00').getTime(),
      fullUrl: '/jazz/8ajbd79-abc',
    },
    { title: 'Marta Sanchez Trio', startDate: new Date('2026-07-16T21:00:00-04:00').getTime(), fullUrl: '/jazz/marta' },
    // regression 2026-07-15: "&"-joined set times leaked "& 9:30" into the
    // title, which the calendar's mainArtist() trimmed to "& 9"
    { title: 'WED 8 &amp; 9:30 Morgan Guerin', startDate: new Date('2026-07-15T20:00:00-04:00').getTime(), fullUrl: '/jazz/morgan' },
  ]});
  const evs = bxParse(fixture);
  assert.equal(evs.length, 3);
  assert.equal(evs[0].title, 'Jam Session. House Band Set');
  assert.equal(evs[0].date, '2026-07-14');
  assert.deepEqual(evs[0].sets, ['20:00']); // 8-11pm is a range, not two sets
  assert.match(evs[0].details, /Miki Yamanaka/);
  assert.match(evs[0].url, /barbayeux\.com\/jazz\/8ajbd79-abc/);
  assert.equal(evs[1].title, 'Marta Sanchez Trio');
  assert.deepEqual(evs[1].sets, ['21:00']);
  assert.equal(evs[2].title, 'Morgan Guerin');
  assert.deepEqual(evs[2].sets, ['20:00', '21:30']); // both sets, mined from the title
});

// --- Bill's Place -----------------------------------------------------------------------------
import { parse as bpParse } from './clubs/billsplace.js';
ok("billsplace: residency generator emits Fri/Sat pairs; vanished text -> 0", () => {
  const html = '<h1>BILL SAXTON & THE HARLEM ALL-STARS</h1><p>EVERY FRIDAY & SATURDAY | 7PM & 9:30PM</p>';
  const evs = bpParse(html, TODAY); // Mon Jul 13
  assert.equal(evs.length, 8, '4 weeks x Fri+Sat');
  assert.equal(evs[0].date, '2026-07-17'); // first Friday after Mon Jul 13
  assert.equal(evs[1].date, '2026-07-18');
  assert.deepEqual(evs[0].sets, ['19:00', '21:30']);
  assert.equal(evs[0].personnel[0].name, 'Bill Saxton');
  assert.deepEqual(bpParse('<h1>Closed for renovations</h1>', TODAY), [], 'residency text gone -> SUSPECT');
});

// --- JCAL (Queens; SociableKit/Eventbrite feed) --------------------------------
import { parse as jcParse } from './clubs/jcal.js';
ok('jcal: jazz-flagged events kept, others dropped', () => {
  const fixture = JSON.stringify({ events: [
    { name: 'Downtown Jamaica Riddim and Jazz Festival: Day 1', date_start: '2026-07-24',
      start_time_raw: '2026-07-24T18:00:00', description: '<p>Free outdoor festival.</p>',
      ticket_uri: 'https://www.eventbrite.com/e/riddim-jazz-1', price_range: 'Free' },
    { name: 'Queens Get The Cup: World Cup Viewing', date_start: '2026-07-19',
      start_time_raw: '2026-07-19T12:30:00', description: '<p>Watch the final.</p>', ticket_uri: 'x' },
  ]});
  const evs = jcParse(fixture);
  assert.equal(evs.length, 1, 'world cup viewing must be filtered out');
  assert.equal(evs[0].date, '2026-07-24');
  assert.deepEqual(evs[0].sets, ['18:00']);
  assert.equal(evs[0].priceText, 'Free');
});

// --- Roulette --------------------------------------------------------------------
import { parse as rlParse } from './clubs/roulette.js';
ok('roulette: event blocks -> dated events with price', () => {
  const html = `
  <div class="list-events">
    <div class="event">
      <h2 class="event-title"><a href="https://roulette.org/event/jim-staley/">Jim Staley with Ikue Mori and Zeena Parkins</a></h2>
      <div class="event-img"><a href="https://roulette.org/event/jim-staley/"><img src="x.jpg"/></a></div>
      <div class="event-time">Thursday, August 20, 2026. 8:00 pm</div>
      <div class="event-price">Tickets $25</div>
      <a class="event-purchase" href="https://ci.ovationtix.com/36368/production/1264032">Purchase Tickets</a>
      <div class="event-desc">Roulette co-founder Jim Staley returns to the stage.</div>
    </div>
    <div class="event">
      <h2 class="event-title"><a href="https://roulette.org/event/other/">Mendoza Hoff Revels</a></h2>
      <div class="event-time">Sunday, September 13, 2026. 8:00 pm</div>
    </div>
  </div>`;
  const evs = rlParse(html);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].date, '2026-08-20');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[0].priceText, '$25');
  assert.match(evs[0].details, /co-founder/);
  assert.equal(evs[1].date, '2026-09-13');
});

// --- Sam First (Wix warmup-data) ----------------------------------------------------
import { parse as sfParse } from './clubs/samfirst.js';
ok('samfirst: warmup-data events -> LA-local dates', () => {
  const warmup = { appsWarmupData: { deep: { events: [
    {
      title: 'Devin Daniels "Happenings"', slug: 'devin-daniels-happenings',
      scheduling: { config: { startDate: '2026-07-15T02:30:00.000Z', timeZoneId: 'America/Los_Angeles' } },
      description: 'House band at 7:30pm.',
    },
  ] } } };
  const html = `<html><script type="application/json" id="wix-warmup-data">${JSON.stringify(warmup)}</script></html>`;
  const evs = sfParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-14'); // 02:30Z = 7:30pm PT the previous day
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.match(evs[0].url, /samfirstbar\.com\/events\/devin-daniels/);
});

// --- Catalina (TicketWeb plugin, birdland sibling) -----------------------------------
import { parse as ctParse } from './clubs/catalina.js';
ok('catalina: tw-sections -> events with doors detail', () => {
  const html = `
  <div class="tw-plugin-upcoming-event-list">
    <div class="tw-section"><div class="row">
      <div class="date-month-wrapper"><div class="name-of-month">Jul</div><div class="date-of-month">15</div></div>
      <div class="tw-name"><a href="https://catalinajazzclub.com/tm-event/elliott-caine-quintet/">ELLIOTT CAINE QUINTET</a></div>
      <span class="tw-event-time">8:30 pm</span>
      <span class="tw-event-door-time">7:00 pm</span>
    </div></div>
  </div>`;
  const evs = ctParse(html, TODAY);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:30']);
  assert.match(evs[0].details, /Doors @ 7:00 pm/);
  assert.match(evs[0].url, /elliott-caine/);
});

// --- Vibrato (Squarespace, LA tz) ----------------------------------------------------
import { parse as vbParse } from './clubs/vibrato.js';
ok('vibrato: upcoming items -> LA dates/times', () => {
  const fixture = JSON.stringify({ upcoming: [
    { title: 'Christian Jacob Trio', startDate: new Date('2026-07-18T19:30:00-07:00').getTime(), fullUrl: '/music/cjt' },
  ]});
  const evs = vbParse(fixture);
  assert.equal(evs[0].date, '2026-07-18');
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.match(evs[0].url, /vibratogrilljazz\.com\/music\/cjt/);
});

// --- World Stage (Tockify) -----------------------------------------------------------
import { parse as wsParse } from './clubs/worldstage.js';
ok('worldstage: tockify events -> events with detail urls', () => {
  const ms = new Date('2026-07-16T20:00:00-07:00').getTime();
  const fixture = JSON.stringify({ events: [
    { eid: { uid: '655' }, when: { start: { millis: ms, tzid: 'America/Los_Angeles' } },
      content: { summary: { text: 'Jazz Jam Session' }, description: { text: 'Weekly session.' } } },
  ]});
  const evs = wsParse(fixture);
  assert.equal(evs[0].date, '2026-07-16');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.match(evs[0].url, /tockify\.com\/the\.world\.stage\/detail\/655\//);
});

// --- Jazz at LACMA ---------------------------------------------------------------------
import { parse as lcParse } from './clubs/lacma.js';
ok('lacma: card-event blocks -> free Friday events, series prefix stripped', () => {
  const html = `
  <div class="views-row"><div class="card-event">
    <div class="card-event__header"><span class="card-event__type">Music</span></div>
    <div class="card-event__name"><a class="no-text-styles" href="/event/jazz-lacma-robert-rodriguez">Jazz at LACMA: Robert Rodriguez Quartet</a></div>
    <div class="card-event__content"><p>This week…</p></div>
    <div class="card-event__date"><span>Fri Jul 17</span> | <span>6 pm PT</span></div>
    <div class="card-event__location"><span>Smidt Welcome Plaza</span></div>
  </div></div>`;
  const evs = lcParse(html, TODAY);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'Robert Rodriguez Quartet');
  assert.equal(evs[0].date, '2026-07-17');
  assert.deepEqual(evs[0].sets, ['18:00']);
  assert.equal(evs[0].priceText, 'Free');
});

// --- The Mint (Plot/DICE listings API) ----------------------------------------------------
import { parse as mtParse } from './clubs/mint.js';
ok('mint: jazz listings kept, pop dropped, YYYYMMDD parsed', () => {
  const fixture = JSON.stringify([
    { title: 'PAUL CORNISH', day: '20260717', startTime: '7pm',
      permalink: 'https://themintla.com/listing/paul-cornish/',
      description: '<p>Pianist Paul Cornish is one of the most exciting rising voices in modern jazz.</p>',
      fromPrice: '$20' },
    { title: 'Sierra Sikora, Jenny Nuo', day: '20260714', startTime: '7pm',
      permalink: 'https://themintla.com/listing/sequoia/', description: '<p>Indie pop night.</p>' },
  ]);
  const evs = mtParse(fixture);
  assert.equal(evs.length, 1, 'pop night must be filtered out');
  assert.equal(evs[0].title, 'PAUL CORNISH');
  assert.equal(evs[0].date, '2026-07-17');
  assert.deepEqual(evs[0].sets, ['19:00']);
  assert.equal(evs[0].priceText, '$20');
});

// --- LA Phil family (Bowl + Disney Hall + Ford, one feed) ---------------------------------
import { parse as lpParse } from './clubs/laphil.js';
ok('laphil: Jazz/Blues kept per venue; classical + past dropped', () => {
  const fixture = JSON.stringify([
    { is_past: false, program: { name: 'Smooth Summer Jazz' },
      supporting_artists: 'The Commodores • Boney James <br> Sheila E.',
      start_time: '2026-08-30T18:30:00-07:00', genres: [{ id: 10, name: 'Jazz/Blues' }],
      absolute_url: '/events/performances/4252/2026-08-30/smooth-summer-jazz',
      venue: { id: 1, name: 'Hollywood Bowl' } }, // live feed sends an OBJECT (caught in prod)
    { is_past: false, program: { name: 'Jazz at The Ford' },
      start_time: '2026-08-01T20:00:00-07:00', genres: [{ id: 10, name: 'Jazz/Blues' }],
      venue: { id: 2, name: 'The Ford' } },
    { is_past: false, program: { name: 'WDCH Jazz: Brad Mehldau' },
      start_time: '2026-11-14T20:00:00-08:00', genres: [{ id: 10, name: 'Jazz/Blues' }],
      venue: { id: 3, name: 'Walt Disney Concert Hall' } },
    { is_past: false, program: { name: 'Tchaikovsky & Beethoven' },
      start_time: '2026-07-14T20:00:00-07:00', genres: [{ id: 1, name: 'Classical' }], venue: 'Hollywood Bowl' },
    { is_past: true, program: { name: 'Old Jazz Night' },
      start_time: '2026-06-01T20:00:00-07:00', genres: [{ id: 10, name: 'Jazz/Blues' }], venue: 'Hollywood Bowl' },
  ]);
  const evs = lpParse(fixture);
  assert.equal(evs.length, 3, 'three venues in, classical + past out');
  const bowl = evs.find((e) => e.clubId === 'hollywoodbowl');
  assert.equal(bowl.title, 'Smooth Summer Jazz');
  assert.deepEqual(bowl.sets, ['18:30']);
  assert.match(bowl.details, /Commodores.*Sheila E\./);
  assert.equal(evs.find((e) => e.clubId === 'theford').date, '2026-08-01');
  assert.equal(evs.find((e) => e.clubId === 'disneyhall').date, '2026-11-14');
});

// --- Gold-Diggers (DICE partners, shared with Zebulon) --------------------------------------
import { parse as gdParse } from './clubs/golddiggers.js';
ok('golddiggers: jazz keyword filter via shared DICE helper', () => {
  const fixture = JSON.stringify({ data: [
    { name: 'very good mondays', date: '2026-07-21T02:00:00Z', timezone: 'America/Los_Angeles',
      url: 'https://link.dice.fm/vgm', description: 'Weekly improvised jazz hang with rotating quartet.' },
    { name: 'Cherry Blonde, Adam Casanova', date: '2026-07-22T03:00:00Z',
      timezone: 'America/Los_Angeles', url: 'https://link.dice.fm/cb', description: 'Indie rock night.' },
  ]});
  const evs = gdParse(fixture);
  assert.equal(evs.length, 1, 'indie rock must be filtered out');
  assert.equal(evs[0].clubId, 'golddiggers');
  assert.equal(evs[0].date, '2026-07-20'); // 02:00Z = 7pm PT the previous day
  assert.deepEqual(evs[0].sets, ['19:00']);
});

// --- 2220 Arts (DICE venue page) --------------------------------------------------------------
import { parse as ttParse } from './clubs/twentytwotwenty.js';
ok('2220: __NEXT_DATA__ profile events parsed', () => {
  const next = { props: { pageProps: { profile: { sections: [{ events: [
    { name: "Qur'an Shaheed, haana lee, Trellis",
      perm_name: 'g53goa-quran-shaheed-15th-jul-2220-arts',
      dates: { event_start_date: '2026-07-15T20:00:00-07:00', timezone: 'America/Los_Angeles' },
      about: { description: '**Late Breakfast** presents an evening of genre-crossing music.' } },
  ] }] } } } };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script>`;
  const evs = ttParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.match(evs[0].url, /dice\.fm\/event\/g53goa/);
  assert.ok(!evs[0].details.includes('**'));
});

// --- Zebulon (DICE partners API) ---------------------------------------------------------------
import { parse as zpParse } from './clubs/zebulon.js';
ok('zebulon: jazz keyword filter + UTC -> LA conversion', () => {
  const fixture = JSON.stringify({ data: [
    { name: 'Kamasi Washington Quartet', date: '2026-07-19T03:00:00Z', timezone: 'America/Los_Angeles',
      url: 'https://link.dice.fm/abc', description: 'A night of spiritual jazz.' },
    { name: 'Night Scene: A Rock n Roll Sleaze Show', date: '2026-07-15T03:00:00Z',
      timezone: 'America/Los_Angeles', url: 'https://link.dice.fm/xyz', description: 'Rock.' },
  ]});
  const evs = zpParse(fixture);
  assert.equal(evs.length, 1, 'rock night must be filtered out');
  assert.equal(evs[0].date, '2026-07-18'); // 03:00Z = 8pm PT the previous day
  assert.deepEqual(evs[0].sets, ['20:00']);
});

// --- Harvelle's (SeatEngine month calendar) -----------------------------------------------------
import { parse as hvParse } from './clubs/harvelles.js';
ok("harvelles: date cells -> events with show times", () => {
  const html = `
  <table><tbody><tr>
    <td><span class='date'>17</span><div class='padding-small'>
      <ul><li><a href="/events/137965">The Toledo Show - Soul Jazz Cabaret</a></li></ul>
      <ul><li class='event-btn-group'><a class='event-btn-stacked' href=''>9:00 PM</a></li></ul>
    </div></td>
    <td><span class='date'>18</span><div class='padding-small'>
      <ul><li><a href="/events/137970">House of Vibe All-Stars</a></li></ul>
      <ul><li><a class='event-btn-stacked' href=''>8:00 PM</a></li>
      <li><a class='event-btn-stacked' href=''>10:30 PM</a></li></ul>
    </div></td>
  </tr></tbody></table>`;
  const evs = hvParse(html, 2026, 7);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].date, '2026-07-17');
  assert.deepEqual(evs[0].sets, ['21:00']);
  assert.match(evs[0].url, /harvelles\.com\/events\/137965/);
  assert.deepEqual(evs[1].sets, ['20:00', '22:30']);
});

// --- The Baked Potato (ThunderTix listing) -----------------------------------------
import { parse as bakedParse, parseDetailSets as bakedDetailSets } from './clubs/bakedpotato.js';
ok('bakedpotato: event_box blocks -> events with h3-roster personnel', () => {
  const html = `
  <div class="panel panel-default event_box"><div class="event_details"><article>
    <div class="event_image position-relative"><img src="x.png"></div>
    <div class="title-description">
      <div class="row ml-0 event_title clear event_title_no_flex my-2"><h1>P f f T</h1>
        <div class="event_date"> Thursday July 16, 2026 </div></div>
      <div class="fade-bottom-text event_description event_description_high_contrast compact-paragraphs">
        <h3>MIKE KENEALLY - GUITAR/KEYS</h3><h3>ANDREW SYNOWIEC - GUITAR</h3>
        <h3>BRYON BELLER - BASS</h3><h3>JONATHAN MOVER - DRUMS</h3>
        <h3>The Music of BRAND X and More..</h3></div>
    </article></div>
    <div class="event_actions" id="event_1"><a class="btn buy_tickets_button" href="/events/266082">Buy tickets</a></div>
  </div>
  <div class="panel panel-default event_box"><div class="event_details"><article>
    <div class="title-description">
      <div class="row event_title"><h1>SOLO ACT</h1>
        <div class="event_date"> Friday July 17, 2026 </div></div>
      <div class="event_description"><h3>An evening of improvised music.</h3></div>
    </article></div>
    <a class="btn buy_tickets_button" href="/events/266083">Buy tickets</a>
  </div>`;
  const evs = bakedParse(html);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'P f f T');
  assert.equal(evs[0].date, '2026-07-16');
  assert.equal(evs[0].personnel.length, 4);
  assert.deepEqual(evs[0].personnel[0], { name: 'MIKE KENEALLY', instrument: 'guitar/keys' });
  assert.match(evs[0].details, /BRAND X/);
  assert.match(evs[0].url, /thundertix\.com\/events\/266082/);
  assert.equal(evs[1].personnel, null, 'prose-only description yields no fake roster');
  assert.match(evs[1].details, /improvised music/);
});

ok('bakedpotato: detail page performance times -> sets', () => {
  const html = `<div>Thursday, July 16, 2026 - 08:00 PM PDT</div>
    <div>Thursday, July 16, 2026 - 10:00 PM PDT</div>`;
  assert.deepEqual(bakedDetailSets(html), { sets: ['20:00', '22:00'] });
});

// --- Silvana + Shrine (shared Harlem calendar.php) --------------------------------
import { parsePage as svParse } from './clubs/silvana.js';
ok('silvana/shrine: day cells -> jazz acts only, genre kept as detail', () => {
  const html = `
  <td><span class="wh">July 15</span>
    <p><a href onclick="return popCal(1);" id="t1">HAPPY HOUR! 6pm-8pm</a></p>
    <div class="hid" id="x1">Happy Hours with wings and drinks</div>
    <p><a href onclick="return popCal(2);" id="t2">7pm-8pm: Junho Lee - Jazz Guitarist</a></p>
    <div class="hid" id="x2">Junho Lee is a guitarist based in NYC.</div>
    <p><a href onclick="return popCal(3);" id="t3">8pm-9pm: George Karos - Songwriter</a></p>
    <div class="hid" id="x3">Acoustic pop originals.</div>
  </td>
  <td><span class="dy">July 16</span>
    <p><a href onclick="return popCal(4);" id="t4">9pm-11pm: Kevin Du Duo - Jazz Fusion</a></p>
  </td>`;
  const evs = svParse(html, 'silvana', TODAY);
  assert.equal(evs.length, 2, 'happy hour + songwriter must be filtered');
  assert.equal(evs[0].title, 'Junho Lee');
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['19:00']);
  assert.match(evs[0].details, /Jazz Guitarist/);
  assert.equal(evs[1].date, '2026-07-16');
  assert.deepEqual(evs[1].sets, ['21:00']);
  const sh = svParse(html, 'shrine', TODAY);
  assert.equal(sh[0].clubId, 'shrine');
});

// --- Sistas' Place -------------------------------------------------------------------
import { parse as spParse } from './clubs/sistasplace.js';
ok("sistasplace: featured-event article -> Saturday two-set show", () => {
  const html = `
  <article class="post-4851 category-event category-featured" aria-label="Reggie Woods Quintet">
    <a href="https://sistasplace.org/reggie-woods-quintet-3/"><img src="x.jpg"/></a>
    <p>Sat., July 18, 2026, Doors Open: 7:30 pm, 1st Show: 8 pm, 2nd Show: 9:30 pm.
    Sistas&#8217; Place, 456 Nostrand Avenue, Brooklyn NY.</p>
  </article>
  <article class="post-100 category-event" aria-label="Old Show">
    <p>Sat., March 22, 2025, 1st Show: 8 pm</p>
  </article>`;
  const evs = spParse(html, TODAY);
  assert.equal(evs.length, 1, 'stale featured posts must be dropped');
  assert.equal(evs[0].title, 'Reggie Woods Quintet');
  assert.equal(evs[0].date, '2026-07-18');
  assert.deepEqual(evs[0].sets, ['20:00', '21:30']);
  assert.match(evs[0].url, /reggie-woods/);
  assert.match(evs[0].details, /Doors 7:30/);
});

// --- Terraza 7 (Wix events, set-merging) ------------------------------------------------
import { parse as t7Parse } from './clubs/terraza7.js';
ok('terraza7: warmup events; First/Second Set merge into one show', () => {
  const warmup = { deep: { list: [
    { title: 'Sebastián Cruz Quartet | New Colombian Sounds',
      scheduling: { config: { startDate: '2026-07-16T23:30:00.000Z', timeZoneId: 'America/New_York' } },
      description: 'New Colombian music.' },
    { title: 'Tango Jazz ~ Jam | First Set',
      scheduling: { config: { startDate: '2026-07-20T00:00:00.000Z' } } },
    { title: 'Tango Jazz ~ Jam | Second Set',
      scheduling: { config: { startDate: '2026-07-20T02:00:00.000Z' } } },
  ] } };
  const html = `<script type="application/json" id="wix-warmup-data">${JSON.stringify(warmup)}</script>`;
  const evs = t7Parse(html);
  assert.equal(evs.length, 2, 'two sets must merge');
  const cruz = evs.find((e) => /Cruz/.test(e.title));
  assert.equal(cruz.date, '2026-07-16');
  assert.deepEqual(cruz.sets, ['19:30']);
  const tango = evs.find((e) => /Tango/.test(e.title));
  assert.equal(tango.title, 'Tango Jazz ~ Jam');
  assert.equal(tango.date, '2026-07-19'); // 00:00Z/02:00Z = 8pm/10pm ET on the 19th
  assert.deepEqual(tango.sets, ['20:00', '22:00']);
});

// --- Marjorie Eliot's ---------------------------------------------------------------------
import { parse as meParse } from './clubs/marjorie.js';
ok("marjorie: generator emits 8 Sundays at 3:30, free", () => {
  const evs = meParse(TODAY); // Mon Jul 13 2026
  assert.equal(evs.length, 8);
  assert.equal(evs[0].date, '2026-07-19'); // first Sunday after Mon Jul 13
  assert.deepEqual(evs[0].sets, ['15:30']);
  assert.equal(evs[0].priceText, 'Free');
  assert.ok(evs.every((e) => new Date(e.date + 'T12:00:00').getDay() === 0));
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

ok('merge: previous events from OTHER cities never leak into this city', () => {
  // Regression: first LA run inherited NYC previous data (legacy fallback)
  // and kept all 1460 NYC events in events-la.json.
  const prev = [
    { id: 'smalls:2026-07-16:x', clubId: 'smalls', date: '2026-07-16', sets: [] },   // NYC — not an LA target
    { id: 'samfirst:2026-07-16:y', clubId: 'samfirst', date: '2026-07-16', sets: [] },
  ];
  const results = [
    { status: 'fulfilled', value: { mod: './clubs/catalina.js', events: [
      { id: 'catalina:2026-07-20:z', clubId: 'catalina', date: '2026-07-20', sets: ['20:30'] },
    ] } },
    { status: 'rejected', reason: new Error('samfirst down') }, // samfirst keeps previous
  ];
  const out = mergeCrawlResults(results, {
    previousEvents: prev,
    targetIds: new Set(['catalina', 'samfirst']),
  });
  assert.deepEqual(out.events.map((e) => e.clubId).sort(), ['catalina', 'samfirst'],
    'smalls (NYC) must not survive into an LA merge');
  assert.equal(out.keptCount, 1);
});

// ============================================================ Chicago ======

// --- Green Mill (Events Manager calendar) ---------------------------------------
import { parseMonth as gmParse } from './clubs/greenmill.js';
ok('greenmill: month grid -> events with roster from gcal link, price from caltime', () => {
  const fixture = `
  <table class="em-calendar fullcalendar"><tbody><tr><td class="eventful">
  <div id="calblock">
    <div class="caldate"><a href="https://greenmilljazz.com/events/8pm-midnight-alfonso-ponticelli-2026-07-01/" title="(8pm &#8211; midnight) ALFONSO PONTICELLI">1</a></div>
    <ul>
      <li><a href="https://greenmilljazz.com/events/8pm-midnight-alfonso-ponticelli-2026-07-01/">(8pm - midnight) ALFONSO PONTICELLI</a>
        <div id="caltime">8:00pm - 12:00am<br />$10 cover </div>
        <div id="calshare"><div class="eventgcallink"><a href="https://www.google.com/calendar/event?action=TEMPLATE&#038;text=%288pm+-+midnight%29+ALFONSO+PONTICELLI&#038;dates=20260701T200000/20260701T000000&#038;details=Alfonso+Ponticelli+-+guitarSteve+Gibons+-+violinEthan+Philion+-+bassBob+Rummage+-drums&#038;ctz=America%2FChicago" target="_blank"><img alt="0"></a></div></div>
      </li>
      <li><a href="https://greenmilljazz.com/events/1am-jam-session-2026-07-02/">(1am - 3am) AFTER HOURS JAM SESSION</a>
        <div id="caltime">1:00am - 3:00am<br />Free </div>
      </li>
    </ul>
  </div></td></tr></tbody></table>`;
  const evs = gmParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'ALFONSO PONTICELLI');
  assert.equal(evs[0].date, '2026-07-01');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[0].priceText, '$10 cover');
  assert.deepEqual(evs[0].personnel, [
    { name: 'Alfonso Ponticelli', instrument: 'guitar' },
    { name: 'Steve Gibons', instrument: 'violin' },
    { name: 'Ethan Philion', instrument: 'bass' },
    { name: 'Bob Rummage', instrument: 'drums' },
  ]);
  // the 1am jam is attributed to the previous evening and tagged late
  assert.equal(evs[1].date, '2026-07-01');
  assert.equal(evs[1].late, true);
  assert.deepEqual(evs[1].sets, ['01:00']);
});

// --- Jazz Showcase (Squarespace month API) ---------------------------------------
import { parse as jsParse } from './clubs/jazzshowcase.js';
ok('jazzshowcase: epoch dates in Chicago time, sets from excerpt', () => {
  const fixture = JSON.stringify([
    { title: 'Sharel Cassity Quartet', startDate: 1784250000000, // 8pm CDT Jul 16
      fullUrl: '/nowplaying/sharel-cassity-quartet',
      excerpt: '<p>Sets at 8:00 PM &amp; 10:00 PM</p>' },
    { title: 'no-date item' },
  ]);
  const evs = jsParse(fixture);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-16');
  assert.deepEqual(evs[0].sets, ['20:00', '22:00']);
  assert.match(evs[0].url, /jazzshowcase\.com\/nowplaying\/sharel-cassity-quartet/);
});

// --- Constellation + Hungry Brain (SeeTickets WP plugin, shared) ------------------
import { parse as conParse } from './clubs/constellation.js';
import { parse as hbParse } from './clubs/hungrybrain.js';
const seeTicketsCard = ({ title, date, genre, price = '$20.00', show = '8:00PM' }) => `
  <div class="mt-12 mb-12 seetickets-list-event-container mdc-card grid-item">
    <div class="event-info-block">
      <p class="fs-18 bold mb-12 title"><a href="https://wl.seetickets.us/event/${title.toLowerCase().replace(/[^a-z]+/g, '-')}/697455?afflky=X">${title}</a></p>
      <p class="fs-18 bold mt-1r date">${date}</p>
      <p class="fs-12 supporting-talent"></p>
      <p class="fs-12 doortime-showtime">Doors: <span id="see-list-doortime-1" class="see-doortime">7:30PM</span><span class="see-times-divider"> / </span>Show: <span id="see-list-showtime-1" class="see-showtime">${show}</span></p>
      <p class="fs-12 genre">${genre}</p>
      <p class="fs-12 price">${price}</p>
    </div>
  </div>`;
ok('seetickets: genre filter keeps jazz, drops the rest; year inferred', () => {
  const html = seeTicketsCard({ title: 'Bitchin Bajas', date: 'Thu Jul 16', genre: 'Jazz', price: '$30.00' })
    + seeTicketsCard({ title: 'Swooper Creek', date: 'Fri Jul 17', genre: 'Indie' })
    + seeTicketsCard({ title: 'Ward Quintet', date: 'Sun Jul 19', genre: 'Jazz', show: '9:00PM' });
  const today = new Date(2026, 6, 13);
  const con = conParse(html, today);
  assert.equal(con.length, 2);
  assert.equal(con[0].clubId, 'constellation');
  assert.equal(con[0].date, '2026-07-16');
  assert.deepEqual(con[0].sets, ['20:00']); // show time, not doors
  assert.equal(con[0].priceText, '$30.00');
  assert.match(con[0].url, /wl\.seetickets\.us\/event\/bitchin-bajas/);
  const hb = hbParse(html, today);
  assert.equal(hb[1].clubId, 'hungrybrain');
  assert.deepEqual(hb[1].sets, ['21:00']);
});

// --- Elastic Arts (Squarespace, improvised-music filter) --------------------------
import { parse as eaParse } from './clubs/elasticarts.js';
ok('elasticarts: keeps IMS + jazz, drops Elastro/film/etc', () => {
  const fixture = JSON.stringify({ upcoming: [
    { title: 'Improvised Music Series: Avreeayl Ra', startDate: 1785463200000, // 9pm CDT Jul 30
      fullUrl: '/events/ims-7-30-26', tags: ['improvised music series'],
      excerpt: 'Avreeayl Ra (drums), Jim Baker (piano)' },
    { title: 'Elastro: Cate Kennan, Infrathin', startDate: 1785463200000, fullUrl: '/events/elastro', tags: [], excerpt: '' },
    { title: 'Night School w/ Hyperdelia', startDate: 1785463200000, fullUrl: '/events/night-school', tags: [], excerpt: '' },
  ] });
  const evs = eaParse(fixture);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'Improvised Music Series: Avreeayl Ra');
  assert.equal(evs[0].date, '2026-07-30');
  assert.deepEqual(evs[0].sets, ['21:00']);
});

// --- Winter's (Wix warmup-data) ----------------------------------------------------
import { parse as wjParse } from './clubs/winters.js';
ok('winters: warmup-data events -> Chicago-local dates', () => {
  const warmup = { appsWarmupData: { deep: { events: [
    { title: 'Bryan Eng Trio', slug: 'bryan-eng-trio-4',
      scheduling: { config: { startDate: '2026-07-16T00:30:00.000Z', timeZoneId: 'America/Chicago' } },
      description: 'Bryan Eng - piano Sam Weber - bass Kyle Poole - drums' },
  ] } } };
  const html = `<html><script type="application/json" id="wix-warmup-data">${JSON.stringify(warmup)}</script></html>`;
  const evs = wjParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-15'); // 00:30Z = 7:30pm CT the previous day
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.match(evs[0].url, /wintersjazzclub\.com\/events\/bryan-eng-trio-4/);
  assert.equal(evs[0].personnel.length, 3);
});

// --- Andy's (Modern Events Calendar) -----------------------------------------------
import { parse as anParse } from './clubs/andys.js';
const mecArticle = (title, occ, time) => `
  <article class="mec-event-article ">
    <div class="mec-event-time mec-color"><i class="mec-sl-clock-o"></i> ${time}</div>
    <h4 class="mec-event-title"><a class="mec-color-hover" href="https://andysjazzclub.com/events/${title.toLowerCase().replace(/[^a-z]+/g, '-')}/?occurrence=${occ}&amp;time=1751986800">${title}</a></h4>
  </article>`;
ok("andys: 1st/2nd set merge into one event; late night stays separate", () => {
  const html = mecArticle('1st Set With Andy Brown Quartet', '2026-07-18', '6:00 pm - 7:15 pm')
    + mecArticle('2nd Set With Andy Brown Quartet', '2026-07-18', '8:15 pm - 9:30 pm')
    + mecArticle('Late Night Concert Series w/Chris Madsen', '2026-07-18', '10:30 pm - 11:45 pm')
    + mecArticle('1st Set With Andy Brown Quartet', '2026-07-18', '6:00 pm - 7:15 pm'); // dupe grid cell
  const evs = anParse(html);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Andy Brown Quartet');
  assert.deepEqual(evs[0].sets, ['18:00', '20:15']);
  assert.equal(evs[0].date, '2026-07-18');
  assert.match(evs[0].url, /occurrence=2026-07-18/);
  assert.equal(evs[1].title, 'Late Night Concert Series w/Chris Madsen');
  assert.deepEqual(evs[1].sets, ['22:30']);
});

// --- Dorian's (WP events list) ------------------------------------------------------
import { parse as doParse } from './clubs/dorians.js';
ok("dorians: date + set times from description, DJ nights filtered", () => {
  const html = `
  <div class="events-list"><div class="column"><div class="post">
    <a href="https://throughtherecordshop.com/events/rene-avilas-afrocuban-band/"><div class="poster-overlay"></div></a>
    <div class="details"><a href="https://throughtherecordshop.com/events/rene-avilas-afrocuban-band/">
      <h3 class="date-time"> July 10, 2026 </h3>
      <h2 class="title">Rene Avila&#8217;s Afro~Cuban~ Band</h2></a>
      <div class="description"> Dorian&#8217;s Presents Rene Avila&#8217;s Afro~Cuban~ Band Live at 9PM &amp; 11PM Happy Hours 6-8pm Nightly No reservations ~ 6pm &#8211; 2am 21+ ~ Vax Required $10... </div>
    </div>
  </div></div>
  <div class="column"><div class="post">
    <a href="https://throughtherecordshop.com/events/sound-obsession/"><div class="poster-overlay"></div></a>
    <div class="details"><a href="https://throughtherecordshop.com/events/sound-obsession/">
      <h3 class="date-time"> July 12, 2026 </h3>
      <h2 class="title">Sound Obsession w/ DJ Zipgun Boogie</h2></a>
      <div class="description"> vinyl all night </div>
    </div>
  </div></div></div>`;
  const evs = doParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, "Rene Avila’s Afro~Cuban~ Band");
  assert.equal(evs[0].date, '2026-07-10');
  assert.deepEqual(evs[0].sets, ['21:00', '23:00']);
  assert.equal(evs[0].priceText, '$10');
  assert.match(evs[0].url, /throughtherecordshop\.com\/events\/rene-avilas/);
});

// --- SPACE, Evanston (Ticketmaster Discovery feed) ---------------------------------
import { parse as spcParse } from './clubs/space.js';
ok('space: jazz genre only, SPACE venue only, local times pass through', () => {
  const fixture = JSON.stringify({ _embedded: { events: [
    { name: 'Davina and the Vagabonds', url: 'https://www.ticketweb.com/event/davina/1',
      dates: { start: { localDate: '2026-07-24', localTime: '20:00:00' }, timezone: 'America/Chicago' },
      classifications: [{ segment: { name: 'Music' }, genre: { name: 'Jazz' } }],
      priceRanges: [{ min: 25.5, max: 25.5 }],
      _embedded: { venues: [{ name: 'SPACE' }] } },
    { name: 'SOLD OUT - Late Show: Davina and the Vagabonds', url: 'https://www.ticketweb.com/event/davina/2',
      dates: { start: { localDate: '2026-07-24', localTime: '22:30:00' } },
      classifications: [{ genre: { name: 'Jazz' } }],
      _embedded: { venues: [{ name: 'SPACE' }] } },
    { name: 'Peach Jam: Allman Brothers Tribute', url: 'https://www.ticketweb.com/event/peach/3',
      dates: { start: { localDate: '2026-07-25', localTime: '20:00:00' } },
      classifications: [{ genre: { name: 'Rock' } }],
      _embedded: { venues: [{ name: 'SPACE' }] } },
    { name: 'Jazz at Cahn', url: 'https://www.ticketmaster.com/x',
      dates: { start: { localDate: '2026-07-26', localTime: '19:30:00' } },
      classifications: [{ genre: { name: 'Jazz' } }],
      _embedded: { venues: [{ name: 'Cahn Auditorium' }] } },
  ] } });
  const evs = spcParse(fixture);
  assert.equal(evs.length, 2, 'rock + Cahn filtered out');
  assert.equal(evs[0].title, 'Davina and the Vagabonds');
  assert.equal(evs[0].date, '2026-07-24');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[0].priceText, '$26');
  assert.match(evs[0].url, /ticketweb\.com\/event\/davina/);
  assert.equal(evs[1].title, 'Late Show: Davina and the Vagabonds');
  assert.equal(evs[1].details, 'Sold out');
  assert.deepEqual(evs[1].sets, ['22:30']); // before the 11pm late-tag line
});

// ============================================================ San Francisco ======

// --- SFJAZZ (ace-api) ---------------------------------------------------------------
import { parse as sfjParse } from './clubs/sfjazz.js';
ok('sfjazz: groups sets, keeps Shows + Fridays Live, drops classes and streams', () => {
  const fixture = JSON.stringify([
    { name: 'Wynton Marsalis Septet', eventDate: '2026-07-15T18:00:00-07:00',
      location: 'Miner Auditorium', eventTypes: ['Shows'],
      viewDetailCtaUrl: '/tickets/productions/summer-2026/wynton-marsalis-septet/' },
    { name: 'Wynton Marsalis Septet', eventDate: '2026-07-15T20:30:00-07:00',
      location: 'Miner Auditorium', eventTypes: ['Shows'],
      viewDetailCtaUrl: '/tickets/productions/summer-2026/wynton-marsalis-septet/' },
    { name: 'Songwriter Production Intensive', eventDate: '2026-07-15T10:30:00-07:00',
      location: 'Joe Henderson Lab', eventTypes: ['Education', 'Classes & Workshops'] },
    { name: 'Wynton Marsalis Septet', eventDate: '2026-07-24T19:30:00',
      location: 'SFJAZZ At Home', eventTypes: ['Shows'] },
    { name: 'Fridays Live: Tiffany Austin', eventDate: '2026-07-17T18:30:00-07:00',
      location: 'Joe Henderson Lab', eventTypes: ['Fridays Live'] },
  ]);
  const evs = sfjParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Wynton Marsalis Septet');
  assert.deepEqual(evs[0].sets, ['18:00', '20:30']); // two shows merged
  assert.equal(evs[0].details, 'Miner Auditorium');
  assert.match(evs[0].url, /sfjazz\.org\/tickets\/productions/);
  assert.equal(evs[1].title, 'Fridays Live: Tiffany Austin');
});

// --- Black Cat (Turntable, shared with Smoke) ----------------------------------------
import { parse as bcParse } from './clubs/blackcat.js';
ok('blackcat: turntable perfs group into sets; price array -> range', () => {
  const fixture = JSON.stringify([
    { datetime: '2026-07-17T02:00:00Z', show_id: 11918,
      show: { id: 11918, name: "Sami Stevens' Homecoming", price_per_person: ['14.50', '44.50'] } },
    { datetime: '2026-07-17T04:30:00Z', show_id: 11918,
      show: { id: 11918, name: "Sami Stevens' Homecoming", price_per_person: ['14.50', '44.50'] } },
  ]);
  const evs = bcParse(fixture);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-16'); // 02:00Z = 7pm PT the previous day
  assert.deepEqual(evs[0].sets, ['19:00', '21:30']);
  assert.equal(evs[0].priceText, '$15-45');
  assert.match(evs[0].url, /blackcatsf\.turntabletickets\.com\/shows\/11918\/\?date=2026-07-16/);
});

// --- Keys Jazz Bistro (simple-events, shared with The Pocket) -------------------------
import { parse as ksParse } from './clubs/keys.js';
ok('keys: simple-events grid parses with keys clubId', () => {
  const html = `
  <div id="simple-events-calendar-day-2026-07-18" class="day-cell">
    <article class="calendar-event"><time datetime="19:00">7:00 pm</time>
      <h3 class="calendar-event-title"><a href="https://keysjazzbistro.com/event/kenny-washington-quartet-9/?se-date=99">Kenny Washington Quartet</a></h3></article>
    <article class="calendar-event"><time datetime="21:00">9:00 pm</time>
      <h3 class="calendar-event-title"><a href="https://keysjazzbistro.com/event/kenny-washington-quartet-9/?se-date=99">Kenny Washington Quartet</a></h3></article>
  </div>`;
  const evs = ksParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].clubId, 'keys');
  assert.deepEqual(evs[0].sets, ['19:00', '21:00']);
  assert.match(evs[0].url, /keysjazzbistro\.com\/event\/kenny-washington/);
});

// --- Mr. Tipple's (tribe REST) ---------------------------------------------------------
import { parse as tippParse } from './clubs/mrtipples.js';
ok('mrtipples: tribe events -> local dates, cost normalized', () => {
  const fixture = JSON.stringify({ events: [
    { title: 'Bob Kenmotsu Quartet', start_date: '2026-07-15 19:00:00',
      url: 'https://mrtipplessf.com/calendar/ben-kenmotsu-quartet/', cost: '$15 – $30',
      description: '<p>Bob Kenmotsu - tenor Jeff Chambers - bass Leon Joyce - drums</p>' },
    { title: 'no date' },
  ] });
  const evs = tippParse(fixture);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['19:00']);
  assert.equal(evs[0].priceText, '$15-$30');
  assert.equal(evs[0].personnel.length, 3);
});

// --- Bird & Beckett (Friday generator) --------------------------------------------------
import { parse as bbParse } from './clubs/birdbeckett.js';
ok('birdbeckett: generator emits 8 Fridays at 7:30pm', () => {
  const evs = bbParse(TODAY); // Mon Jul 13 2026
  assert.equal(evs.length, 8);
  assert.equal(evs[0].date, '2026-07-17'); // first Friday after Mon Jul 13
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.ok(evs.every((e) => new Date(e.date + 'T12:00:00').getDay() === 5));
});

// --- Yoshi's (homegrown calendar) --------------------------------------------------------
import { parse as ysParse } from './clubs/yoshis.js';
ok("yoshis: served-HTML anchors parse; Buy/plain variants dedupe; sets merge; price kept", () => {
  // modeled on the RAW server response (not the JS-rebuilt event-indv list):
  // each show has an image link ("Buy Tickets", <a with newline before attrs)
  // and a button ("Tickets", href first) followed by p.price.
  const html = `
  <li><div class="event-cell eimage"><a
aria-label="Buy Tickets NZURI SOUL: A TRIBUTE TO THE MEN OF R&amp;B July 15, 2026 - 8:00 PM" href="https://yoshis.com/events/buy-tickets/nzuri-soul-a-tribute-to-the-men-of-r-b/detail"><img /></a></div>
    <div class="event-cell etix"><a href="https://yoshis.com/events/buy-tickets/nzuri-soul-a-tribute-to-the-men-of-r-b/detail" aria-label="Tickets NZURI SOUL: A TRIBUTE TO THE MEN OF R&amp;B July 15, 2026 - 8:00 PM" class="btn" target="_blank">Tickets</a><p class="price">$29 - $59</p></div></li>
  <li><div class="event-cell etix"><a href="https://yoshis.com/events/buy-tickets/nzuri-soul-a-tribute-to-the-men-of-r-b/detail" aria-label="Tickets NZURI SOUL: A TRIBUTE TO THE MEN OF R&amp;B July 15, 2026 - 10:00PM" class="btn" target="_blank">Tickets</a><p class="price">$29 - $59</p></div></li>`;
  const evs = ysParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'NZURI SOUL: A TRIBUTE TO THE MEN OF R&B');
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:00', '22:00']);
  assert.equal(evs[0].priceText, '$29 - $59');
  assert.match(evs[0].url, /yoshis\.com\/events\/buy-tickets\/nzuri-soul/);
});

// --- Smalls personnel reuse (2026-07-16: Mark Turner invisibility fix) -------------
import { reusePersonnel } from './clubs/smalls.js';
ok('smalls: previous crawl personnel copied onto matching ids (no refetch)', () => {
  const prev = [
    { id: 'smalls:2026-08-02:kurt-rosenwinkel-next-step-band', clubId: 'smalls',
      date: '2026-08-02', sets: ['19:30'],
      personnel: [
        { name: 'Kurt Rosenwinkel', instrument: 'guitar' },
        { name: 'Mark Turner', instrument: 'tenor saxophone' },
      ] },
    { id: 'smalls:2026-08-03:other', clubId: 'smalls', date: '2026-08-03', sets: [], personnel: null },
  ];
  const fresh = [
    { id: 'smalls:2026-08-02:kurt-rosenwinkel-next-step-band', clubId: 'smalls',
      date: '2026-08-02', sets: ['19:30'], personnel: null,
      url: 'https://www.smallslive.com/events/33464-kurt-rosenwinkel-next-step-band/' },
    { id: 'smalls:2026-08-03:other', clubId: 'smalls', date: '2026-08-03', sets: [], personnel: null, url: 'x' },
  ];
  const out = reusePersonnel(fresh, prev);
  assert.equal(out[0].personnel?.length, 2, 'personnel must be copied from previous crawl');
  assert.equal(out[0].personnel[1].name, 'Mark Turner');
  assert.equal(out[1].personnel, null, 'events never enriched stay null (fetched later)');
});

// --- Freight & Salvage (genre-tagged cards) -------------------------------------------
import { parse as frParse } from './clubs/freight.js';
ok('freight: jazz-family genres kept, roots dropped; date ordinals parse', () => {
  const card = ({ genre, title, date, show = '8:00 PM', support = '' }) => `
  <article class="list-view-item card">
    <div class="genre-box"><div class="genre">${genre}</div></div>
    <section class="list-view-details"><article class="artist-info">
      <h2 class="event-name"><a href="https://secure.thefreight.org/15887/15888">${title}</a></h2>
      <h3 class="supports">${support}</h3>
      <article class="date-age"><section class="date-time">
        <span class="dates">${date}</span>
        <section class="times"><span class="start">Doors: 7:00 PM / Show: ${show}</span></section>
      </section></article>
    </article></section>
    <section class="ticket-price"><a>GET TICKETS</a> $39/$44 (INCLUDES ALL FEES)</section>
  </article>`;
  const html = card({ genre: 'LATIN JAZZ', title: 'John Santos Sextet', date: 'Wednesday, Jul 15th 2026', support: 'La Mixta Criolla' })
    + card({ genre: 'ROOTS', title: 'Dave Alvin', date: 'Saturday, Jul 18th 2026' })
    + card({ genre: 'JAZZ / NEO-SOUL', title: 'Butcher Brown', date: 'Friday, Jul 31st 2026', show: '9:00 PM' });
  const evs = frParse(html);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'John Santos Sextet');
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[0].details, 'with La Mixta Criolla');
  assert.equal(evs[0].priceText, '$39/$44');
  assert.match(evs[0].url, /secure\.thefreight\.org/);
  assert.equal(evs[1].date, '2026-07-31');
  assert.deepEqual(evs[1].sets, ['21:00']);
});

// ============================================================== Paris ======

// --- Duc des Lombards (Drupal agenda) ------------------------------------------------
import { parse as ducParse } from './clubs/ducdeslombards.js';
ok('duc: multi-night card -> one event per night with both sets; French months', () => {
  const art = `
  <article class="col-xs-12 mosaique-evt-item-container module-item">
    <a href="/fr/l-agenda/amina-figarova-sextet" class="mosaique-evt-item evenement" aria-label="Amina Figarova Sextet">
      <div class="mosaique-evt-ruban etiquette-">Piano Master</div>
      <div class="mosaique-evt-date">
        <!-- $event : 'annule','reporte','termine' - $places : 'complet' -->
        <div class="mosaique-evt-date-header h4"><div class="evt-date-jour">mer.</div><div>15 juil.</div></div>
        <div class="mosaique-evt-date-heure"><div class="evt-date-heure">19H30</div></div>
        <div class="mosaique-evt-date-heure"><div class="evt-date-heure">22H00</div></div>
      </div>
      <div class="mosaique-evt-date">
        <div class="mosaique-evt-date-header h4"><div class="evt-date-jour">jeu.</div><div>16 juil.</div></div>
        <div class="mosaique-evt-date-heure"><div class="evt-date-heure">19H30</div></div>
      </div>
    </a>
  </article>`;
  const evs = ducParse(art, new Date(2026, 6, 13));
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Amina Figarova Sextet');
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['19:30', '22:00']);
  assert.equal(evs[0].details, 'Piano Master');
  assert.match(evs[0].url, /ducdeslombards\.com\/fr\/l-agenda\/amina/);
  assert.equal(evs[1].date, '2026-07-16');
  assert.deepEqual(evs[1].sets, ['19:30']);
});

// --- Sunset / Sunside (shared tribe REST, venue routing) ------------------------------
import { parse as ssParse } from './clubs/sunsetsunside.js';
ok('sunsetsunside: venue field routes to the right room; unknown venues skipped', () => {
  const fixture = JSON.stringify({ events: [
    { title: 'Lila-May', start_date: '2026-07-16 19:30:00',
      url: 'https://www.sunset-sunside.com/concert/lila-may/', venue: { venue: 'Sunset' } },
    { title: 'Marc Copland Trio', start_date: '2026-07-16 21:00:00',
      url: 'https://www.sunset-sunside.com/concert/marc-copland-trio/', venue: { venue: 'Sunside' }, cost: '25 – 30€' },
    { title: 'Private event', start_date: '2026-07-17 19:00:00', venue: { venue: 'Autre salle' } },
  ] });
  const evs = ssParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].clubId, 'sunset');
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.equal(evs[1].clubId, 'sunside');
  assert.equal(evs[1].priceText, '25-30€');
});

// --- New Morning (JSON-LD agenda) ------------------------------------------------------
import { parse as nmParse } from './clubs/newmorning.js';
ok('newmorning: JSON-LD events parsed, T00:00:00 means no set times, dupes collapse', () => {
  const ld = JSON.stringify([
    { '@context': 'http://schema.org', '@type': 'Event', name: 'Immanuel Wilkins Quartet',
      startDate: '2026-07-20T00:00:00', url: 'https://www.newmorning.com/N-7717-45-ans-du-new-immanuel-wilkins-quartet.html' },
    { '@context': 'http://schema.org', '@type': 'Event', name: 'Immanuel Wilkins Quartet',
      startDate: '2026-07-20T00:00:00', url: 'https://www.newmorning.com/N-7717-45-ans-du-new-immanuel-wilkins-quartet.html' },
    { '@context': 'http://schema.org', '@type': 'WebSite', url: 'https://www.newmorning.com' },
  ]);
  const html = `<html><script type="application/ld+json">${ld}</script></html>`;
  const evs = nmParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'Immanuel Wilkins Quartet');
  assert.equal(evs[0].date, '2026-07-20');
  assert.deepEqual(evs[0].sets, []);
  assert.match(evs[0].url, /N-7717/);
});

ok('newmorning: EventVenue node must not satisfy the strict path (73-show regression)', () => {
  // real page shape: a parseable EventVenue block + a MALFORMED event array.
  // the loose /event/i type test matched EventVenue, "succeeded" with zero
  // events, and starved the lenient fallback.
  const html = `<script type="application/ld+json">{"@context":"http://schema.org","@type":"EventVenue","name":"New Morning","url":"https://www.newmorning.com"}</script>
  <script type="application/ld+json">[
    { "@context":"http://schema.org", "@type":"Event",
      "name":"The Bad Plus",
      "startDate":"2026-07-16T00:00:00",
      "url":"https://www.newmorning.com/20260716-7701-45-ans-du-new-the-bad-plus.html",
      "location":{ "@type":"Place", "name":"New Morning" } },
    { "broken": }
  ]</script>`;
  const evs = nmParse(html);
  assert.equal(evs.length, 1, 'lenient fallback must fire despite the EventVenue node');
  assert.equal(evs[0].title, 'The Bad Plus');
  assert.equal(evs[0].date, '2026-07-16');
});

ok('newmorning: malformed JSON-LD (their reality) falls back to lenient extraction', () => {
  // an unescaped control character poisons strict JSON.parse of the array
  const broken = `<script type="application/ld+json">[
    { "@context":"http://schema.org", "@type":"Event",
      "name":"Kenny Garrett",
      "startDate":"2026-07-22T00:00:00", "endDate":"2026-07-22T23:30:00",
      "description":"bad
newline",
      "url":"https://www.newmorning.com/N-7711-45-ans-du-new-kenny-garrett.html",
      "location":{ "@type":"Place", "name":"New Morning" } },
    { "@context":"http://schema.org", "@type":"Event",
      "name":"Brad Mehldau \u2013 Solo",
      "startDate":"2026-07-23T00:00:00",
      "url":"https://www.newmorning.com/N-7712-brad-mehldau.html",
      "location":{ "@type":"Place", "name":"New Morning" } }
  ]</script>`;
  const evs = nmParse(broken);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Kenny Garrett');
  assert.equal(evs[0].date, '2026-07-22');
  assert.match(evs[0].url, /N-7711/);
  assert.equal(evs[1].title, 'Brad Mehldau – Solo'); // \u2013 unescaped
});

// --- Caveau de la Huchette (French prose dates) ----------------------------------------
import { expandLine, parseMonthPage } from './clubs/caveau.js';
ok('caveau: singles, pairs, and ranges expand; nightly 21h30', () => {
  assert.deepEqual(expandLine('Lundi 6 juillet : Blues Monday').entries, [{ day: 6, title: 'Blues Monday' }]);
  assert.equal(expandLine('Jeudi 16 et vendredi 17 juillet : Sebastian Ellis Band').entries.length, 2);
  assert.deepEqual(expandLine('Du jeudi 9 au samedi 11 juillet : Danger Zone').entries.map((e) => e.day), [9, 10, 11]);
  const html = `<html><body><h1>Concerts juillet 2026</h1>
    <p>Lundi 6 juillet : Blues Monday</p>
    <p>Du dimanche 12 au mercredi 15 juillet : Harlem Swing Orchestra</p>
  </body></html>`;
  const evs = parseMonthPage(html, 'https://www.caveaudelahuchette.fr/1/concerts_juillet_2026_1483430.html');
  assert.equal(evs.length, 5);
  assert.equal(evs[0].date, '2026-07-06');
  assert.deepEqual(evs[0].sets, ['21:30']);
  assert.equal(evs[4].date, '2026-07-15');
  assert.equal(evs[4].title, 'Harlem Swing Orchestra');
});

// --- Bal Blomet (Eventer, jazz-filtered URL) --------------------------------------------
import { parse as bbmParse } from './clubs/balblomet.js';
ok('balblomet: edate link carries the date; time from the visible text', () => {
  const html = `
  <li class="eventer-event-item eventer-p2-event-list-item">
    <h4 class="eventer-event-title"><a href="https://www.balblomet.fr/evenement/paul-lay-et-baptiste-herbin/edate/2026-09-11" class="eventer-event-item-link"><span class="eventer-event-title">PAUL LAY &amp; BAPTISTE HERBIN – TEA FOR TWO</span></a></h4>
    <div class="eventer-list-meta">11-09-2026 20:00 vendredi, 20:00 à 21:30</div>
  </li>`;
  const evs = bbmParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'PAUL LAY & BAPTISTE HERBIN – TEA FOR TWO');
  assert.equal(evs[0].date, '2026-09-11');
  assert.deepEqual(evs[0].sets, ['20:00']);
});

// --- 38 Riv (listing + detail set times + reuse) -------------------------------------------
import { parse as rivParse, parseDetailSets } from './clubs/riv38.js';
ok('riv38: listing gives dates; detail pages give per-date set times', () => {
  const listing = `
  <div class="views-row"><article class="_container agenda-item-container">
    <a href="/concerts/sarah-king-trio" aria-label="Sarah King trio" class="agenda-item group">
      <span>VENDREDI</span> <span>VEN.</span> <span>17/</span> <span>JUILLET</span> <span>07/</span> <span>2026</span>
      <h3>SARAH KING TRIO</h3>
    </a>
  </article></div>`;
  const evs = rivParse(listing);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'Sarah King trio');
  assert.equal(evs[0].date, '2026-07-17');
  assert.match(evs[0].url, /38riv\.com\/concerts\/sarah-king-trio/);
  const detail = '<div>VEN. 17 /07 /2026 19:30</div><div>VEN. 17 /07 /2026 21:30</div><div>SAM. 18 /07 /2026 19:30</div>';
  const byDate = parseDetailSets(detail);
  assert.deepEqual(byDate.get('2026-07-17'), ['19:30', '21:30']);
  assert.deepEqual(byDate.get('2026-07-18'), ['19:30']);
});

// --- SFJAZZ seed fallback (Cloudflare workaround, 2026-07-16) -------------------------
import { SEED as sfjSeed } from './clubs/sfjazz-seed.js';
ok('sfjazz seed: valid shape, groups into set-merged events via the normal parser', () => {
  assert.ok(sfjSeed.length >= 40, `seed thin: ${sfjSeed.length}`);
  assert.ok(sfjSeed.every((e) => e.name && /^\d{4}-\d{2}-\d{2}T/.test(e.eventDate) && e.eventTypes));
  const evs = sfjParse(JSON.stringify(sfjSeed));
  assert.ok(evs.length >= 25, `grouped events thin: ${evs.length}`);
  const cornish = evs.filter((e) => /paul cornish/i.test(e.title));
  assert.equal(cornish.length, 2, 'Paul Cornish Trio: two nights');
  assert.deepEqual(cornish[0].sets, ['19:00', '20:30'], 'two sets merged per night');
  assert.equal(cornish[0].details, 'Joe Henderson Lab');
});

// --- Duc detail rosters (French instruments, 2026-07-16) ------------------------------
import { parseDetailPersonnel } from './clubs/ducdeslombards.js';
ok('duc: detail-page roster parses with French instrument names', () => {
  const html = `<div class="content"><h1>Amina Figarova Sextet</h1>
    <p>Amina Figarova - Piano<br>Yasek Manzano - Trompette<br>Rick Margitza - Sax ténor<br>
    Bart Platteau - Flûtes<br>Maurizio Congiu - Contrebasse<br>Ferenc Nemeth - Batterie</p>
    <p>Réservez vite - les places partent.</p></div>`;
  const p = parseDetailPersonnel(html);
  assert.equal(p.length, 6, `expected 6 players, got ${p.length}`);
  assert.deepEqual(p[0], { name: 'Amina Figarova', instrument: 'piano' });
  assert.deepEqual(p[2], { name: 'Rick Margitza', instrument: 'sax ténor' });
  assert.deepEqual(p[5], { name: 'Ferenc Nemeth', instrument: 'batterie' });
  // the prose line with a dash must NOT become a fake player
  assert.ok(!p.some((x) => /réservez/i.test(x.name)));
});

// ============================================================== London ======

// --- Vortex (ICS feed) ----------------------------------------------------------------
import { parse as vxParse } from './clubs/vortex.js';
ok('vortex: ICS events parse with UTC->London conversion and unescaping', () => {
  const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT',
    'DTSTART:20260801T183000Z',
    'SUMMARY:Sylvie Courvoisier \\& Mary Halvorson',
    'URL:https://www.vortexjazz.co.uk/event/courvoisier-halvorson/',
    'DESCRIPTION:Piano and guitar duo\\, first London date since 2024.',
    'END:VEVENT', 'BEGIN:VEVENT',
    'DTSTART;TZID=Europe/London:20260802T200000',
    'SUMMARY:Evan Parker Trio',
    'URL:https://www.vortexjazz.co.uk/event/evan-parker/',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const evs = vxParse(ics);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Sylvie Courvoisier & Mary Halvorson');
  assert.equal(evs[0].date, '2026-08-01');
  assert.deepEqual(evs[0].sets, ['19:30']); // 18:30Z = 19:30 BST
  assert.match(evs[0].details, /first London date/);
  assert.equal(evs[1].date, '2026-08-02');
  assert.deepEqual(evs[1].sets, ['20:00']); // TZID datetimes pass through
});

// --- Ronnie Scott's (listing + doors enrichment) ----------------------------------------
import { parse as rsParse, parseDetailTimes } from './clubs/ronnies.js';
ok("ronnies: main room kept, non-jazz Upstairs filtered; doors times from detail", () => {
  const card = ({ room, title, date, desc }) => `
  <article class="listing">
    <div class="listing__image-container"><img><div class="listing__show-type">${room}</div></div>
    <div>${date}</div>
    <h2 class="listing__title">${title}</h2>
    <p class="listing__description">${desc}</p>
    <button data-show-event-url="https://www.ronniescotts.co.uk/find-a-show/${title.toLowerCase().replace(/[^a-z]+/g, '-')}">Book</button>
  </article>`;
  const html = card({ room: '', title: 'Kurt Elling', date: 'Thu 16 Jul 2026', desc: 'The greatest male jazz vocalist of his generation.' })
    + card({ room: "Upstairs at Ronnie's", title: 'Sharlene Hector', date: 'Thu 16 Jul 2026', desc: 'Top soul and pop vocalist.' })
    + card({ room: "Upstairs at Ronnie's", title: 'Late Night Jazz Jam', date: 'Fri 17 Jul 2026', desc: 'Weekly jazz session.' });
  const evs = rsParse(html);
  assert.equal(evs.length, 2, 'soul upstairs show must be filtered');
  assert.equal(evs[0].title, 'Kurt Elling');
  assert.equal(evs[0].date, '2026-07-16');
  assert.equal(evs[1].title, 'Late Night Jazz Jam'); // jazz-keyword upstairs kept
  const byDate = parseDetailTimes('<p>Upcoming performances</p><p>16 July - Doors at 17:00</p><p>16 July - Doors at 20:15</p>', 2026);
  assert.deepEqual(byDate.get('2026-07-16'), ['17:00', '20:15']);
});

// --- 606 Club (weekly server pages) ------------------------------------------------------
import { parse as sixParse } from './clubs/club606.js';
ok('club606: banner rows parse date, time, and title', () => {
  const html = `
  <div class="box dark"><div class="contained mh">
    <p><a href="/events/view/phil-mulfords-thunderthumbs-23/" class="banner smaller">Mon 13<sup>th</sup> Jul - 8:00pm</a></p>
    <p class="h4">Phil Mulford&#039;s &#039;Thunderthumbs&#039;</p>
  </div></div>
  <div class="box dark"><div class="contained mh">
    <p><a href="/events/view/sunday-lunch-kaw-regis/" class="banner smaller">Sun 19<sup>th</sup> Jul - 1:30pm</a></p>
    <p class="h4">Lunchtime Sunday Lunch: Kaw Regis</p>
  </div></div>`;
  const evs = sixParse(html, new Date(2026, 6, 13));
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, "Phil Mulford's 'Thunderthumbs'");
  assert.equal(evs[0].date, '2026-07-13');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[1].date, '2026-07-19');
  assert.deepEqual(evs[1].sets, ['13:30']);
});

// --- Jazz Cafe (data-genre cards) ---------------------------------------------------------
import { parse as jzcParse } from './clubs/jazzcafe.js';
ok('jazzcafe: jazz genre kept, club nights and soul dropped, line-up to details', () => {
  const li = ({ genre, type, day, mon, host, artist, lineup }) => `
  <li data-genre="${genre}" data-type="${type}" data-event-type="${type}" class="event mix">
    <div class="event-date alt-font">Sat<span>${day}</span>${mon}</div>
    <h2 class="event-title"><span class="host">${host}</span><br>${artist}<br></h2>
    <a href="https://thejazzcafe.com/event/${artist.toLowerCase().replace(/[^a-z]+/g, '-')}/">
    <ul class="line-up list-unstyled">${lineup.map((x) => `<li>${x}</li>`).join('')}</ul></a>
  </li>`;
  const html = '<ul id="events-list">'
    + li({ genre: 'jazz', type: 'Live show', day: 18, mon: 'Jul', host: 'Explosive NYC Saxophonist', artist: 'Immanuel Wilkins Quartet', lineup: ['Immanuel Wilkins Quartet', 'Support TBA'] })
    + li({ genre: 'soul-rnb', type: 'Live show', day: 16, mon: 'Jul', host: "Soul Music's Finest", artist: 'Leon Bridges', lineup: ['Leon Bridges'] })
    + li({ genre: 'jazz', type: 'Club night', day: 19, mon: 'Jul', host: 'Late Session', artist: 'Jazz Dance Party', lineup: ['DJ Someone'] })
    + '</ul>';
  const evs = jzcParse(html, new Date(2026, 6, 13));
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'Immanuel Wilkins Quartet');
  assert.equal(evs[0].date, '2026-07-18');
  assert.match(evs[0].details, /Explosive NYC Saxophonist/);
});

// --- PizzaExpress Live (JSON API, Soho filter) ----------------------------------------------
import { parse as pxParse } from './clubs/pizzaexpresslive.js';
ok('pizzaexpress: real payload shapes — prose dates, pence prices, bare-city locations', () => {
  const fixture = JSON.stringify([
    { name: 'Jazz Up the 80s with the Jay Rayner Sextet', eventDate: 'Thursday 16th July',
      showStartTime: '8:00PM', doorsOpenTime: '6:30PM', price: 3500,
      slug: 'jazz-up-the-80s-with-the-jay-rayner-sextet-5', location: 'Soho' },
    { name: 'Olivia Leisk', eventDate: 'Thursday 16th July', showStartTime: '7:30PM',
      price: 0, slug: 'olivia-leisk', location: 'Leicester Square' },
    { name: 'Late Set', eventDate: 'Friday 1st August', showStartTime: '9:30PM',
      price: 2250, slug: 'late-set', location: 'Soho' },
  ]);
  const evs = pxParse(fixture, new Date(2026, 6, 13));
  assert.equal(evs.length, 2, 'non-Soho rooms filtered');
  assert.equal(evs[0].title, 'Jazz Up the 80s with the Jay Rayner Sextet');
  assert.equal(evs[0].date, '2026-07-16');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[0].priceText, '£35');
  assert.equal(evs[1].date, '2026-08-01'); // ordinal + year inference
  assert.equal(evs[1].priceText, '£22.50'); // pence with remainder
  assert.match(evs[0].url, /pizzaexpresslive\.com\/whats-on\/jazz-up-the-80s/);
});

// --- Cafe OTO (event links + date headers) ---------------------------------------------------
import { parse as coParse } from './clubs/cafeoto.js';
ok('cafeoto: date header near link parses; DJ bar nights skipped', () => {
  const block = (slug, title, dateLine) => `
  <div class="each-activity col-xs-12">
    <div class="each-header"><p>${dateLine}</p></div>
    <div class="each-image"><a href="/events/${slug}/"><img></a></div>
    <div class="each-header"><p><a href="/events/${slug}/">${title}</a></p></div>
  </div>`;
  const html = block('khanah-space21', 'KHANAH — part of SPACE21 festival', 'Friday 17 July 2026, 7.30pm')
    + block('oto-bar-all-night-flight', 'OTO BAR with All Night Flight Records (DJ)', 'Thursday 16 July 2026, 7.30pm');
  const evs = coParse(html);
  assert.equal(evs.length, 1, 'DJ bar night must be skipped');
  assert.match(evs[0].title, /KHANAH/);
  assert.equal(evs[0].date, '2026-07-17');
  assert.deepEqual(evs[0].sets, ['19:30']);
});

// --- DICE genre tags (Frisell regression, 2026-07-16) ---------------------------------
import { parse as zebParse2 } from './clubs/zebulon.js';
ok('dice: genre_tags trusted over keywords — untagged-title jazz kept, tagged non-jazz dropped', () => {
  const fixture = JSON.stringify({ data: [
    { name: 'Bill Frisell & Harmony Five featuring Petra Haden', date: '2026-10-01T03:00:00Z',
      timezone: 'America/Los_Angeles', url: 'https://dice.fm/event/frisell',
      description: 'An evening of harmony.', genre_tags: ['genre:jazz', 'genre:blues'] },
    { name: 'Quartet Night Dance Party', date: '2026-10-02T03:00:00Z',
      timezone: 'America/Los_Angeles', url: 'https://dice.fm/event/dance',
      description: '', genre_tags: ['genre:electronic'] },
    { name: 'Mystery Trio', date: '2026-10-03T03:00:00Z',
      timezone: 'America/Los_Angeles', url: 'https://dice.fm/event/mystery',
      description: 'improvised music all night' },
  ] });
  const evs = zebParse2(fixture);
  assert.equal(evs.length, 2, 'tagged jazz + untagged-keyword-match kept; tagged electronic dropped');
  assert.match(evs[0].title, /Frisell/);
  assert.equal(evs[0].date, '2026-09-30'); // 03:00Z -> previous evening LA, late tag
  assert.match(evs[1].title, /Mystery Trio/);
});

// --- Known-artist safety net (2026-07-16) -----------------------------------------------
import { matchesKnownArtist } from './clubs/_jazzartists.js';
import { parse as mintParse2 } from './clubs/mint.js';
ok('artist net: known names rescue keyword-less titles at keyword-filtered venues', () => {
  assert.ok(matchesKnownArtist('Bill Frisell & Harmony Five'));
  assert.ok(matchesKnownArtist('An Evening with CÉCILE McLORIN SALVANT'));
  assert.ok(!matchesKnownArtist('Taylor Swift Night'));
  const fixture = JSON.stringify([
    { title: 'Jeff Parker', day: '20260801', startTime: '8pm', permalink: 'https://themintla.com/event/jeff-parker/', description: '', fromPrice: '$25' },
    { title: 'Indie Rock Showcase', day: '20260802', startTime: '8pm', permalink: 'https://themintla.com/event/rock/', description: 'four rock bands' },
  ]);
  const evs = mintParse2(fixture);
  assert.equal(evs.length, 1, 'Jeff Parker rescued, rock showcase still dropped');
  assert.equal(evs[0].title, 'Jeff Parker');
});

// --- London seed fallbacks (WAF workarounds, 2026-07-16) --------------------------------
import { SEED as rsSeed } from './clubs/ronnies-seed.js';
import { SEED as jcSeed } from './clubs/jazzcafe-seed.js';
ok('london seeds: valid shapes, sane sizes', () => {
  assert.ok(rsSeed.length >= 50, `ronnies seed thin: ${rsSeed.length}`);
  assert.ok(rsSeed.every((r) => r.length === 4 && /^\d{4}-\d{2}-\d{2}$/.test(r[2]) && 'MULX'.includes(r[3])));
  assert.ok(jcSeed.length >= 40, `jazzcafe seed thin: ${jcSeed.length}`);
  assert.ok(jcSeed.every((e) => e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.url));
  assert.ok(rsSeed.some((r) => /kenny barron/i.test(r[1])), 'sanity: Kenny Barron in the Ronnie’s seed');
  assert.ok(jcSeed.some((e) => /immanuel wilkins/i.test(e.title)), 'sanity: Wilkins in the Jazz Cafe seed');
});

// --- Shared detail enrichment (2026-07-16: "personnel is very important") -------------
import { enrichFromDetailPages } from './clubs/_enrichdetails.js';
import { personnelFromLines } from './lib.js';
ok('enrich: reuses prior crawl by id, fetches only whats missing, never overwrites', async () => {
  const events = [
    { id: 'pocket:2026-07-20:a', date: '2026-07-20', url: 'https://x/a', personnel: null },
    { id: 'pocket:2026-07-21:b', date: '2026-07-21', url: 'https://x/b', personnel: null },
    { id: 'pocket:2026-07-22:c', date: '2026-07-22', url: 'https://x/c',
      personnel: [{ name: 'Already Here', instrument: 'piano' }] },
  ];
  const ctx = { previousEvents: [
    { id: 'pocket:2026-07-20:a', personnel: [{ name: 'From Last Crawl', instrument: 'bass' }] },
  ] };
  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(url);
    return 'Immanuel Wilkins - saxophone\nMicah Thomas - piano\nRyoma Takenaga - bass\nTyshawn Sorey - drums';
  };
  await enrichFromDetailPages(events, ctx, {
    fields: ['personnel'],
    extract: (html) => ({ personnel: personnelFromLines(html) }),
    fetchImpl,
  });
  assert.deepEqual(fetched, ['https://x/b'], 'only the truly-missing event fetches');
  assert.equal(events[0].personnel[0].name, 'From Last Crawl', 'reused from prior crawl');
  assert.equal(events[1].personnel.length, 4, 'fetched roster parsed');
  assert.equal(events[1].personnel[3].name, 'Tyshawn Sorey');
  assert.equal(events[2].personnel[0].name, 'Already Here', 'existing personnel untouched');
});

ok('enrich: urlKey dedupes residency dates into one fetch, result fans back out', async () => {
  const events = [
    { id: 'django:2026-07-17:hazeltine', date: '2026-07-17', personnel: null,
      url: 'https://x/events/david-hazeltine-15/?selected_date=2026-07-17' },
    { id: 'django:2026-07-18:hazeltine', date: '2026-07-18', personnel: null,
      url: 'https://x/events/david-hazeltine-15/?selected_date=2026-07-18' },
  ];
  const fetched = [];
  await enrichFromDetailPages(events, {}, {
    fields: ['personnel'],
    extract: () => ({ personnel: [{ name: 'David Hazeltine', instrument: 'piano' }, { name: 'Pete Van Nostrand', instrument: 'drums' }] }),
    fetchImpl: async (url) => { fetched.push(url); return ''; },
    urlKey: (url) => url.split('?')[0],
  });
  assert.equal(fetched.length, 1, 'one fetch for both nights');
  assert.equal(events[0].personnel[0].name, 'David Hazeltine');
  assert.equal(events[1].personnel[1].name, 'Pete Van Nostrand', 'second night filled from same page');
});

// --- personnelFromLines comma separator (Dizzy's format) ------------------------------
ok('personnelFromLines: comma-separated rosters parse; prose commas stay out', () => {
  const roster = 'Charles McPherson, alto saxophone\nTerell Stafford, trumpet\nRandy Porter, piano\nPeter Washington, bass\nBilly Drummond, drums';
  const got = personnelFromLines(roster);
  assert.equal(got.length, 5);
  assert.deepEqual(got[0], { name: 'Charles McPherson', instrument: 'alto saxophone' });
  // prose with commas must NOT create players
  assert.deepEqual(personnelFromLines('grabbing the respect of jazz legends like Sonny Stitt, and Chet Baker'), []);
  assert.deepEqual(personnelFromLines('Table Seating: $30.00 - $65.00\nBar Seating: $30.00 - $65.00'), []);
  assert.deepEqual(personnelFromLines('FRIDAY, JUL 17, 2026 7:00PM\nOakland, CA'), []);
});

// --- Dizzy's detail extraction (2026-07-16: PERFORMANCE LINEUP recon) ------------------
import { parseDetail as dzDetail } from './clubs/dizzys.js';
ok('dizzys: ticketing page yields lineup + description prose', () => {
  // mirrors ticketing.jazz.org's served markup (Tessitura, tn- classes)
  const html = `<h3 class="sr-only">Description</h3>
  <p class="tn-event-detail__description"></p><p><img src="https://jazz.org/x.jpg"></p>
  <p>An 87th birthday, a jazz legend, and the kind of night Dizzy's was made for. Charles McPherson returns with an evening of fiery bebop.</p>
  <h3 data-preserve-html-node="true">PERFORMANCE LINEUP</h3>
  <p>Charles&nbsp;McPherson, alto saxophone<br> Terell Stafford, trumpet<br> Randy Porter, piano<br> Peter Washington, bass<br> Billy Drummond, drums</p>
  <h3 class="sr-only">Notes</h3><p>Please note that "cover" means one (1) seat.</p>`;
  const d = dzDetail(html);
  assert.equal(d.personnel.length, 5);
  assert.deepEqual(d.personnel[0], { name: 'Charles McPherson', instrument: 'alto saxophone' });
  assert.match(d.details, /87th birthday/);
  assert.doesNotMatch(d.details, /cover/);
});

// --- Django detail extraction (2026-07-16) ---------------------------------------------
import { parseDetail as djDetail } from './clubs/django.js';
ok('django: detail description block yields lineup + bio prose', () => {
  const html = `<div class='event-details__copy'> <p class='event-details__copy--description'> Lineup:<br>
  David Hazeltine - Piano<br> Jon Boutellier - Tenor saxophone<br> Caleb Tobocman - Bass<br> Pete Van Nostrand - Drums<br> <br>
  David Hazeltine is one of the most sought-after pianists on the modern jazz scene. A Milwaukee native.</p></div>`;
  const d = djDetail(html);
  assert.equal(d.personnel.length, 4);
  assert.deepEqual(d.personnel[1], { name: 'Jon Boutellier', instrument: 'tenor saxophone' });
  assert.match(d.details, /sought-after pianists/);
  assert.equal(djDetail('<html><body>no block here</body></html>'), null);
});

// --- 606 detail extraction ---------------------------------------------------------------
import { parseDetail as sixDetail } from './clubs/club606.js';
ok('club606: detail page yields music charge + description', () => {
  const html = `<div><h1>PHIL MULFORD'S 'THUNDERTHUMBS'</h1><p>MONDAY 13TH JULY 2026 - 8:00 PM</p>
  <p>MUSIC CHARGE: £20.00</p><a>BOOK NOW</a>
  <p>Join us to celebrate the great Soul and Funk songs with Thunderthumbs, the 10-piece band led by bassist Phil Mulford.</p>
  <p>BACK TO CALENDAR</p></div>`;
  const d = sixDetail(html);
  assert.equal(d.priceText, '£20.00');
  assert.match(d.details, /10-piece band led by bassist/);
  assert.deepEqual(d.personnel, []);
});
ok('ci red-path check: delete me', () => { throw new Error('deliberately broken'); });
