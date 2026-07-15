// Bootstrap data/events.json from real show data captured from each club's
// website on 2026-07-13 (via browser during initial development, since the
// dev sandbox couldn't fetch the sites directly). Running `npm run crawl`
// replaces this snapshot with live data.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEvent, extractTimes, monthNum, isoDate } from '../crawler/lib.js';
import { CLUBS } from '../crawler/clubs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'data');
const YEAR = 2026;

const events = [];
const push = (e) => events.push(makeEvent(e));

// ---- helpers ---------------------------------------------------------------
const iso = (mon, day) => isoDate(YEAR, monthNum(mon), day);
const t = (s) => {
  const first = String(s).split(/[-–]/)[0]; // ranges: start time only
  return extractTimes(first.replace(/(\d)(?::(\d{2}))?p\b/g, '$1:$2 pm').replace(/(\d)(?::(\d{2}))?a\b/g, '$1:$2 am').replace(/:undefined|:\s/g, ':00 '));
};
const range = (mon1, d1, mon2, d2, fn) => {
  let d = new Date(Date.UTC(YEAR, monthNum(mon1) - 1, d1));
  const end = new Date(Date.UTC(YEAR, monthNum(mon2) - 1, d2));
  while (d <= end) {
    fn(isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), d.getUTCDay());
    d = new Date(d.getTime() + 86400000);
  }
};

// ---- Village Vanguard (8pm & 10pm nightly; VJO every Monday) ----------------
const VV = 'https://vv.squadup.com/artists/';
const vvRuns = [
  ['Ben Wendel', 'Jul', 14, 'Jul', 19, 'ben-wendel'],
  ['Kris Davis | Tyshawn Sorey | Ingrid Laubrock', 'Jul', 21, 'Jul', 26, 'kris-davis-ingrid-laubrock-tyshawn-sorey'],
  ['Makaya McCraven Tet', 'Jul', 28, 'Aug', 2, 'makaya-mccraven'],
  ['Andrew Cyrille Quartet', 'Aug', 4, 'Aug', 9, 'andrew-cyrille-quartet'],
  ['Bill Frisell Trio', 'Aug', 11, 'Aug', 16, 'bill-frisell-trio'],
  ['Bill Frisell Four', 'Aug', 18, 'Aug', 23, 'bill-frisell-four'],
  ["Joe Lovano's Paramount Quartet", 'Aug', 25, 'Aug', 30, 'joe-lovano-paramount-quartet'],
];
for (const [title, m1, d1, m2, d2, slug] of vvRuns) {
  range(m1, d1, m2, d2, (date) =>
    push({ clubId: 'vanguard', title, date, sets: ['20:00', '22:00'], url: VV + slug }));
}
range('Jul', 13, 'Sep', 7, (date, dow) => {
  if (dow === 1) push({
    clubId: 'vanguard', title: 'Vanguard Jazz Orchestra', date,
    sets: ['20:00', '22:00'], url: VV + 'vanguard-jazz-orchestra', details: 'Every Monday night',
  });
});

// ---- Smalls & Mezzrow (captured Jul 13-27) ----------------------------------
// date ; venue(S/M) ; times ; title
const SM = `Jul13;M;6p , 7:30p;Jeremy Manasia Trio
Jul13;M;9p , 10:30p;Jon Davis Trio
Jul13;M;11:30p;Vinyl After Hours
Jul13;S;6p , 7:30p;Ari Hoenig Trio
Jul13;S;9p , 10:30p;Bernell Jones II Quartet
Jul13;S;11:45p;Jam Session Hosted By Adam Ray
Jul14;M;6p , 7:30p;Michael Kanan Trio
Jul14;M;9p , 10:30p;Ray Gallon Trio
Jul14;M;11:30p;Vinyl After Hours
Jul14;S;6p , 7:30p;Jay Sawyer Trio
Jul14;S;9p , 10:30p;Rico Jones Quartet
Jul14;S;11:45p;Jam Session Hosted By Jason Clotter
Jul15;M;6p , 7:30p;Adam Kolker & Sam Yahel Duets
Jul15;M;9p , 10:30p;Jihee Heo Trio
Jul15;M;11:30p;Vinyl After Hours
Jul15;S;6p , 7:30p;Behn Gillece Quintet
Jul15;S;9p , 10:30p;Adam Niewood Quartet
Jul15;S;11:45p;Jam Session Hosted By Carlos Abadie
Jul16;M;6p , 7:30p;Marcus Goldhaber Quartet
Jul16;M;9p , 10:30p;Lonnie Plaxico Trio
Jul16;M;11:30p;Vinyl After Hours
Jul16;S;6p , 7:30p;Dave Scott Quintet
Jul16;S;9p , 10:30p;Chris Berger Quartet
Jul16;S;11:45p;Jam Session Hosted by Ben Barnett
Jul17;M;6p , 7:30p;Jim Ridl Trio
Jul17;M;9p , 10:30p;Cameron Campbell ON AIR! Band
Jul17;M;11:55p;Round Midnight Solo Piano
Jul17;S;2p;Smalls Afternoon Jam Session
Jul17;S;6p , 7:30p;Yuhan Su Quartet
Jul17;S;9p , 10:30p;Dave Schumacher & Cubeye
Jul17;S;11:55p;Chris Beck Quartet
Jul18;M;6p , 7:30p;Jim Ridl Trio
Jul18;M;9p , 10:30p;Cameron Campbell ON AIR! Band
Jul18;M;11:55p;Round Midnight Solo Piano
Jul18;S;2p;Smalls Afternoon Jam Session
Jul18;S;6p , 7:30p;Yuhan Su Quartet
Jul18;S;9p , 10:30p;Dave Schumacher & Cubeye
Jul18;S;11:55p;Justin Robinson Quartet
Jul19;M;6p , 7:30p;April Varner Quartet
Jul19;M;9p , 10:30p;Naama Trio
Jul19;S;2p;Smalls Afternoon Jam Session
Jul19;S;6p , 7:30p;Larry Ham & Ali Ryerson Quartet
Jul19;S;9p , 10:30p;Hendrik Meurkens Quintet
Jul19;S;11:55p;Aaron Johnson Boplicity
Jul20;M;6p , 7:30p;Spike Wilner Trio
Jul20;M;9p , 10:30p;Pasquale Grasso Trio
Jul20;M;11:30p;Vinyl After Hours
Jul20;S;6p , 7:30p;Eliot Zigmund Quintet
Jul20;S;9p , 10:30p;Tony Leone Quintet
Jul20;S;11:45p;Jam Session Hosted By Mike Boone
Jul21;M;6p , 7:30p;Alberto Pibiri Trio
Jul21;M;9p , 10:30p;Tardo Hammer Trio
Jul21;M;11:30p;Vinyl After Hours
Jul21;S;6p , 7:30p;Ben Solomon Quartet
Jul21;S;9p , 10:30p;Daniel Bereket Quintet
Jul21;S;11:45p;Jam Session Hosted By Kyle Colina
Jul22;M;6p , 7:30p;Melissa Stylianou Quartet
Jul22;M;9p , 10:30p;JinJoo Yoo Trio
Jul22;M;11:30p;Vinyl After Hours
Jul22;S;6p , 7:30p;Julia Danielle Quartet
Jul22;S;9p , 10:30p;Premazzi & Nasser Quartet
Jul22;S;11:45p;Jam Session Hosted By Carlos Abadie
Jul23;M;6p , 7:30p;Arcoiris Sandoval Trio
Jul23;M;9p , 10:30p;Chris Bergson Trio
Jul23;M;11:30p;Vinyl After Hours
Jul23;S;6p , 7:30p;Richard Sussman Quintet
Jul23;S;9p , 10:30p;Alex Tremblay Sextet
Jul23;S;11:45p;Jam Session Hosted By Matt Stubbs
Jul24;M;6p , 7:30p;Jon Thomas Trio
Jul24;M;9p , 10:30p;Eden Ladin Trio
Jul24;M;11:55p;Round Midnight Solo Piano
Jul24;S;2p;Smalls Afternoon Jam Session
Jul24;S;6p , 7:30p;Eric Person Quintet
Jul24;S;9p , 10:30p;Manuel Valera New Cuban Express
Jul24;S;11:55p;Ken Fowser Sextet
Jul25;M;6p , 7:30p;Jon Thomas Trio
Jul25;M;9p , 10:30p;Eden Ladin Trio
Jul25;M;11:55p;Round Midnight Solo Piano
Jul25;S;2p;Smalls Afternoon Jam Session
Jul25;S;6p , 7:30p;Eric Person Quintet
Jul25;S;9p , 10:30p;Manuel Valera New Cuban Express
Jul25;S;11:55p;Matt Martinez Quartet
Jul26;M;6p , 7:30p;Alyssa Allgood Trio
Jul26;M;9p , 10:30p;Lucy Wijnands Quartet
Jul26;S;2p;Smalls Afternoon Jam Session
Jul26;S;6p , 7:30p;Tad Shull Quartet
Jul26;S;9p , 10:30p;Todd Herbert Quartet
Jul26;S;11:55p;Saul Rubin Quartet
Jul27;M;6p , 7:30p;Alan Broadbent Trio
Jul27;M;9p , 10:30p;Jesse Green Trio
Jul27;M;11:30p;Vinyl After Hours
Jul27;S;6p , 7:30p;Matt Pavolka's New Quintet
Jul27;S;9p , 10:30p;Mike Ledonne Quartet
Jul27;S;11:45p;Jam Session Hosted By Adam Ray`;
for (const line of SM.split('\n')) {
  const [md, v, times, title] = line.split(';').map((s) => s.trim());
  const m = md.match(/([A-Za-z]+)(\d+)/);
  push({
    clubId: v === 'S' ? 'smalls' : 'mezzrow',
    title,
    date: iso(m[1], Number(m[2])),
    sets: t(times),
    url: 'https://www.smallslive.com/',
  });
}

// ---- Birdland (July; B = Jazz Club, T = Theater) ----------------------------
const BL = `07-13;B;7:00 PM;Karen Akers in Come With Me To Paris
07-13;B;9:30 PM;Jim Caruso's Cast Party
07-13;T;5:30 PM;Vince Giordano and the Nighthawks
07-14;B;7:00 PM;Frank Catalano Quartet
07-14;T;5:30 PM;Vince Giordano and the Nighthawks
07-15;B;7:00 PM;Stella Cole
07-15;T;5:30 PM;David Ostwald's Louis Armstrong Eternity Band
07-15;T;8:30 PM;Frank Vignola's Guitar Night
07-16;B;7:00 PM;Stella Cole
07-16;T;5:30 PM;The High Society New Orleans Jazz Band
07-17;B;5:30 PM;Birdland Big Band
07-17;B;8:30 PM;Stella Cole
07-17;T;7:00 PM;Allan Harris: Harlem After Dark
07-18;B;5:30 PM;Danny Tobias Quartet
07-18;B;8:30 PM;Stella Cole
07-18;T;7:00 PM;Allan Harris: Harlem After Dark
07-19;B;5:30 PM;Jon Gordon Nonet
07-19;B;8:30 PM;The Birdland Latin Jazz Orchestra
07-19;T;7:00 PM;Allan Harris: Harlem After Dark
07-20;B;7:00 PM;An Evening with Liz Gillies
07-20;B;9:30 PM;Jim Caruso's Cast Party
07-20;T;5:30 PM;Vince Giordano and the Nighthawks
07-21;B;7:00 PM;Gerry Gibbs Dream Band ft. Gary Bartz
07-21;T;5:30 PM;Vince Giordano and the Nighthawks
07-22;B;7:00 PM;Gerry Gibbs Dream Band ft. Gary Bartz
07-22;T;5:30 PM;David Ostwald's Louis Armstrong Eternity Band
07-22;T;8:30 PM;Frank Vignola's Guitar Night
07-23;B;7:00 PM;Gerry Gibbs Dream Band ft. Gary Bartz
07-23;T;5:30 PM;The High Society New Orleans Jazz Band
07-24;B;5:30 PM;Birdland Big Band
07-24;B;8:30 PM;Gerry Gibbs Dream Band ft. Gary Bartz
07-24;T;7:00 PM;Dan Wilson & Peter Bernstein
07-25;B;5:30 PM;Danny Tobias Quartet
07-25;B;8:30 PM;Gerry Gibbs Dream Band ft. Gary Bartz
07-25;T;7:00 PM;Dan Wilson & Peter Bernstein
07-26;B;5:30 PM;Arcoiris Sandoval Sonic Asylum
07-26;B;8:30 PM;The Birdland Latin Jazz Orchestra
07-26;T;7:00 PM;Dan Wilson & Peter Bernstein
07-27;B;7:00 PM;Max Pollak Group
07-27;B;9:30 PM;Jim Caruso's Cast Party
07-27;T;5:30 PM;Vince Giordano and the Nighthawks
07-28;B;7:00 PM;Bill Charlap and Renee Rosnes
07-28;T;5:30 PM;Vince Giordano and the Nighthawks
07-29;B;7:00 PM;Bill Charlap and Renee Rosnes
07-29;T;5:30 PM;David Ostwald's Louis Armstrong Eternity Band
07-29;T;8:30 PM;Frank Vignola's Guitar Night
07-30;B;7:00 PM;Bill Charlap and Renee Rosnes
07-30;T;5:30 PM;The High Society New Orleans Jazz Band
07-31;B;5:30 PM;The Yardbird Big Band
07-31;B;8:30 PM;Bill Charlap and Renee Rosnes
07-31;T;7:00 PM;Miki Yamanaka Trio`;
for (const line of BL.split('\n')) {
  const [md, v, time, title] = line.split(';').map((s) => s.trim());
  push({
    clubId: 'birdland',
    title: v === 'T' ? `${title} (Theater)` : title,
    date: `${YEAR}-${md}`,
    sets: extractTimes(time),
    url: 'https://www.birdlandjazz.com/calendar/',
    details: v === 'T' ? 'Birdland Theater' : 'Birdland Jazz Club',
  });
}

// ---- Dizzy's Club (Mon-Sat 7 & 9 PM, Sun 5 & 7:30 PM) -----------------------
const dz = (dateIso) => {
  const dow = new Date(dateIso + 'T12:00:00Z').getUTCDay();
  return dow === 0 ? ['17:00', '19:30'] : ['19:00', '21:00'];
};
const DZ = `Jul;13;13;Miggy Augmented Orchestra: Unbreakable Hope & Resilience;21126
Jul;14;14;Salsa Meets Jazz: The Music of Héctor Lavoe;21130
Jul;15;15;John Ellis Heroes Quintet;21133
Jul;16;16;Yuhan Su Sextet: 101st Cal Tjader Birthday Celebration;21398
Jul;17;19;Charles McPherson Quintet;21136
Jul;20;20;Ginita y La Orquesta Esa Big Band;21143
Jul;21;21;Terence Harper Collective;21146
Jul;22;22;The Harper Collective: Terry Harper's Birthday;21149
Jul;23;26;Jon Faddis Quartet: 73rd Birthday Celebration;21152
Jul;27;28;Nduduzo Makhathini Trio;21161
Jul;30;30;King Seiko Presents Seiko Summer Jazz Camp All-Stars;21176
Jul;29;33;Jazz Samba: Duduka Da Fonseca, Maucha Adnet, Helio Alves;21166
Aug;3;3;Joe Gransden Big Band: The Good Life;21183
Aug;4;4;Bluesday with BLUES People;21186
Aug;5;5;Nicole Zuraitis: The Devil I Knew Album Release;21189
Aug;6;8;Ben Wolfe Quartet;21192
Aug;9;9;Songbook Sundays: The Tony Bennett Centennial;21199
Aug;10;10;Jazz House Kids, hosted by Christian McBride;21202
Aug;11;11;Steve Nelson: The Art of the Vibraphone;21205
Aug;12;12;Ehud Asherie Trio;21208
Aug;13;16;Warren Wolf with Alex Brown and Strings;21211
Aug;17;17;Jason Marshall Big Band;21223
Aug;18;18;Marius Van Den Brink: The Bird Sings Album Release;21226
Aug;19;19;Lolivone de la Rosa: Jewels Album Release;21229
Aug;19;19;Dida Pelled: I Wish You Would;21231
Aug;20;20;Shenel Johns Album Release;21233
Aug;21;23;Marilyn Maye;21236
Aug;24;24;Jared Schonig Big Band: Live Album Release;21243`;
for (const line of DZ.split('\n')) {
  const [mon, d1, d2, title, tix] = line.split(';').map((s) => s.trim());
  // d2 can roll into next month (encoded as day > days-in-month, e.g. Jul 29-33 = Jul 29-Aug 2)
  let d = new Date(Date.UTC(YEAR, monthNum(mon) - 1, Number(d1)));
  const end = new Date(Date.UTC(YEAR, monthNum(mon) - 1, Number(d2)));
  while (d <= end) {
    const dateIso = isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    push({ clubId: 'dizzys', title, date: dateIso, sets: dz(dateIso), url: `https://ticketing.jazz.org/${tix}/` });
    d = new Date(d.getTime() + 86400000);
  }
}

// ---- Blue Note (8 PM & 10:30 PM standard) -----------------------------------
const BN = `Jul;13;Omar Sosa Quarteto Americanos
Jul;14;Omar Sosa Quarteto Americanos
Jul;15;Wyatt Waddell
Jul;16;Ms. Lisa Fischer ft. Orrin Evans
Jul;17;Ms. Lisa Fischer ft. Orrin Evans
Jul;18;Ms. Lisa Fischer ft. Orrin Evans
Jul;20;Dizzy Gillespie Afro-Latin Experience
Jul;21;Berhana
Jul;22;Avery Wilson
Jul;23;Christian McBride & Ursa Major
Jul;24;Christian McBride & Ursa Major
Jul;25;Christian McBride & Ursa Major
Jul;27;Keyon Harrold
Jul;28;Keyon Harrold
Jul;30;ATOMIC HABITZ: Chris Dave x Marcus Strickland
Jul;31;Bob James
Aug;3;Sinead Harnett
Aug;4;Talib Kweli
Aug;5;Talib Kweli
Aug;6;Kenny Garrett
Aug;7;Kenny Garrett
Aug;8;Kenny Garrett
Aug;10;Brandon Woody's Upendo
Aug;11;Dizzy Gillespie All-Star Big Band
Aug;12;Dizzy Gillespie All-Star Big Band
Aug;13;Dizzy Gillespie All-Star Big Band
Aug;14;Dizzy Gillespie All-Star Big Band
Aug;17;Simon Phillips & Protocol 6
Aug;18;Simon Phillips & Protocol 6
Aug;19;Katalyst
Aug;20;Hiromi: The Piano Quintet
Aug;21;Hiromi: The Piano Quintet
Aug;22;Hiromi: The Piano Quintet
Aug;24;Stephan Moccio
Aug;25;Arturo Sandoval
Aug;26;Arturo Sandoval
Aug;27;Arturo Sandoval
Aug;28;Arturo Sandoval
Aug;31;Lizzie Berchie`;
for (const line of BN.split('\n')) {
  const [mon, d, title] = line.split(';').map((s) => s.trim());
  push({
    clubId: 'bluenote', title, date: iso(mon, Number(d)),
    sets: ['20:00', '22:30'], url: 'https://www.bluenotejazz.com/nyc/shows/',
  });
}

// ---- The Jazz Gallery (7 & 9 PM typical) ------------------------------------
const JG = `Jul;15;16;Miles Okazaki's "Boomtown" — Album Release;7,9;miles-okazaki-boomtown-jul-15-16-2026
Jul;17;17;Tyler Bullock Trio;7,9;tyler-bullock-jul-17-2026
Jul;18;18;Alexandra Ridout Quartet;7,9;alexandra-ridout-quartet-jul-18-2026
Jul;22;22;Ben Sherman Quartet;7,9;ben-sherman-jul-22-2026
Jul;23;23;Golden Hour Pop-Up: alana amore;;golden-hour-concert-series-alana-amore
Jul;23;23;William Hill III Trio;7,9;william-hill-iii-july-23-2026
Jul;24;24;Noah Garabedian Quintet;7,9;noah-garabedian-july-24-2026
Jul;25;25;Morgan Guerin;7,9;morgan-guerin-jul-25-2026
Jul;29;29;Jazz Composers' Showcase Vol. 22;7,9;jazz-composers-showcase-july-29-2026
Jul;30;30;Luke Marantz Trio;7,9;luke-marantz-trio-jul-30-2026
Jul;31;32;Charles Altura Quintet;7,9;charles-altura-jul-31-2026
Aug;5;5;The Trap Music Orchestra;7,9;trap-music-orchestra-aug-5-2026
Aug;6;6;Roy Hargrove Big Band Monthly Residency;7,9;rhbb-august-6-2026
Aug;7;8;NoMad Jazz Festival;;nomad-jazz-festival-aug7-8-2026
Aug;11;11;Cosmo Lieberman;7,9;cosmo-lieberman-aug-11-2026
Aug;13;13;Sylvie Courvoisier & Alden Hellmuth;7,9;alden-hellmuth-aug-13-2026
Aug;14;14;Jonathan Paik;7,9;jonathan-paik-aug-14-2026
Aug;18;18;Tomoko Omura Roots Quintet;7,9;tomoko-omura-aug-18-2026
Aug;19;19;Chris Morrissey Sans Vox Quintet;7,9;chris-morrissey-aug-19-2026
Aug;20;20;Golden Hour Pop-Up: Declan Sheehy-Moss;;golden-hour-concert-series-declan-shee
Aug;20;21;Mike Moreno;7,9;mike-moreno-aug-20-21-2026
Aug;22;22;Joel Ross & Friends;7,9;joel-ross-aug-22-2026`;
for (const line of JG.split('\n')) {
  const [mon, d1, d2, title, sets, slug] = line.split(';').map((s) => s.trim());
  let d = new Date(Date.UTC(YEAR, monthNum(mon) - 1, Number(d1)));
  const end = new Date(Date.UTC(YEAR, monthNum(mon) - 1, Number(d2)));
  while (d <= end) {
    push({
      clubId: 'jazzgallery', title,
      date: isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      sets: sets ? sets.split(',').map((h) => `${String(Number(h) + 12).padStart(2, '0')}:00`) : [],
      url: `https://jazzgallery.org/calendar/${slug}`,
    });
    d = new Date(d.getTime() + 86400000);
  }
}

// ---- demo personnel (from live excerpts, so the UI shows rosters pre-crawl) ---
const OKAZAKI = [
  ['Miles Okazaki','guitar'],['Caroline Davis','alto saxophone'],['Jon Irabagon','tenor saxophone'],
  ['Anna Webber','tenor saxophone'],['Jacob Garchik','trombone'],['Zekkereya El-Magharbel','trombone'],
  ['Hannah Marks','bass'],['Chris Tordini','bass'],['Matt Mitchell','piano'],['Dan Weiss','drums'],
].map(([name, instrument]) => ({ name, instrument }));
const FRISELL4 = [
  ['Bill Frisell','guitar'],['Greg Tardy','saxophone'],['Gerald Clayton','piano'],['Johnathan Blake','drums'],
].map(([name, instrument]) => ({ name, instrument }));
for (const e of events) {
  if (/okazaki/i.test(e.title)) e.personnel = OKAZAKI;
  if (/frisell four/i.test(e.title)) e.personnel = FRISELL4;
}

// ---- write ------------------------------------------------------------------
const byId = new Map(events.map((e) => [e.id, e]));
const sorted = [...byId.values()].sort(
  (a, b) => a.date.localeCompare(b.date) || (a.sets[0] ?? '99').localeCompare(b.sets[0] ?? '99')
);
await mkdir(OUT_DIR, { recursive: true });
const cities = [...new Set(CLUBS.map((c) => c.city))];
for (const city of cities) {
  const cityClubs = CLUBS.filter((c) => c.city === city);
  const ids = new Set(cityClubs.map((c) => c.id));
  const out = {
    generatedAt: new Date().toISOString(),
    source: 'bootstrap snapshot captured 2026-07-13 — run `npm run crawl` for live data',
    city,
    clubs: cityClubs.map(({ module, ...pub }) => pub),
    errors: [],
    events: sorted.filter((e) => ids.has(e.clubId)),
  };
  await writeFile(join(OUT_DIR, `events-${city}.json`), JSON.stringify(out, null, 2));
  if (city === 'nyc') await writeFile(join(OUT_DIR, 'events.json'), JSON.stringify(out, null, 2));
  console.log(`seeded ${out.events.length} events -> events-${city}.json`);
}
