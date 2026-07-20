// Chicago venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Green Mill (Events Manager calendar) ---------------------------------------
import { parseMonth as gmParse } from '../clubs/greenmill.js';
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
import { parse as jsParse } from '../clubs/jazzshowcase.js';
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
import { parse as conParse } from '../clubs/constellation.js';
import { parse as hbParse } from '../clubs/hungrybrain.js';
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
import { parse as eaParse } from '../clubs/elasticarts.js';
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
import { parse as wjParse } from '../clubs/winters.js';
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
import { parse as anParse } from '../clubs/andys.js';
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
import { parse as doParse } from '../clubs/dorians.js';
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
import { parse as spcParse } from '../clubs/space.js';
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
