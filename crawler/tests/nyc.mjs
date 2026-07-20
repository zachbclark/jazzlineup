// NYC venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';
import { parse as jgParse } from '../clubs/jazzgallery.js';
import { parsePage as smParse, parseEventPersonnel as smParseEventPersonnel } from '../clubs/smalls.js';
import { parse as vvParse } from '../clubs/vanguard.js';
import { parsePage as blParse } from '../clubs/birdland.js';
import { parse as dzParse, parseDateRange } from '../clubs/dizzys.js';
import { parseMonth as bnParse } from '../clubs/bluenote.js';

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

// --- Smoke ---------------------------------------------------------------------
import { parse as smokeParse } from '../clubs/smoke.js';
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
import { parse as nubluParse } from '../clubs/nublu.js';
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
import { parse as luParse } from '../clubs/lunatico.js';
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
import { parse as barbesParse } from '../clubs/barbes.js';
import { parse as closeupParse } from '../clubs/closeup.js';
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
import { parse as djParse } from '../clubs/django.js';
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
import { parse as cdParse } from '../clubs/cellardog.js';
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
import { parse as atParse } from '../clubs/arthurs.js';
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
import { parse as zbParse } from '../clubs/zincbar.js';
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
import { parse as pkParse } from '../clubs/pocket.js';
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
import { parsePage as orParse, parseAbbrevLine } from '../clubs/ornithology.js';
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
import { parse as bxParse, namesFrom as bxNames } from '../clubs/barbayeux.js';
ok('barbayeux: day/time prefix stripped, dash roster becomes names-only personnel', () => {
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
  assert.deepEqual(evs[0].personnel, [
    { name: 'Miki Yamanaka', instrument: '' },
    { name: 'Matt Dwonszyk', instrument: '' },
    { name: 'Diego Voglino', instrument: '' },
  ], 'dash roster promoted from details to personnel');
  assert.match(evs[0].url, /barbayeux\.com\/jazz\/8ajbd79-abc/);
  assert.equal(evs[1].title, 'Marta Sanchez Trio');
  assert.equal(evs[1].personnel, null);
  assert.deepEqual(evs[1].sets, ['21:00']);
  assert.equal(evs[2].title, 'Morgan Guerin');
  assert.deepEqual(evs[2].sets, ['20:00', '21:30']); // both sets, mined from the title
});

ok('barbayeux: w/ sidemen tails become personnel; billing words reject the run', () => {
  const fixture = JSON.stringify({ upcoming: [
    { title: 'Steve Cardenas w/Adam Kolker, Jeremy Stratton, George Schuller',
      startDate: new Date('2026-07-21T20:00:00-04:00').getTime(), fullUrl: '/jazz/sc' },
    { title: 'Kazemde George w/Tyrone Allen II and Kayvon Gordon',
      startDate: new Date('2026-07-22T20:00:00-04:00').getTime(), fullUrl: '/jazz/kg' },
    // a w/ tail that is NOT a clean name run must stay in the title
    { title: 'Big Night w/The Mingus Tribute Band',
      startDate: new Date('2026-07-23T20:00:00-04:00').getTime(), fullUrl: '/jazz/bn' },
  ]});
  const evs = bxParse(fixture);
  assert.equal(evs[0].title, 'Steve Cardenas');
  assert.deepEqual(evs[0].personnel.map((p) => p.name),
    ['Adam Kolker', 'Jeremy Stratton', 'George Schuller']);
  assert.equal(evs[1].title, 'Kazemde George');
  assert.deepEqual(evs[1].personnel.map((p) => p.name),
    ['Tyrone Allen II', 'Kayvon Gordon'], 'II suffix passes the name check');
  assert.equal(evs[2].title, 'Big Night w/The Mingus Tribute Band', 'band billing left intact');
  assert.equal(evs[2].personnel, null);
});

ok('barbayeux: namesFrom is strict — one bad part rejects the whole run', () => {
  assert.deepEqual(bxNames('Miki Yamanaka, Matt Dwonszyk'), ['Miki Yamanaka', 'Matt Dwonszyk']);
  assert.deepEqual(bxNames('Leo Genovese and Adam Kolker'), ['Leo Genovese', 'Adam Kolker']);
  assert.deepEqual(bxNames('Miki Yamanaka, special guests'), [], 'billing word poisons the run');
  assert.deepEqual(bxNames('Quartet, Jimmy Macbride'), [], 'ensemble word poisons the run');
  assert.deepEqual(bxNames('lowercase name, Jimmy Macbride'), [], 'lowercase part poisons the run');
});

// --- Bill's Place -----------------------------------------------------------------------------
import { parse as bpParse } from '../clubs/billsplace.js';
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
import { parse as jcParse } from '../clubs/jcal.js';
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
import { parse as rlParse } from '../clubs/roulette.js';
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

// --- Silvana + Shrine (shared Harlem calendar.php) --------------------------------
import { parsePage as svParse } from '../clubs/silvana.js';
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

ok('silvana/shrine: bio-embedded "Name (instrument)" runs become personnel', () => {
  const html = `
  <td><span class="wh">July 17</span>
    <p><a href onclick="return popCal(5);" id="t5">7pm-8pm: Coralai - Jazz Strings</a></p>
    <div class="hid" id="x5">We are a New Orleans based string band consisting of
      Gabrielle Fischler (violin), Jennie Brent (cello), Chris Beroes-Haigis (guitar)
      and Martin Masakowski (bass). We compose original improvisational music.</div>
    <p><a href onclick="return popCal(6);" id="t6">9pm-10pm: Anjali Rose - Jazz Vocalist</a></p>
    <div class="hid" id="x6">Anjali Rose is a composer and vocalist whose work (honesty,
      experimentation) lives at the intersection of jazz and folk.</div>
  </td>`;
  const evs = svParse(html, 'silvana', TODAY);
  assert.equal(evs.length, 2);
  assert.deepEqual(evs[0].personnel, [
    { name: 'Gabrielle Fischler', instrument: 'violin' },
    { name: 'Jennie Brent', instrument: 'cello' },
    { name: 'Chris Beroes-Haigis', instrument: 'guitar' },
    { name: 'Martin Masakowski', instrument: 'bass' },
  ], 'prose prefixes trimmed to the trailing name run');
  assert.equal(evs[1].personnel, null, 'prose parentheticals never fake a roster');
});

// --- Sistas' Place -------------------------------------------------------------------
import { parse as spParse } from '../clubs/sistasplace.js';
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
import { parse as t7Parse } from '../clubs/terraza7.js';
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
import { parse as meParse } from '../clubs/marjorie.js';
ok("marjorie: generator emits 8 Sundays at 3:30, free", () => {
  const evs = meParse(TODAY); // Mon Jul 13 2026
  assert.equal(evs.length, 8);
  assert.equal(evs[0].date, '2026-07-19'); // first Sunday after Mon Jul 13
  assert.deepEqual(evs[0].sets, ['15:30']);
  assert.equal(evs[0].priceText, 'Free');
  assert.ok(evs.every((e) => new Date(e.date + 'T12:00:00').getDay() === 0));
});

// --- Smalls personnel reuse (2026-07-16: Mark Turner invisibility fix) -------------
import { reusePersonnel } from '../clubs/smalls.js';
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

// --- Dizzy's detail extraction (2026-07-16: PERFORMANCE LINEUP recon) ------------------
import { parseDetail as dzDetail } from '../clubs/dizzys.js';
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
import { parseDetail as djDetail } from '../clubs/django.js';
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

// --- 92NY (seed-only; Incapsula-walled) ------------------------------------------------
import { seedEvents as ny92Seed } from '../clubs/ny92.js';
ok('ny92: seed carries halls, rosters, prices; past dates drop; off-season is empty', () => {
  const evs = ny92Seed(new Date('2026-07-22T12:00:00Z'));
  assert.ok(evs.length >= 1);
  assert.ok(evs.every((e) => e.date >= '2026-07-22'), 'past series dates dropped');
  const ron = evs.find((e) => /Ron Carter/.test(e.title));
  assert.ok(ron, 'Foursight present');
  assert.deepEqual(ron.sets, ['19:30']);
  assert.match(ron.details, /Geffen Stage at Kaufmann Concert Hall/);
  assert.equal(ron.personnel.length, 4);
  assert.equal(ron.personnel[2].name, 'Renee Rosnes');
  assert.equal(ron.priceText, 'from $45');
  const kortum = evs.find((e) => /Kortum/.test(e.title));
  assert.match(kortum.details, /Buttenwieser Hall .* streaming/i, 'hall + sold-out note joined without em dash');
  // off-season: far-future today -> no events, and that's the designed shape
  assert.deepEqual(ny92Seed(new Date('2026-09-01T12:00:00Z')), []);
});
