# jazzlineup.com 🎷

**Live at [jazzlineup.com](https://jazzlineup.com).** One calendar for live
jazz: who's playing tonight across 64 venues in New York, Los Angeles,
Chicago, the Bay Area, and Paris, from the Village Vanguard to a medieval
swing cellar on the rue de la Huchette. A
zero-dependency crawler checks every venue's site around the clock,
normalizes the chaos into one feed, and a static React frontend serves it
fast from CloudFront. No ads, no accounts.

## What it does

- **29 NYC venues** across Manhattan, Harlem, Brooklyn, and Queens,
  **13 LA venues** from the Hollywood Bowl to hotel bars, **9 Chicago
  venues** from the Green Mill to the creative-music lofts, **6 Bay
  Area venues** from SFJAZZ to a Glen Park bookshop, and **7 Paris venues**
  across the rue des Lombards triangle, the Marais, and the Latin Quarter.
  City switcher in the wordmark; borough scopes for New York; 24-hour set
  times for European cities.
- **Artist search**: type a musician's name and see every date they're on,
  matched against titles, band rosters, and descriptions, accents ignored.
  When the other city has matches too, one tap switches with the query intact.
- **Venue chips** in colors drawn from each club's real identity (the
  Vanguard's red neon, Smalls' crimson). Click one to see just that club,
  click more to add. Drag to reorder; your order and selection persist
  per city in localStorage.
- **Band personnel** rendered like a concert program, grouped by instrument
  for big bands. Late sets that start after midnight are attributed to the
  evening they belong to, with a quiet "late" tag.
- Month calendar and list views, mobile-first, black and gold.

## Quick start

```bash
npm install        # frontend deps only; crawler and server are dependency-free
npm run crawl      # crawl every venue -> data/events-<city>.json (~60s)
npm run build:web  # build the React frontend
npm run serve      # http://localhost:3000
```

Frontend development with hot reload:

```bash
npm run serve      # serves data + built site on :3000 (terminal 1)
npm run dev:web    # Vite on :5173, proxies data requests to :3000 (terminal 2)
```

## Architecture

```
                    every 4 hours
EventBridge ──────▶ Lambda (crawler) ──────▶ S3 (events-<city>.json per city)
                                                       ▲            │
                                     web/dist (React) ─┘            ▼
                                                              CloudFront ◀── visitors
```

Production is fully static: the crawler Lambda writes per-city JSON files to
S3 and the frontend fetches them as plain files. There is no server to scale
and nothing to load-balance. The whole stack is defined in CDK (`infra/`),
deploys with one command, and runs inside the AWS free tier. Monitoring is
CloudWatch: a traffic and crawler-health dashboard, email alarms for crawler
failures, site 5xx spikes, per-club parser drift, and a billing tripwire.
Runbook in [DEPLOY.md](DEPLOY.md).

The three stages stay deliberately decoupled:

- **Crawler** (`crawler/`): one module per venue (some modules serve sister
  venues that share a platform), each exporting `crawl()` plus a pure
  `parse()` unit-tested against fixture markup. Zero npm dependencies, bare
  Node 20+. Venues register in `crawler/clubs.js` with city, borough,
  timezone, and an audit-checked chip color. Per-club failure isolation: a
  broken site keeps its last good data and records an error; it never takes
  the feed down.
- **Server** (`server/`): dependency-free `node:http` server for local dev.
  Reads the data files fresh per request.
- **Web** (`web/`): Vite + React, no state library, no CSS framework.

## Venue sources, by shape

Sixty-four venues resolve to about fifteen source patterns:

| Pattern | Examples |
| --- | --- |
| JSON APIs (Squarespace collections, ViewCy, Tockify, DICE, TicketWeb, Turntable, tribe REST, JSON-LD, custom WP routes) | Jazz Gallery, Barbès, Close Up, Smoke, The Pocket, World Stage, Zebulon, Jazz Showcase, Elastic Arts, Black Cat, Keys, Mr. Tipple's, SFJAZZ, Sunset + Sunside, New Morning |
| Server-rendered HTML, parsed with targeted regex (no DOM library) | Village Vanguard, Blue Note, The Django, Ornithology, Roulette, Silvana + Shrine, LACMA, Green Mill, Andy's, Dorian's, Yoshi's, Duc des Lombards, Bal Blomet, 38 Riv, Caveau de la Huchette |
| Venue feeds with genre tags, filtered to jazz | Hollywood Bowl + Disney Hall + The Ford (one LA Phil feed) |
| Mixed-genre rooms, filtered to jazz by keyword or genre tag | The Mint, Zebulon, Gold-Diggers, JCAL, Shrine, Constellation + Hungry Brain, SPACE |
| Standing residencies, generated on a schedule | Arthur's Tavern, Bill's Place, Marjorie Eliot's Parlor Jazz, Bird & Beckett |

The principle: the site curates jazz **events**, not jazz venues. A rock club
with a Monday jazz hang lists the hang and nothing else.

## Event schema

```json
{
  "id": "smalls:2026-07-13:ari-hoenig-trio",
  "clubId": "smalls",
  "title": "Ari Hoenig Trio",
  "date": "2026-07-13",
  "sets": ["19:30", "21:00"],
  "url": "https://www.smallslive.com/events/33032-ari-hoenig-trio/",
  "details": null,
  "personnel": [{ "name": "Ari Hoenig", "instrument": "drums" }],
  "late": false,
  "priceText": "$25"
}
```

## Testing

```bash
node crawler/test.mjs   # 66 parser + merge-logic test groups, no network
node web/test-ui.mjs    # 16 Playwright UI tests, desktop + mobile viewports
```

Every parser has fixture tests mirroring the venue's real markup. The UI
suite covers filtering, search, drag-to-reorder, persistence, and mobile
layout. Both run before anything ships.

## Development notes

- `npm run crawl -- --club smalls` crawls one venue; `--city la` one city.
- Crawlers send a descriptive User-Agent and sleep between paginated
  requests. Keep it polite, these are small clubs.
- `web/build-offline.mjs` builds the frontend without the npm registry
  (sandboxed environments only); use Vite normally.
- Venue colors are chosen against a perceptual-distance audit so no two
  chips in a city collide. Run the audit before adding a venue.

## Roadmap

Chicago, San Francisco, and Paris all landed the same week (the Green
Mill's calendar really did have full band rosters hiding in its
add-to-calendar links). Tokyo is next and gets a dedicated
internationalization pass first; jazz festivals join as seasonal venues.
Nearer term: iCal export, a "new this week" page, saved artists with email
alerts. Full detail in [ROADMAP.md](ROADMAP.md).
