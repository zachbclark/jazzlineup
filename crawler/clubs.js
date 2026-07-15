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
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'West Village',
    color: '#ff453a', // the red neon sign on 7th Ave
    module: './clubs/vanguard.js',
  },
  {
    id: 'bluenote',
    name: 'Blue Note',
    shortName: 'Blue Note',
    url: 'https://www.bluenotejazz.com/nyc',
    address: '131 W 3rd St, New York, NY 10012',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'Greenwich Village',
    color: '#4d9bff', // the name — azure, brightened from their navy
    module: './clubs/bluenote.js',
  },
  {
    id: 'smalls',
    name: 'Smalls Jazz Club',
    shortName: 'Smalls',
    url: 'https://www.smallslive.com',
    address: '183 W 10th St, New York, NY 10014',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'West Village',
    color: '#e8355f', // SmallsLive brand crimson #d21535, glow-tuned
    module: './clubs/smalls.js',
  },
  {
    id: 'mezzrow',
    name: 'Mezzrow',
    shortName: 'Mezzrow',
    url: 'https://www.smallslive.com',
    address: '163 W 10th St, New York, NY 10014',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'West Village',
    color: '#f1bb53', // SmallsLive brand gold, kept as-is
    module: './clubs/smalls.js', // same source feed as Smalls
  },
  {
    id: 'birdland',
    name: 'Birdland',
    shortName: 'Birdland',
    url: 'https://birdlandjazz.com',
    address: '315 W 44th St, New York, NY 10036',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'Theater District',
    color: '#f2788c', // birdlandjazz.com brand rose #e7737f
    module: './clubs/birdland.js',
  },
  {
    id: 'dizzys',
    name: "Dizzy's Club",
    shortName: "Dizzy's",
    url: 'https://jazz.org/dizzys',
    address: '10 Columbus Cir, New York, NY 10019',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'Columbus Circle',
    color: '#ffa042', // the amber room + sunset behind the stage glass
    module: './clubs/dizzys.js',
  },
  {
    id: 'jazzcultural',
    name: 'Jazz Cultural Theater',
    shortName: 'Jazz Cultural',
    url: 'https://www.jazzcultural.com',
    address: '184 W 10th St, New York, NY 10014',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'West Village',
    color: '#4a6ff5', // SmallsLive brand royal blue #1055c9, brightened
    module: './clubs/smalls.js', // same SmallsLive feed as Smalls/Mezzrow
  },
  {
    id: 'smoke',
    name: 'Smoke Jazz Club',
    shortName: 'Smoke',
    url: 'https://www.smokejazz.com',
    address: '2751 Broadway, New York, NY 10025',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'Upper West Side',
    color: '#9fb6c9', // the name; NB their site brand is red #c51403 if Zach prefers
    module: './clubs/smoke.js',
  },
  {
    id: 'nublu',
    name: 'Nublu 151',
    shortName: 'Nublu',
    url: 'https://nublu.net/program151',
    address: '151 Avenue C, New York, NY 10009',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'Alphabet City',
    color: '#35d0e0', // the famous blue light over the unmarked door
    module: './clubs/nublu.js',
  },
  {
    id: 'lunatico',
    name: 'Bar LunÀtico',
    shortName: 'LunÀtico',
    url: 'https://www.barlunatico.com/music',
    address: '486 Halsey St, Brooklyn, NY 11233',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'Bed-Stuy',
    color: '#45c4b5', // barlunatico.com brand teal #4c948b, brightened
    module: './clubs/lunatico.js',
  },
  {
    id: 'jazzgallery',
    name: 'The Jazz Gallery',
    shortName: 'Jazz Gallery',
    url: 'https://jazzgallery.org',
    address: '1158 Broadway, 5th Fl, New York, NY 10001',
    city: 'nyc',
    timezone: 'America/New_York',
    neighborhood: 'NoMad',
    color: '#c96a4a', // their brand dark red #941100 shifted to rust (Vanguard owns red)
    module: './clubs/jazzgallery.js',
  },
];

export function clubById(id) {
  return CLUBS.find((c) => c.id === id);
}
