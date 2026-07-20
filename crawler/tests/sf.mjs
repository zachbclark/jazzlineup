// SF Bay Area venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- SFJAZZ (ace-api) ---------------------------------------------------------------
import { parse as sfjParse } from '../clubs/sfjazz.js';
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
import { parse as bcParse } from '../clubs/blackcat.js';
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
import { parse as ksParse } from '../clubs/keys.js';
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
import { parse as tippParse } from '../clubs/mrtipples.js';
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
import { parse as bbParse } from '../clubs/birdbeckett.js';
ok('birdbeckett: generator emits 8 Fridays at 7:30pm', () => {
  const evs = bbParse(TODAY); // Mon Jul 13 2026
  assert.equal(evs.length, 8);
  assert.equal(evs[0].date, '2026-07-17'); // first Friday after Mon Jul 13
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.ok(evs.every((e) => new Date(e.date + 'T12:00:00').getDay() === 5));
});

// --- Yoshi's (homegrown calendar) --------------------------------------------------------
import { parse as ysParse } from '../clubs/yoshis.js';
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

// --- Freight & Salvage (genre-tagged cards) -------------------------------------------
import { parse as frParse } from '../clubs/freight.js';
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

// --- SFJAZZ seed fallback (Cloudflare workaround, 2026-07-16) -------------------------
import { SEED as sfjSeed } from '../clubs/sfjazz-seed.js';
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
