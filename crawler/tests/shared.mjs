// Shared machinery: lib.js personnel parsing, crawl merge rules,
// DICE genre tags, the known-artist net, and detail-page enrichment — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';
import { parse as jgParse } from '../clubs/jazzgallery.js';

// --- personnel parsing --------------------------------------------------------
import { parsePersonnel, stripPromo } from '../lib.js';
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

  // pipe seams (Mr. Tipple's), mixed with a dash seam mid-run
  const mt = parsePersonnel('Carmen Getit | Guitar & Vocals Kamrin Ortiz | Tenor Saxophone Tim Bulkley – Drums');
  assert.equal(mt.length, 3);
  assert.deepEqual(mt[0], { name: 'Carmen Getit', instrument: 'guitar & vocals' });
  assert.deepEqual(mt[2], { name: 'Tim Bulkley', instrument: 'drums' });

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

// --- crawl merge integration (failure isolation rules) --------------------------
import { mergeCrawlResults } from '../run.js';
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

ok('merge: emptyOk modules may return 0 events without going suspect', () => {
  const results = [
    { status: 'fulfilled', value: { mod: './clubs/ny92.js', events: [] } },
    { status: 'fulfilled', value: { mod: './clubs/b.js', events: [] } },
  ];
  const out = mergeCrawlResults(results, {
    previousEvents: [],
    targetIds: new Set(['ny92', 'b']),
    emptyOkMods: new Set(['./clubs/ny92.js']),
  });
  assert.equal(out.errors.length, 1, 'only the non-emptyOk module errors');
  assert.match(out.errors[0], /clubs\/b\.js/);
  assert.ok(out.log.some((l) => /ok .*ny92.*off-season/.test(l)), 'seasonal empty logs as ok');
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

// --- DICE genre tags (Frisell regression, 2026-07-16) ---------------------------------
import { parse as zebParse2 } from '../clubs/zebulon.js';
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
import { matchesKnownArtist } from '../clubs/_jazzartists.js';
import { parse as mintParse2 } from '../clubs/mint.js';
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

// --- Shared detail enrichment (2026-07-16: "personnel is very important") -------------
import { enrichFromDetailPages } from '../clubs/_enrichdetails.js';
import { personnelFromLines } from '../lib.js';
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

ok('enrich: alsoFill rides along on a fetch but never triggers one (New Morning)', async () => {
  // roster present but no time yet -> must NOT refetch just to chase the time
  const events = [
    { id: 'nm:2026-07-20:a', date: '2026-07-20', url: 'https://x/a', personnel: null, sets: [], priceText: null },
    { id: 'nm:2026-07-27:b', date: '2026-07-27', url: 'https://x/b',
      personnel: [{ name: 'Has Roster', instrument: 'piano' }], sets: [], priceText: null },
  ];
  const fetched = [];
  await enrichFromDetailPages(events, {}, {
    fields: ['personnel'],
    alsoFill: ['sets', 'priceText'],
    extract: () => ({ personnel: [{ name: 'Fetched Player', instrument: 'sax' }], sets: ['20:30'], priceText: '27€' }),
    fetchImpl: async (url) => { fetched.push(url); return ''; },
  });
  assert.deepEqual(fetched, ['https://x/a'], 'only the roster-less event fetches; alsoFill gaps do not');
  assert.deepEqual(events[0].sets, ['20:30'], 'time filled opportunistically on the personnel fetch');
  assert.equal(events[0].priceText, '27€');
  assert.deepEqual(events[1].sets, [], 'event with a roster is left time-less rather than refetched');
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
