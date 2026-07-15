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
  ]});
  const evs = bxParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'Jam Session. House Band Set');
  assert.equal(evs[0].date, '2026-07-14');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.match(evs[0].details, /Miki Yamanaka/);
  assert.match(evs[0].url, /barbayeux\.com\/jazz\/8ajbd79-abc/);
  assert.equal(evs[1].title, 'Marta Sanchez Trio');
  assert.deepEqual(evs[1].sets, ['21:00']);
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
