// LA venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Blue Note LA (same platform, region 'la') ---------------------------------
import { parse as bnlaParse } from '../clubs/bluenotela.js';
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

// --- Sam First (Wix warmup-data) ----------------------------------------------------
import { parse as sfParse } from '../clubs/samfirst.js';
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
import { parse as ctParse } from '../clubs/catalina.js';
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
import { parse as vbParse } from '../clubs/vibrato.js';
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
import { parse as wsParse } from '../clubs/worldstage.js';
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
import { parse as lcParse } from '../clubs/lacma.js';
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
import { parse as mtParse } from '../clubs/mint.js';
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
import { parse as lpParse } from '../clubs/laphil.js';
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
import { parse as gdParse } from '../clubs/golddiggers.js';
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
import { parse as ttParse } from '../clubs/twentytwotwenty.js';
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
import { parse as zpParse } from '../clubs/zebulon.js';
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
import { parse as hvParse } from '../clubs/harvelles.js';
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
import { parse as bakedParse, parseDetailSets as bakedDetailSets } from '../clubs/bakedpotato.js';
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

// --- Lodge Room (Tessera eventObjects; jazz-filtered) ----------------------------------
import { parse as lodgeParse } from '../clubs/lodgeroom.js';
ok('lodgeroom: tessera blobs parse; jazz filter keeps keyword + known-artist hits only', () => {
  const blob = (o) => `eventObjects.push(${JSON.stringify(o)});`;
  const html = [
    blob({ id: 1, eventDate: '08/23/2026 8:00 pm', mainArtist: ['Jeff Parker ETA IVtet ‘Happy Today’ Album Release'],
           additionalArtists: [], venue: 'Lodge Room', doors: '7:00 pm',
           link: 'https://www.lodgeroomhlp.com/shows/jeff-parker-eta-ivtet/', tags: [] }),
    blob({ id: 2, eventDate: '07/25/2026 7:30 pm', mainArtist: ['Natural Information Society &#038; Bitchin Bajas'],
           additionalArtists: ['Jill Fraser'], venue: 'Lodge Room',
           link: 'https://www.lodgeroomhlp.com/shows/nis/', tags: [] }),
    blob({ id: 3, eventDate: '08/01/2026 8:00 pm', mainArtist: ['Wu Lyf'], additionalArtists: ['Bondo'],
           venue: 'Lodge Room', link: 'https://www.lodgeroomhlp.com/shows/wu-lyf/', tags: [] }),
    blob({ id: 4, eventDate: '08/02/2026 8:00 pm', mainArtist: ['Some Jazz Quartet'],
           additionalArtists: [], venue: 'The Regent', link: 'x', tags: [] }),
  ].join('\n');
  const evs = lodgeParse(html);
  assert.equal(evs.length, 2, 'indie act and offsite venue filtered out');
  assert.equal(evs[0].clubId, 'lodgeroom');
  assert.equal(evs[0].title, 'Jeff Parker ETA IVtet ‘Happy Today’ Album Release');
  assert.equal(evs[0].date, '2026-08-23');
  assert.deepEqual(evs[0].sets, ['20:00']);
  assert.equal(evs[1].title, 'Natural Information Society & Bitchin Bajas', 'entities decoded');
  assert.equal(evs[1].details, 'With Jill Fraser');
});
