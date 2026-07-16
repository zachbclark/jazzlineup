// Known-artist safety net for mixed-genre venues WITHOUT genre tags.
// A title like "Bill Frisell" contains no jazz keyword; this list rescues
// shows whose artist we know regardless of billing. Used as an OR-condition
// by keyword filters — it can only ADD events, never drop them.
// Curation: working jazz artists likely to play mixed rooms. Multi-word
// names only (single words like "Bird" would false-positive). Matching is
// accent- and case-insensitive substring over title + description.
// Maintained by hand; additions welcome, deletions rare.
const ARTISTS = [
  // Zach's core cohort + their bands
  'paul cornish', 'immanuel wilkins', 'chris fishman', 'mark turner',
  'walter smith', 'ben street', 'harish raghavan', 'jonathan pinson',
  'marcus gilmore', 'ethan iverson', 'jason palmer', 'charles altura',
  'larry grenadier', 'billy hart', 'joe martin', 'kurt rosenwinkel',
  // guitar
  'bill frisell', 'pat metheny', 'john scofield', 'julian lage',
  'mary halvorson', 'gilad hekselman', 'peter bernstein', 'jeff parker',
  'miles okazaki', 'rez abbasi', 'romain pilon', 'lionel loueke',
  // piano / keys
  'brad mehldau', 'kenny barron', 'herbie hancock', 'vijay iyer',
  'jason moran', 'fred hersch', 'sullivan fortner', 'gerald clayton',
  'aaron parks', 'craig taborn', 'kris davis', 'david virelles',
  'emmet cohen', 'micah thomas', 'james francies', 'kevin hays',
  'shai maestro', 'tigran hamasyan', 'robert glasper', 'jason lindner',
  'marta sanchez', 'sylvie courvoisier', 'aaron goldberg', 'ethan cohn',
  // saxophone / winds
  'joshua redman', 'chris potter', 'joe lovano', 'branford marsalis',
  'kenny garrett', 'ravi coltrane', 'melissa aldana', 'chris speed',
  'dayna stephens', 'john ellis', 'ben wendel', 'donny mccaslin',
  'james brandon lewis', 'isaiah collier', 'shabaka hutchings',
  'nubya garcia', 'emma-jean thackray', 'logan richardson', 'steve lehman',
  'miguel zenon', 'rudresh mahanthappa', 'tim berne', 'oded tzur',
  'anna webber', 'maria grand', 'nicole glover', 'sam gendel',
  // trumpet / brass
  'wynton marsalis', 'ambrose akinmusire', 'terence blanchard',
  'christian scott', 'chief adjuah', 'keyon harrold', 'marquis hill',
  'adam o’farrill', 'adam ofarrill', 'peter evans', 'jaimie branch',
  'theo croker', 'giveton gelin', 'hermon mehari', 'avishai cohen',
  'steven bernstein', 'jeremy pelt', 'roy hargrove',
  // bass
  'christian mcbride', 'ron carter', 'dave holland', 'linda may han oh',
  'esperanza spalding', 'thomas morgan', 'matt brewer', 'joe sanders',
  'vicente archer', 'derrick hodge', 'burniss travis', 'dezron douglas',
  // drums
  'brian blade', 'eric harland', 'kendrick scott', 'marcus baylor',
  'johnathan blake', 'justin brown', 'jeff ballard', 'nasheet waits',
  'tyshawn sorey', 'makaya mccraven', 'antonio sanchez', 'terri lyne carrington',
  'joey baron', 'kassa overall', 'jamire williams', 'savannah harris',
  'bill stewart', 'al foster', 'ferenc nemeth', 'jochen rueckert',
  // vibes / other
  'joel ross', 'sasha berliner', 'stefon harris', 'simon moullier',
  // vocals
  'cecile mclorin salvant', 'samara joy', 'kurt elling', 'gregory porter',
  'jazzmeia horn', 'veronica swift', 'dianne reeves', 'jose james',
  // elders + institutions
  'charles lloyd', 'archie shepp', 'abdullah ibrahim', 'kenny burrell',
  'louis hayes', 'george coleman', 'billy childs', 'john zorn',
  'amina figarova', 'rick margitza', 'omar sosa', 'david murray',
  'rebirth brass band', 'ted byrnes', 'tortoise', // audit finds 2026-07-16 (Tortoise = Jeff Parker's band; veto-able)
  'william parker', 'matthew shipp', 'james carter', 'marc ribot',
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();
const NORMED = ARTISTS.map(norm);

export function matchesKnownArtist(text) {
  const hay = norm(text);
  return NORMED.some((a) => hay.includes(a));
}
