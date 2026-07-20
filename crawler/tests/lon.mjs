// London venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Vortex (ICS feed) ----------------------------------------------------------------
import { parse as vxParse } from '../clubs/vortex.js';
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
import { parse as rsParse, parseDetailTimes } from '../clubs/ronnies.js';
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
import { parse as sixParse } from '../clubs/club606.js';
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
import { parse as jzcParse } from '../clubs/jazzcafe.js';
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
import { parse as pxParse, parseDetail as pxDetail } from '../clubs/pizzaexpresslive.js';
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

ok('pizzaexpress: __NEXT_DATA__ band_line_up_copy -> roster; bio first line -> details', () => {
  const next = { props: { pageProps: { event: { attributes: [
    { attribute: { code: 'band_line_up_heading' }, value: 'Band Lineup' },
    { attribute: { code: 'band_line_up_copy' },
      value: 'Noah Stoneman (piano)<br>Felix Moseholm (double bass)<br>Jacob Patrone (drums)' },
    { attribute: { code: 'html_description' },
      value: '<p>Rising star pianist Noah Stoneman brings his acclaimed trio to Dean Street for one night only.</p>' },
  ] } } } };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script>`;
  const got = pxDetail(html);
  assert.deepEqual(got.personnel, [
    { name: 'Noah Stoneman', instrument: 'piano' },
    { name: 'Felix Moseholm', instrument: 'double bass' },
    { name: 'Jacob Patrone', instrument: 'drums' },
  ]);
  assert.match(got.details, /^Rising star pianist/);
  assert.equal(pxDetail('<html>no next data</html>'), null);
});

// --- Cafe OTO (event links + date headers) ---------------------------------------------------
import { parse as coParse } from '../clubs/cafeoto.js';
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

// --- London seed fallbacks (WAF workarounds, 2026-07-16) --------------------------------
import { SEED as rsSeed } from '../clubs/ronnies-seed.js';
import { SEED as jcSeed } from '../clubs/jazzcafe-seed.js';
ok('london seeds: valid shapes, sane sizes', () => {
  assert.ok(rsSeed.length >= 50, `ronnies seed thin: ${rsSeed.length}`);
  assert.ok(rsSeed.every((r) => r.length === 4 && /^\d{4}-\d{2}-\d{2}$/.test(r[2]) && 'MULX'.includes(r[3])));
  assert.ok(jcSeed.length >= 40, `jazzcafe seed thin: ${jcSeed.length}`);
  assert.ok(jcSeed.every((e) => e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.url));
  assert.ok(rsSeed.some((r) => /kenny barron/i.test(r[1])), 'sanity: Kenny Barron in the Ronnie’s seed');
  assert.ok(jcSeed.some((e) => /immanuel wilkins/i.test(e.title)), 'sanity: Wilkins in the Jazz Cafe seed');
});

// --- 606 detail extraction ---------------------------------------------------------------
import { parseDetail as sixDetail } from '../clubs/club606.js';
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
