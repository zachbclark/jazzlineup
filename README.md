# jazzlineup.com

One calendar for live jazz: who's playing tonight across 105 venues in
10 cities. New York, Los Angeles, Chicago, San Francisco, Boston,
New Orleans, Paris, London, Berlin, Tokyo.

**Live at [jazzlineup.com](https://jazzlineup.com).** No ads, no
accounts, no cookies.

## How it works

A zero-dependency Node crawler reads each venue's public calendar every
4 hours and writes one JSON feed per city. A static React frontend
serves them from CloudFront. Infra is CDK, deployed by GitHub Actions
on merge to main.

- `crawler/` one module per venue: `crawl()` fetches, `parse()` is pure
  and fixture-tested. Venues register in `crawler/clubs.js`.
- `web/` React frontend. `server/` dependency-free dev server.
- `data/` one `events-<city>.json` per city.

## Develop

```bash
npm install
npm run crawl        # all cities; --city nyc or --club smalls to narrow
npm run build:web
npm run serve        # localhost:3000

node crawler/test.mjs   # parser tests
node web/test-ui.mjs    # Playwright UI tests
```

## Events

```json
{
  "id": "smalls:2026-07-13:ari-hoenig-trio",
  "clubId": "smalls",
  "title": "Ari Hoenig Trio",
  "date": "2026-07-13",
  "sets": ["19:30", "21:00"],
  "url": "https://www.smallslive.com/events/33032-ari-hoenig-trio/",
  "personnel": [{ "name": "Ari Hoenig", "instrument": "drums" }],
  "priceText": "$25"
}
```

The per-city feeds are public. If you build on them, link back to the
site and be gentle.

## Venues

This site lists shows, not venues. If a room books shows worth seeing,
it belongs here. Jazz clubs are in wholesale; mixed-genre rooms are
filtered to their jazz nights. The musicians you love play rooms you'd
never think to check. Conventions and parsing lessons:
[NOTES.md](NOTES.md). Know a room that belongs here? Use the
suggest-a-venue link in the site footer.
