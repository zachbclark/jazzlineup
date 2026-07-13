// Registry of clubs. Each crawler module exports:
//   crawl()      -> fetches live pages and returns events[]
//   parse(input) -> pure function(s) used by crawl(), testable against fixtures
export const CLUBS = [
  {
    id: 'vanguard',
    name: 'Village Vanguard',
    shortName: 'Vanguard',
    url: 'https://villagevanguard.com',
    address: '178 7th Ave S, New York, NY 10014',
    neighborhood: 'West Village',
    color: '#c0392b',
    module: './clubs/vanguard.js',
  },
  {
    id: 'bluenote',
    name: 'Blue Note',
    shortName: 'Blue Note',
    url: 'https://www.bluenotejazz.com/nyc',
    address: '131 W 3rd St, New York, NY 10012',
    neighborhood: 'Greenwich Village',
    color: '#2c5f9e',
    module: './clubs/bluenote.js',
  },
  {
    id: 'smalls',
    name: 'Smalls Jazz Club',
    shortName: 'Smalls',
    url: 'https://www.smallslive.com',
    address: '183 W 10th St, New York, NY 10014',
    neighborhood: 'West Village',
    color: '#8e44ad',
    module: './clubs/smalls.js',
  },
  {
    id: 'mezzrow',
    name: 'Mezzrow',
    shortName: 'Mezzrow',
    url: 'https://www.smallslive.com',
    address: '163 W 10th St, New York, NY 10014',
    neighborhood: 'West Village',
    color: '#b07cc6',
    module: './clubs/smalls.js', // same source feed as Smalls
  },
  {
    id: 'birdland',
    name: 'Birdland',
    shortName: 'Birdland',
    url: 'https://birdlandjazz.com',
    address: '315 W 44th St, New York, NY 10036',
    neighborhood: 'Theater District',
    color: '#27ae60',
    module: './clubs/birdland.js',
  },
  {
    id: 'dizzys',
    name: "Dizzy's Club",
    shortName: "Dizzy's",
    url: 'https://jazz.org/dizzys',
    address: '10 Columbus Cir, New York, NY 10019',
    neighborhood: 'Columbus Circle',
    color: '#e67e22',
    module: './clubs/dizzys.js',
  },
  {
    id: 'jazzgallery',
    name: 'The Jazz Gallery',
    shortName: 'Jazz Gallery',
    url: 'https://jazzgallery.org',
    address: '1158 Broadway, 5th Fl, New York, NY 10001',
    neighborhood: 'NoMad',
    color: '#16a085',
    module: './clubs/jazzgallery.js',
  },
];

export function clubById(id) {
  return CLUBS.find((c) => c.id === id);
}
