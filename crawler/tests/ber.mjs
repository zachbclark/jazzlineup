// Berlin venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Berlin ------------------------------------------------------------------
import { monthNum as deMonthNum, parsePersonnel as deRoster, personnelFromJpRun as westRun } from '../lib.js';
ok('german lexicon: months (Okt/Dez/Mär/Mai) and instruments; western paren rosters', () => {
  assert.equal(deMonthNum('Okt'), 10);
  assert.equal(deMonthNum('Dez'), 12);
  assert.equal(deMonthNum('Mär'), 3);
  assert.equal(deMonthNum('Mai'), 5);
  assert.equal(deMonthNum('Juli'), 7); // shared prefix with English
  const p = deRoster('Anna Schmidt - Schlagzeug Ben Weber - Kontrabass Jo Klein - Flöte');
  assert.equal(p.length, 3, 'german instrument words split the run');
  assert.equal(p[0].name, 'Anna Schmidt');
  const w = westRun('Hervé Hartock (dr), Samuel Appapoulay (keyb.), Richard Müller (b), Tanja Becker (tb)', { maxName: 40 });
  assert.equal(w.length, 4);
  assert.equal(w[1].name, 'Samuel Appapoulay', 'long western names survive with maxName');
  assert.equal(w[1].instrument, 'keys');
  const full = westRun('Márton Zsiborás (Electric Bass), Paul Brüllmann (Drums)', { maxName: 40 });
  assert.equal(full.length, 2, 'written-out instrument words accepted');
});

import { parse as atraneParse, personnelFromSubtitle as atraneRoster } from '../clubs/atrane.js';
ok('atrane: EventON epoch data-time; PRÄSENTIERT prefix stripped; closed days skipped', () => {
  const html = `
  <div id="event_94066_0" class="eventon_list_event evo_eventtop scheduled event no_et" data-time="1784579400-1784591400" data-colr="#ECECEC">
    <a href="https://a-trane.de/Events-Directory/a-trane-praesentiertandreas-155/"></a>
    <span class="evoet_title evcal_desc2 evcal_event_title">A-TRANE PRÄSENTIERT:<br>ANDREAS SCHMIDT &amp; FRIENDS<br>HEUTE MIT: HEINRICH KÖBBERLING</span>
    <span class="evoet_subtitle evcal_event_subtitle">EINTRITT FREI &amp; ENTRANCE FREE</span>
  </div>
  <div class="eventon_list_event evo_eventtop event" data-time="1784665800-1784677800">
    <span class='evoet_title evcal_event_title'>HEUTE GESCHLOSSEN - TODAY CLOSED</span>
  </div>`;
  const evs = atraneParse(html);
  assert.equal(evs.length, 1, 'closed placeholder skipped');
  assert.equal(evs[0].title, 'ANDREAS SCHMIDT & FRIENDS');
  assert.equal(evs[0].date, '2026-07-20');
  assert.deepEqual(evs[0].sets, ['20:30']);
  assert.match(evs[0].details, /HEUTE MIT: HEINRICH KÖBBERLING/);
  assert.equal(evs[0].priceText, 'Free');
  assert.match(evs[0].url, /Events-Directory/);
  assert.deepEqual(evs[0].personnel, [{ name: 'Heinrich Köbberling', instrument: '' }],
    'HEUTE MIT name title-cased into instrument-less personnel');
});

ok('atrane: labeled subtitle runs -> names; ambiguous dashes reject the run', () => {
  assert.deepEqual(
    atraneRoster(['HEUTE MIT: HEINRICH KÖBBERLING-RUDI MAHALL', 'Special Guest: ETIENNE WITTICH'])
      .map((p) => p.name),
    ['Heinrich Köbberling', 'Rudi Mahall', 'Etienne Wittich']);
  assert.deepEqual(
    atraneRoster(['FEAT: Luca Zambito-Sebastian Wolfgruber']).map((p) => p.name),
    ['Luca Zambito', 'Sebastian Wolfgruber']);
  // "Werra-Magro": hyphenated surname or separator? Can't know -> no roster
  assert.deepEqual(atraneRoster(['FEAT: Till Sahm-Björn Werra-Magro']), []);
  // unlabeled subtitle lines never become names
  assert.deepEqual(atraneRoster(['«Where Nights Unfold» · Celebrating 5 Years Of The Trio']), []);
});

import { parse as quasiParse } from '../clubs/quasimodo.js';
ok('quasimodo: em event-items, numeric german dates, title rescue filter', () => {
  const html = `
  <a class="event-item" href="https://quasimodo.club/events/jazz-night-ft-flow-rea-est-7396">
    <div class="event-data visible-xs"><div class="date">20.11.2026 - 22:00</div></div>
    <h4 class="event-title">Jazz Night ft. Flow Rea (Est)</h4></a>
  <a class="event-item" href="https://quasimodo.club/events/we-love-80s-37-7300">
    <div class="event-data visible-xs"><div class="date">01.08.2026 - 22:00</div></div>
    <h4 class="event-title">WE LOVE 80S</h4></a>`;
  const all = quasiParse(html);
  assert.equal(all.length, 2, 'tag pages take everything');
  assert.equal(all[0].date, '2026-11-20');
  assert.deepEqual(all[0].sets, ['22:00']);
  const filtered = quasiParse(html, { titleFilter: true });
  assert.equal(filtered.length, 1, 'rescue pass keeps only jazz-family titles');
  assert.equal(filtered[0].title, 'Jazz Night ft. Flow Rea (Est)');
});

import { parse as zzParse, extractDetail as zzDetail } from '../clubs/zigzag.js';
ok('zigzag: squarespace summary items, english dates, genre paren, Beginn detail', () => {
  const html = `
  <div class="summary-item sqs-gallery">
    <div class="summary-title"><a href="/program-mai/takingoffuri-bp7l7" class="summary-title-link"> Tal Arditi Featuring Tim Ries </a></div>
    <div class="summary-excerpt"><p>(Jazz)Tim Ries, Grammy-prämierter Saxophonist…</p></div>
    <time class="summary-metadata-item--date">July 18, 2026</time>
  </div>
  <div class="summary-item">
    <div class="summary-title"><a href="/program-mai/other" class="summary-title-link">Comedy Abend</a></div>
    <div class="summary-excerpt"><p>(Comedy)Ein Abend…</p></div>
    <time class="summary-metadata-item--date">August 2, 2026</time>
  </div>`;
  const evs = zzParse(html);
  assert.equal(evs.length, 1, 'non-jazz genre paren skipped');
  assert.equal(evs[0].title, 'Tal Arditi Featuring Tim Ries');
  assert.equal(evs[0].date, '2026-07-18');
  assert.match(evs[0].url, /program-mai\/takingoffuri/);
  const d = zzDetail('<p>Beginn: 20:00 Uhr (Einlass ab 19:00 Uhr) Eintritt: 25€</p>');
  assert.deepEqual(d.sets, ['20:00']);
  assert.match(d.priceText, /25/);
  // roster in chaotic case: ALL-CAPS leader, lowercase sidemen -> title-cased
  const r = zzDetail(`<p>Beginn: 20:00 Uhr</p>
    <p>TAL ARDITI - Guitar<br>tim ries - saxophone<br>makar novikov - bass<br>mathis grossman - drums</p>`);
  assert.deepEqual(r.personnel, [
    { name: 'Tal Arditi', instrument: 'guitar' },
    { name: 'Tim Ries', instrument: 'saxophone' },
    { name: 'Makar Novikov', instrument: 'bass' },
    { name: 'Mathis Grossman', instrument: 'drums' },
  ]);
  assert.equal(d.personnel, null, 'no roster lines -> no personnel');
});

import { parse as donauParse, membersToPersonnel as donauMembers } from '../clubs/donau115.js';
ok('donau115: firebase feed, live flag, member rosters both shapes, jam kept', () => {
  const feed = JSON.stringify({
    a: { bandName: 'Nathan Ott Coltrane100', date: '2026-07-18', live: true,
         description: 'Coltrane centenary.', members: ['Kit Downes (p)', 'Jeremy Viner (ts, cl)', 'Felix Henkelhausen (b)', 'Nathan Ott (dr)'] },
    b: { bandName: 'Two-Song Tuesday (MUSIC STARTS 20:00)', date: '2026-07-21', live: true,
         description: '[sign up 19:30 // start 20:00]' },
    c: { bandName: 'Thursday Jazz Jam', date: '2026-07-23', live: true,
         description: 'doors 19:30 // first set 20:00', members: ['You -- anything'] },
    d: { bandName: 'Jonathan Reisin Trio', date: '2026-07-31', live: true,
         description: '', members: ['Jonathan Reisin - Saxophone', 'Julius Windisch - Piano', 'Francesca Remigi - Drums'] },
    e: { bandName: 'Draft Show', date: '2026-08-01', live: false },
    f: { bandName: 'Old Show', date: '2026-01-01', live: true },
  });
  const evs = donauParse(feed, '2026-07-17');
  assert.deepEqual(evs.map((e) => e.title),
    ['Nathan Ott Coltrane100', 'Thursday Jazz Jam', 'Jonathan Reisin Trio'],
    'songwriter night, drafts, and past shows excluded');
  assert.equal(evs[0].personnel.length, 4);
  assert.equal(evs[0].personnel[0].name, 'Kit Downes');
  assert.equal(evs[2].personnel[1].instrument, 'piano');
  assert.equal(evs[1].personnel, null, 'jam "You -- anything" is not a roster');
  const dash = donauMembers(['A Person – Trompete', 'B Person -- Schlagzeug']);
  assert.equal(dash.length, 2, 'en-dash and double-dash both split');
  const colon = donauMembers([
    'Quique Sinesi:7 Strings & 10 Strings Spanish Guitars,Charango.Composition',
    'Thiago Duarte: Double Bass', 'Amoy Ribas :Percussion',
    'Special Guest, Ariel Bart : Harmonica', 'zzz']);
  assert.equal(colon.length, 4, 'colon-separated members parse; junk member dropped');
  assert.equal(colon[3].name, 'Ariel Bart', 'guest prefix stripped');
  assert.match(colon[0].instrument, /guitars, charango/, 'punctuation spaced');
  const flipped = donauMembers(['Hila Kulik - Piano', 'Sax - Ori Jacobson', 'Makar Novikov - Double Bass']);
  assert.equal(flipped[1].name, 'Ori Jacobson', 'instrument-first lines swap');
  assert.equal(flipped[1].instrument, 'sax');
  assert.equal(flipped[2].name, 'Makar Novikov', 'double-word instruments still right side');
});

import { parse as schlotParse, extractDetail as schlotDetail } from '../clubs/schlot.js';
ok('schlot: offbeat list, german months, geschlossen + kabarett skipped, Uhr detail', () => {
  const item = (day, mon, title) => `
  <div class="edgtf-el-item edgtf-el-item-standard">
    <a class="edgtf-el-item-link-outer" href="https://kunstfabrik-schlot.de/event/${title.toLowerCase().replace(/[^a-z]+/g, '-')}/"></a>
    <span class="edgtf-el-item-day">${day}</span>
    <div class="edgtf-el-item-mw"><span class="edgtf-el-item-month">${mon}</span><span class="edgtf-el-item-weekday">Sa</span></div>
    <div class="edgtf-el-item-title-holder"><h4 class="edgtf-el-item-title">${title}</h4></div>
  </div>`;
  const html = item('18', 'Jul', 'Fitz Swing Big Band') + item('3', 'Okt', 'Ivanov Vibe')
    + item('20', 'Jul', 'Geschlossen - Closed') + item('21', 'Jul', 'Kabarett Nacht');
  const evs = schlotParse(html, new Date(2026, 6, 18));
  assert.equal(evs.length, 2, 'closed + kabarett skipped');
  assert.equal(evs[0].date, '2026-07-18');
  assert.equal(evs[1].date, '2026-10-03', 'Okt maps through the german month table');
  assert.match(evs[1].url, /kunstfabrik-schlot\.de\/event\//);
  assert.deepEqual(schlotDetail('<p>Konzert um 20:30 Uhr, Eintritt 15€</p>').sets, ['20:30']);
});

import { parse as bflatParse } from '../clubs/bflat.js';
ok('bflat: squarespace events json, Concert-tag time, excerpt roster', () => {
  const fixture = JSON.stringify({
    upcoming: [
      { title: 'Les Colorés Jazz Kréol', startDate: 1784444400506,
        tags: ['Doors open: 20:00 – Concert: 21:00'],
        excerpt: 'Hervé Hartock (dr), Samuel Appapoulay (keyb.), Richard Müller&nbsp;(b), Tanja Becker (tb)website',
        fullUrl: '/events/mcg5sn3pdyxhzz9' },
      { title: 'Robins Nest - Jamsession', startDate: 1784703600936,
        tags: ['Doors open: 20:00 – Concert: 21:00'],
        excerpt: 'Jamsession die legendäre Jam Session mit Robin Draganiç' },
    ],
  });
  const evs = bflatParse(fixture);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].date, '2026-07-19', 'date from startDate in Europe/Berlin');
  assert.deepEqual(evs[0].sets, ['21:00'], 'time from the Concert tag, not the bogus startDate clock');
  assert.equal(evs[0].personnel.length, 4);
  assert.equal(evs[0].personnel[3].instrument, 'trombone');
  assert.match(evs[0].url, /b-flat-berlin\.de\/events\//);
  assert.equal(evs[1].personnel, null);
});
