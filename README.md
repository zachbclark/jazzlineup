# jazzlineup.com 🎷

One calendar for live jazz in New York. Crawls the schedules of six NYC jazz
clubs, normalizes them into a single feed, and serves a filterable
calendar/list UI.

**Clubs covered:** Village Vanguard, Blue Note, Smalls, Mezzrow, Birdland
(Jazz Club + Theater), Dizzy's Club, The Jazz Gallery.

## Quick start

```bash
npm install        # installs Vite/React for the frontend (crawler & server have zero deps)
npm run crawl      # crawl all six club sites -> data/events.json (~30s)
npm run build:web  # build the React frontend
npm run serve      # http://localhost:3000
```

For frontend development with hot reload:

```bash
npm run serve      # API on :3000 (terminal 1)
npm run dev:web    # Vite dev server on :5173, proxies /api -> :3000 (terminal 2)
```

The repo ships with a `data/events.json` snapshot of real shows (captured
July 13, 2026) so the UI works before your first crawl.

## Architecture

```
┌──────────────┐   every few hours   ┌──────────────────┐
│ club websites │ ──── npm run crawl ──▶ data/events.json │
└──────────────┘                     └────────┬─────────┘
                                              │ read fresh on every request
                                     ┌────────▼─────────┐      ┌──────────┐
                                     │ server (node:http)│ ◀──── │ React UI │
                                     │  /api/events      │      │ calendar │
                                     │  /api/clubs       │      │ + list   │
                                     └───────────────────┘      └──────────┘
```

The three stages are deliberately decoupled:

- **Crawler** (`crawler/`): one module per club, each exporting `crawl()` and a
  pure `parse()` that is unit-tested against fixture markup (`node crawler/test.mjs`).
  Zero npm dependencies — bare Node ≥ 20. Clubs are registered in
  `crawler/clubs.js`. If one site breaks, the others still update; the last
  good data for the broken club is kept and the error is recorded in
  `data/events.json` → `errors`.
- **Server** (`server/`): zero-dependency `node:http` server. Reads
  `events.json` fresh per request, so a finished crawl is visible on the next
  page load — no rebuild or restart.
- **Web** (`web/`): Vite + React. Month-grid calendar and chronological list,
  club filter chips, links out to each club's ticketing.

### Per-club crawl strategy

| Club | Source | Notes |
| --- | --- | --- |
| Smalls + Mezzrow | `smallslive.com/search/upcoming-ajax/?page=N` | JSON endpoint returning HTML template; paginated |
| The Jazz Gallery | `jazzgallery.org/calendar?format=json` | Squarespace collection JSON; multi-day runs expanded |
| Blue Note | `/nyc/shows/?calendar_view&month=M&yr=Y` | server-rendered month table; crawls current + next month |
| Birdland | homepage + `/page/N/` | TicketWeb WP plugin cards; Theater shows tagged |
| Dizzy's Club | `jazz.org/dizzys` | server-rendered season list; house set times (Mon-Sat 7 & 9, Sun 5 & 7:30) |
| Village Vanguard | homepage | artist + date-range blocks expanded nightly; 8 & 10 PM sets; VJO every Monday |

### Event schema

Every event normalizes to:

```json
{
  "id": "smalls:2026-07-13:ari-hoenig-trio",
  "clubId": "smalls",
  "title": "Ari Hoenig Trio",
  "date": "2026-07-13",
  "sets": ["18:00", "19:30"],
  "url": "https://www.smallslive.com/events/33032-ari-hoenig-trio/",
  "details": null,
  "priceText": null
}
```

## Keeping data fresh

Run the crawler on a schedule. On macOS the simplest is cron:

```bash
crontab -e
# every 3 hours:
0 */3 * * * cd ~/github/jazzlineup && /usr/local/bin/node crawler/index.js >> /tmp/jazzlineup-crawl.log 2>&1
```

Reloading the site or changing filters always reflects the latest completed
crawl (the API never caches), but does not itself trigger a crawl.

## Deploying to AWS (the intended evolution)

The pieces map 1:1 onto serverless AWS:

1. **Crawler → Lambda + EventBridge.** `crawler/index.js` already isolates
   per-club failures and writes a single JSON artifact; point `--out` at
   `/tmp` and upload to S3. Schedule with an EventBridge rule (e.g. `rate(3 hours)`).
2. **Data → S3.** `data/events.json` becomes `s3://your-bucket/events.json`.
3. **API → CloudFront + S3** (simplest: the frontend fetches `events.json`
   directly and filters client-side, which this UI already does) or API
   Gateway + a tiny Lambda if you want server-side filtering.
4. **Frontend → S3 + CloudFront.** `npm run build:web`, sync `web/dist` to S3.

No servers to patch; the whole thing runs in the free tier at this traffic.

## Development notes

- `npm run crawl -- --club smalls` crawls one club.
- `node crawler/test.mjs` runs parser tests (no network needed).
- `scripts/seed-from-capture.mjs` regenerates the bundled demo snapshot.
- `web/build-offline.mjs` builds the frontend without npm using globally
  installed react + typescript — only needed in sandboxed environments where
  the npm registry is unreachable; use Vite normally.
- Crawlers send a descriptive User-Agent and sleep between paginated
  requests. Please keep it polite — these are small clubs.

## Roadmap

- [ ] "Refresh now" button in the UI (with a heads-up that a crawl takes ~30s)
- [ ] More clubs: Smoke, The Stone, Ornithology, Bar Bayeux, Zinc Bar…
- [ ] Filter by neighborhood / time of night (early vs late sets)
- [ ] iCal export & "tonight" email digest
- [ ] AWS deployment (see above)
