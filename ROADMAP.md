# Roadmap

Live jazz aggregator — NYC first, then LA, Paris, Berlin. Mobile is essential.
Cost target: run the whole thing inside the AWS free tier (see README for the
architecture; realistic bill is <$1/mo even at 50+ clubs — the scarce resource
is parser maintenance, so invest in sanity checks + alerting, not infra).

## Phase 0 — Validate the core (now)
- [ ] First live crawl on a real network: `node crawler/index.js`; fix breakage
      (Vanguard + Birdland parsers are the ones built from reconstructed markup)
- [ ] Wire `npm test` to Node's built-in test runner; add edge-case parser tests
      informed by the live crawl
- [ ] Crawl sanity checks: event count vs. previous run, plausible date range,
      no duplicate IDs, % events with sets/urls → mark club "suspect" and keep
      last good data instead of shipping garbage
- [ ] Add `city` + `timezone` fields to the club registry NOW (trivial today,
      painful after 30 clubs; dates are currently NY-local)
- [ ] Pick + register domain (shortlist checked available 2026-07-13:
      jazzlineup.com ★, thejazzcal.com, myjazzcal.com, jazzmarquee.com,
      tonightsbill.com, setlistnyc.com, nycjazzcal.com, findthegig.com;
      jazzcal.com is taken/parked)
- [ ] Rebrand app to the final name

## Phase 1 — Mobile + ship NYC
- [ ] **Mobile-first pass (ESSENTIAL):** list/agenda view default on small
      screens (month grid is hostile on phones), swipeable week strip,
      44px touch targets, horizontally scrollable filter chips,
      sticky "Tonight" jump button
- [ ] Test real widths (iPhone SE → Pro Max, Android); Lighthouse mobile pass
- [ ] Tap a day in calendar mode → full-day panel incl. band personnel
- [ ] Deploy: S3 + CloudFront + domain + HTTPS; crawler Lambda on EventBridge
      (`rate(4 hours)`), events.json served as a static file (no API server
      needed in prod — frontend filters client-side)
- [ ] Lightweight privacy-friendly analytics

## Phase 2 — Depth: filtering that scales
- [ ] +5–10 NYC clubs (Smoke, Ornithology, Bar Bayeux, Zinc Bar, The Stone…)
- [ ] Filter UI for scale: searchable club picker, neighborhood grouping,
      favoritable clubs pinned to top
- [ ] Artist search (title + personnel text)
- [ ] "New this week" page via `firstSeenAt` diff of consecutive crawls
- [ ] iCal export / add-to-calendar per show

## Phase 3 — Personalization
- [ ] Favorites persist (localStorage; no accounts yet)
- [ ] Saved artists + email notifications (DynamoDB subscribers + SES,
      triggered by the post-crawl diff — same diff as "New this week")
- [ ] Manual "refresh data" button with a takes-a-while warning

## Phase 4 — Multi-city: LA → Paris → Berlin
- [ ] URL structure `/nyc`, `/la` + city switcher where the NYC badge sits
- [ ] Per-city data files (`events-nyc.json`, `events-la.json`) + per-city
      crawl schedules
- [ ] LA club recon + crawlers (Catalina, Sam First, The Baked Potato,
      World Stage…)
- [ ] Paris/Berlin repeat the LA playbook (timezone correctness matters here —
      covered by the Phase 0 registry fields)

## Ongoing
- [ ] Markup-drift alerting: notify (email/webhook) after N consecutive failed
      or suspect crawls for a club
- [ ] Crawler politeness: descriptive UA, delays, cache/etag use where possible
