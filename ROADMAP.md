# Roadmap

Live jazz aggregator — NYC first, then LA, Paris, Berlin. Mobile is essential.

## Design principles (Zach, 2026-07-15)

- **CLEAN UI IS PARAMOUNT.** Black + gold, meaningful club colors, beauty in
  simplicity. No images under artist names (considered, rejected).
- Save space everywhere on mobile; dots not names on phones (names maybe at
  an iPad breakpoint).
- Tiles fit the mission — favor tile-based interaction patterns.
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
- [x] Name chosen: **jazzlineup.com** (2026-07-14)
- [x] Registered jazzlineup.com (Cloudflare)
- [x] Rebrand app to Jazz Lineup · NYC

## Phase 1 — Mobile + ship NYC
- [x] **Mobile-first pass (2026-07-14):** list view (tonight first) is the
      default on phones; month grid becomes a compact tappable dot-calendar;
      thumb-sized targets; horizontally scrollable filter chips; floating
      "Tonight" jump button; calendar cells show concise main-artist names
- [ ] Test real widths (iPhone SE → Pro Max, Android); Lighthouse mobile pass
- [x] Tap a day in calendar mode → full-day panel incl. band personnel (auto-scrolls into view)
- [x] **DEPLOYED 2026-07-14: https://jazzlineup.com is live.** S3 + CloudFront
      + ACM TLS; crawler Lambda on EventBridge every 4h; 565 events on first
      production crawl, 0 errors. CDK stack in `infra/`, runbook in DEPLOY.md
- [ ] Lightweight privacy-friendly analytics — also decides an open question:
      is list mode used enough to keep, or does it move behind a settings icon?

## Quality & Testing (Zach's priority 2026-07-15: "everything looks right and has good testing")

- [ ] UI test suite (Playwright): loads, calendar default, day drawer opens,
      filters change counts, mobile list/dots render — `npm run test:ui`
- [ ] Integration tests for the crawl merge (zero-guard, failure keeps
      previous data, dedupe, sort) — pure-function refactor of run.js
- [ ] UI formatting audit at phone width — first finding: Jazz Gallery
      big-band personnel (10 players) breaks mobile layout; grouped roster
      must flow compactly on small screens
- [ ] Architecture diagrams generated from the actual code (system,
      data-flow, per-crawler map) — good pre-Brian onboarding doc
- [ ] Late-night attribution: shift after-midnight starts (12:00–4:59am) to
      the previous day with a "late" marker (DECIDE: Zach floated 11pm too;
      Claude recommends midnight cutoff only)
- [ ] Footer: "Updated Xh ago" (smaller, relative time), version stamp

## Phase 2 — Depth: filtering that scales
- [ ] +5–10 NYC clubs (Smoke, Ornithology, Bar Bayeux, Zinc Bar, The Stone…)
- [ ] Venue-first navigation concepts (from the "Bandstand" notes): favorite
      venues as the organizing principle; venue search; maybe a venue map
      per city. NAME "Bandstand"/"Venyou"/"Encore" considered and PARKED —
      jazzlineup.com stands; revisit only if the venue-first pivot deepens
- [ ] Venue/question submission form (needs SES from Phase 3)
- [ ] **Filter UI for scale (tile concept):** club tiles with a favorite
      star, drag-and-drop ordering (inline or in a dropdown), favorites
      pinned first; dropdown checkbox list with select-all/deselect-all as
      club count grows; two-row stacked chips on mobile meanwhile; persist
      favorites + ordering in localStorage
- [x] **Structured personnel (2026-07-15):** crawlers parse "name – instrument"
      pairs into personnel[] (Jazz Gallery + Vanguard carry rosters); UI
      renders a concert program — inline for small groups, grouped by
      instrument for big bands; promo noise stripped. Foundation in place
      for artist search + saved-artist notifications
- [ ] Quick polish batch: "Data crawled" → "Updated Xh ago"; Calendar/List
      toggle as one compact icon button; share-card (og.png) redesign once
      brand font is settled (current one reads corny)
- [ ] Artist search (title + personnel text)
- [ ] "New this week" page via `firstSeenAt` diff of consecutive crawls
- [ ] iCal export / add-to-calendar per show

## Phase 3 — Personalization
- [ ] Favorites persist (localStorage; no accounts yet)
- [ ] Saved artists + email notifications (DynamoDB subscribers + SES,
      triggered by the post-crawl diff — same diff as "New this week")
- [ ] Manual "refresh data" button with a takes-a-while warning

## Phase 4 — Multi-city: LA → Paris → Berlin
- [ ] URL structure `/nyc`, `/la` + city switcher where the NYC badge sits —
      make the NYC button pop (angled?) and open a city dropdown
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

## Brand simmer (open, non-blocking)

- [ ] "More metallic / horn-like" color treatment (gradient wordmark?);
      modern font question stays open — current: Abril Fatface + brass #d6a071
- [ ] Dim ornate f-hole curves (like a bass) as corner/border ornament —
      prototype as SVG, pairs with commissioned-art item
- [ ] Venue colors: Zach to review each venue's color individually
      (first-pass palette is researched + commented in crawler/clubs.js)

## With Brian (second admin)

- [ ] Security review: S3/CloudFront policies, IAM least-privilege (replace
      AdministratorAccess users with scoped roles), dependency audit
- [ ] Failsafe/infra review: CloudWatch alarm on crawler failures (SNS email),
      backup strategy for events.json history, cdk best practices

## Someday / big swings

- [ ] Sister site for classical / opera / ballet — the crawler + registry +
      calendar machinery is genre-agnostic; new venue registry, new skin,
      new domain (Lincoln Center, Carnegie, the Met…)
