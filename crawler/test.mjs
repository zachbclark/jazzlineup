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
ok("yoshis: aria-label carries title+date+time; two shows merge into sets", () => {
  const html = `
  <ul class="event-full-list">
  <li class="event-indv"><div class="event-cell edate"><span class="sd"><strong>Wed 7.15</strong></span><br/><span class="tss">8:00 PM</span></div>
    <div class="event-cell eimage"><a aria-label="Buy Tickets NZURI SOUL: A TRIBUTE TO THE MEN OF R&amp;B July 15, 2026 - 8:00 PM" href="https://yoshis.com/events/buy-tickets/nzuri-soul-a-tribute-to-the-men-of-r-b/detail"><img /></a></div></li>
  <li class="event-indv"><div class="event-cell edate"><span class="sd"><strong>Wed 7.15</strong></span><br/><span class="tss">10:00 PM</span></div>
    <div class="event-cell eimage"><a aria-label="Buy Tickets NZURI SOUL: A TRIBUTE TO THE MEN OF R&amp;B July 15, 2026 - 10:00 PM" href="https://yoshis.com/events/buy-tickets/nzuri-soul-a-tribute-to-the-men-of-r-b/detail"><img /></a></div></li>
  </ul>`;
  const evs = ysParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'NZURI SOUL: A TRIBUTE TO THE MEN OF R&B');
  assert.equal(evs[0].date, '2026-07-15');
  assert.deepEqual(evs[0].sets, ['20:00', '22:00']);
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
