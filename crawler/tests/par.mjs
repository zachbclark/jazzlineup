// Paris venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Duc des Lombards (Drupal agenda) ------------------------------------------------
import { parse as ducParse } from '../clubs/ducdeslombards.js';
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
import { parse as ssParse, parseDetail as ssDetail } from '../clubs/sunsetsunside.js';
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

ok('sunsetsunside: concert-page artistes block -> roster (unquoted attrs, c.basse)', () => {
  // mirrors their served markup: unquoted class attr, roster split across <p>s
  const html = `<h1 class="titre-fiche">Xavier Thollard Trio</h1><div
class=artistes><p>Xavier Thollard - piano</p><p>Yann Phayphet - c.basse<br>
Simon Bernier - batterie <br>
<br></p></div><div
class=col-container>`;
  const got = ssDetail(html);
  assert.deepEqual(got.personnel, [
    { name: 'Xavier Thollard', instrument: 'piano' },
    { name: 'Yann Phayphet', instrument: 'c.basse' },
    { name: 'Simon Bernier', instrument: 'batterie' },
  ]);
  // pages without the block (festivals, private events) must not fake a roster
  assert.equal(ssDetail('<div class="texte"><p>Concert exceptionnel</p></div>'), null);
});

// --- New Morning (JSON-LD agenda) ------------------------------------------------------
import { parse as nmParse, parseDetail as nmDetail } from '../clubs/newmorning.js';
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

ok('newmorning: parseDetail reads the Présentation roster, concert time and price', () => {
  // the roster block is emitted twice (responsive desktop/mobile variants);
  // the header carries a door time then the concert time; price is in the offer
  const html = `<html><body>
    <header>
      <p class="mb-0 text-uppercase">19h30 : Ouverture des portes</p>
      <p class="text-uppercase">20h30 : Concert</p>
    </header>
    <script type="application/ld+json">{"@type":"Event","name":"Immanuel Wilkins Quartet",
      "offers":{"@type":"Offer","price":"27.00","priceCurrency":"EUR"}}</script>
    <div class="d-none d-xl-block">
      <div class="lh-sm mb-2"><span><strong>Immanuel Wilkins</strong></span><br><span class="fst-italic">Saxophone alto</span></div>
      <div class="lh-sm mb-2"><span><strong>Micah Thomas</strong></span><br><span class="fst-italic">Piano</span></div>
      <div class="lh-sm mb-2"><span><strong>Kayvon Gordon</strong></span><br><span class="fst-italic">Batterie</span></div>
    </div>
    <div class="d-xl-none">
      <div class="lh-sm mb-2"><span><strong>Immanuel Wilkins</strong></span><br><span class="fst-italic">Saxophone alto</span></div>
      <div class="lh-sm mb-2"><span><strong>Micah Thomas</strong></span><br><span class="fst-italic">Piano</span></div>
      <div class="lh-sm mb-2"><span><strong>Kayvon Gordon</strong></span><br><span class="fst-italic">Batterie</span></div>
    </div>
  </body></html>`;
  const got = nmDetail(html);
  assert.deepEqual(got.personnel, [
    { name: 'Immanuel Wilkins', instrument: 'saxophone alto' },
    { name: 'Micah Thomas', instrument: 'piano' },
    { name: 'Kayvon Gordon', instrument: 'batterie' },
  ], 'dedupes the double-rendered roster by name');
  assert.deepEqual(got.sets, ['20:30'], 'concert time, not the door time');
  assert.equal(got.priceText, '27€');
});

ok('newmorning: parseDetail degrades — roster-only page (time/price not yet posted)', () => {
  // a far-out show can list its lineup before its time or price exists
  const html = `<div class="lh-sm mb-2"><span><strong>Seba Graves</strong></span><br><span class="fst-italic">Trombone basse</span></div>
    <div class="lh-sm mb-2"><span><strong>Tarik Graves</strong></span><br><span class="fst-italic">Trompette</span></div>`;
  const got = nmDetail(html);
  assert.equal(got.personnel.length, 2);
  assert.deepEqual(got.sets, []);
  assert.equal(got.priceText, null);
});

// --- Caveau de la Huchette (French prose dates) ----------------------------------------
import { expandLine, parseMonthPage } from '../clubs/caveau.js';
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
import { parse as bbmParse, parseDetail as bbmDetail } from '../clubs/balblomet.js';
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

ok('balblomet: event page dash roster + program note prose', () => {
  const html = `<div class="post-content">
    <p>Paul Lay – piano<br>Baptiste Herbin – saxophone</p>
    <p>Tea for Two réunit deux figures exceptionnelles du jazz français, le pianiste Paul Lay et le saxophoniste Baptiste Herbin, autour d'un dialogue complice.</p>
    <p>Contact event manager</p></div>`;
  const got = bbmDetail(html);
  assert.deepEqual(got.personnel, [
    { name: 'Paul Lay', instrument: 'piano' },
    { name: 'Baptiste Herbin', instrument: 'saxophone' },
  ]);
  assert.match(got.details, /^Tea for Two réunit/);
  // a page with only prose must not fake a roster
  assert.equal(bbmDetail('<p>Une soirée de standards revisités au piano seul, entre Ellington et Strayhorn, portée par un toucher lumineux.</p>').personnel, null);
});

// --- 38 Riv (listing + detail set times + reuse) -------------------------------------------
import { parse as rivParse, parseDetailSets } from '../clubs/riv38.js';
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

// --- Duc detail rosters (French instruments, 2026-07-16) ------------------------------
import { parseDetailPersonnel } from '../clubs/ducdeslombards.js';
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
