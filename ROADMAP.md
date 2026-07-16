# Roadmap

Live jazz aggregator — NYC first, then LA, Paris, Berlin. Mobile is essential.

## Design principles (Zach, 2026-07-15)

- **NYC TAKES PRIORITY, ALWAYS.** Other cities and genres are expansions;
  NYC data quality and polish come first in any tradeoff.

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
- [x] Late-night attribution (2026-07-15): after-midnight starts (12:00–4:59am)
      shift to the previous evening with a "late" tag, sorted to the end of
      the night. Applies to exact-datetime sources (Smoke, LunÀtico);
      night-grouped sources (SmallsLive) already attribute correctly.
      Midnight cutoff chosen (11pm shows stay on their own evening)
- [ ] Footer: "Updated Xh ago" (smaller, relative time), version stamp

## THE NYC JAZZ APP — venue build-out (greenlit 2026-07-15)

Goal: the definitive NYC jazz listing. ~30 venues. Borough field added to the
registry (manhattan / brooklyn / queens / harlem as its own world); Phase 2
filter tiles group by borough.

North star for curation (Zach, 2026-07-15): **the young generation carries
jazz** — track where players like Paul Cornish, Immanuel Wilkins, Chris
Fishman, Mark Turner, Walter Smith III, Ben Street, Harish Raghavan actually
play: musician-run rooms (Close Up), Jazz Gallery, the Vanguard, the schools.

Tier 1 — DONE 2026-07-15 (11 crawlers, site now 22 clubs):
- [x] The Django (Tribeca) · Cellar Dog (W Vil) · Arthur's Tavern (W Vil)
- [x] Zinc Bar (Village) · Barbès (Park Slope) · Ornithology club + cafe (Bushwick)
- [x] Bar Bayeux (Prospect Lefferts) · The Pocket (46th St — Zach's add)
- [x] Close Up (LES — the young-scene room) · Bill's Place (Harlem residency)
- Closed venues verified & dropped: Minton's, The Owl, Room 623 (all
  permanently closed); Soapbox Gallery dormant (one monthly series — recheck)
- [x] Borough filter UI: All · Manhattan · Brooklyn above the venue chips

Conservatory calendars (START IN SEPTEMBER — summer break now, seasons launch
Sep; structures are crawlable):
- [ ] Juilliard Jazz (Drupal views rows) · Manhattan School of Music ·
      The New School / The Stone series — filter to jazz-only

Round 2 — DONE 2026-07-15 (NYC 24 clubs, boroughs now M/BK/Q):
- [x] Roulette Intermedium (Downtown BK — experimental anchor)
- [x] JCAL Jamaica Center (QUEENS — first queens venue; mixed arts center,
      jazz-keyword filtered)

Tier 2 round 1 — DONE 2026-07-16 (NYC 29 clubs):
- [x] Harlem: Silvana + Shrine (shared homegrown calendar.php, jazz-filtered)
- [x] Sugar Hill: Marjorie Eliot's Parlor Jazz (generator — Sundays 3:30,
      free, no website since 1992 and proud of it)
- [x] Bed-Stuy: Sistas' Place (homepage featured-event widget; Saturdays)
- [x] Queens: Terraza 7 (Wix events warmup, shared extractor with Sam First)
- Verified closed, dropped: Showman's (1942–, Yelp: permanently closed;
  domain hijacked by a French content farm — 2nd stolen jazz domain this week)

Tier 2 remaining:
- [ ] Brooklyn: IBeam · Lowlands
- [ ] Manhattan: Swing 46 · Tomi Jazz · The Ear Inn (Sun) · Iridium
- [ ] Queens: Flushing Town Hall series

Tier 3 (needs per-event genre tagging first): LPR · Joe's Pub · JALC big halls

Zinc Bar follow-up: tribe API start_date is often midnight — parser mines set
times from description text; verify against reality after first live crawl.

## Phase 2 — Depth: filtering that scales
- [x] +11 NYC clubs (2026-07-15 Tier 1 batch — see venue build-out above)
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
- [x] Mobile perf (2026-07-15, Zach: "filters feel laggy"): list view renders
      in 21-day windows + content-visibility on day groups — filter toggles
      no longer rebuild 1500 rows
- [x] Mobile chips (2026-07-15, Zach: "one long line isn't going to cut it"):
      two-row scrollable rail; tiles-with-favorites remains the Phase 2 answer
- [ ] Quick polish batch: "Data crawled" → "Updated Xh ago"; Calendar/List
      toggle as one compact icon button; share-card (og.png) redesign once
      brand font is settled (current one reads corny)
- [x] **Artist search (2026-07-16):** topbar search box; accent-insensitive
      match on title + personnel + details + club name, city-wide (ignores
      chip filters); results as a date-grouped list. Foundation for saved
      artists + email alerts
- [ ] "New this week" page via `firstSeenAt` diff of consecutive crawls
- [ ] iCal export / add-to-calendar per show

## Phase 3 — Personalization
- [ ] Favorites persist (localStorage; no accounts yet)
- [ ] Saved artists + email notifications (DynamoDB subscribers + SES,
      triggered by the post-crawl diff — same diff as "New this week")
- [ ] Manual "refresh data" button with a takes-a-while warning

## Phase 4 — Multi-city: LA → Paris → Berlin
- [x] URL structure `/nyc`, `/la` + city switcher in the brand
- [x] Per-city data files (`events-nyc.json`, `events-la.json`)
- [x] **LA LAUNCHED 2026-07-15 — 10 venues:** Sam First (Wix events JSON) ·
      Catalina (TicketWeb plugin) · Vibrato (Squarespace) · The World Stage
      (Tockify) · Jazz at LACMA + Latin Sounds (Drupal cards, free series) ·
      The Mint (Plot/DICE API, jazz-filtered — Paul Cornish plays here) ·
      Hollywood Bowl (LA Phil genre feed, Jazz/Blues only) · 2220 Arts +
      Archives (DICE venue page) · Zebulon (DICE partner API, jazz-filtered) ·
      Harvelle's Santa Monica (SeatEngine calendar)
- LA skips, check back: The Baked Potato (site broken — calendar empty, no
  ticket products since April; the room itself is alive, find their real
  listing source) · Mr Musichead (events page stale/2025; check their
  Eventbrite organizer for Sunset Sessions)
- **bluewhale WATCH (Zach, 2026-07-16): the revival is reportedly coming —
  day-one add the moment a calendar exists.** Also watch: UCLA CAP season
  (fall, genre-tagged) · Angel City Jazz Festival (Sept, multi-venue)
- LA round 2 — DONE 2026-07-16 (LA 13 venues): The Ford + Disney Hall
  (laphil.com feed serves all three LA Phil venues incl. Bowl — one module) ·
  Gold-Diggers (DICE partners, shared helper with Zebulon, jazz-filtered).
  Pip's on La Brea verified dead (brand pivoted to a Cathedral City festival).
- LA round 3 candidates: Verse (Toluca Lake) · Feinstein's at Vitello's ·
  Lodge Room (keyword-filtered)
- TABLED (Zach, 2026-07-16): mixed-venue curation tightening — add jazz
  filters to 2220 + Terraza 7, run a 20-event precision spot-check on
  filtered venues, maybe a mixed-venue registry flag. Principle stands:
  we curate jazz EVENTS, not jazz venues
- [x] **Chicago — city 3, SHIPPED 2026-07-16:** 9 venues live, 263 events,
      0 errors on first Lambda crawl. Green Mill (rosters mined from its
      add-to-calendar links) · Jazz Showcase · Constellation · Andy's ·
      Hungry Brain · Elastic Arts · Winter's · Dorian's · SPACE (Evanston,
      Ticketmaster Discovery feed, genre-filtered). Two new reusable
      patterns: SeeTickets WP plugin + Modern Events Calendar
- [ ] **San Francisco — city 4 (next up):**
      SFJAZZ · Black Cat (the young-scene room) · Keys Jazz Bistro ·
      Mr. Tipple's · Bird & Beckett · Yoshi's (Oakland). West Coast pair w/ LA
- [x] **Paris — city 5, BUILT 2026-07-16 (deploy pending):** 7 venues.
      Duc des Lombards (Drupal agenda, per-night set times) · Sunset +
      Sunside (tribe REST, one module two rooms) · New Morning (JSON-LD
      agenda, no published set times) · Caveau de la Huchette (French
      prose date parser: singles/pairs/ranges, 21h30 nightly) · Bal Blomet
      (Eventer, ?terms_cats jazz filter) · 38 Riv (listing + detail-page
      set enrichment with reuse). New shared helpers: _tribe.js, _fr.js.
      24-hour time display for European cities (clock24 per city)
- [ ] **Tokyo — city 6 (Zach's pick, i18n first):** romaji search layer so
      kanji/kana titles match latin queries; personnel lexicon bypass;
      then Blue Note Tokyo · Cotton Club · Body & Soul · Pit Inn · Alfie
- [ ] **Jazz festivals as seasonal venues (greenlit 2026-07-16):**
      `seasonal: true` registry flag, chip renders only when events exist.
      Nearest first: Charlie Parker Jazz Fest (NYC, late Aug) · Chicago
      Jazz Fest (Labor Day) · Hyde Park Jazz Fest (Sept) · Angel City
      (LA, Sept-Oct) · Winter Jazzfest (NYC, Jan) · Vision Fest (June)
- BACKLOG: Freight & Salvage (Berkeley) — Cloudflare blocks non-browser
  clients on the genre-tagged site; TNEW ticketing API works but has no
  genre field. Module built and kept (clubs/freight.js + tests). Revisit
  via venue outreach or if genre data appears in the API
- BACKLOG: SFJAZZ crawler blocked the same way (cf-mitigated: challenge on
  their own ace-api). Play: email their team for a UA allowlist — we send
  them ticket buyers; decide meanwhile whether the chip stays (stale data +
  standing drift alarm) or waits in the registry comments like Freight
- [x] **London — city 6, BUILT 2026-07-16 (deploy pending):** 6 venues.
      Ronnie Scott's (listing cards + doors-time detail enrichment, Upstairs
      jazz-filtered) · Vortex (ICS feed via new _ics.js helper) · 606 Club
      (weekly server pages) · Jazz Cafe (data-genre cards, club nights
      dropped) · PizzaExpress Live Soho (clean JSON API) · Cafe OTO
      (improv church, DJ bar nights skipped)
- [ ] **Berlin — city 7 (next):** A-Trane, Quasimodo, Zig Zag, Donau115,
      Kunstfabrik Schlot. German instrument lexicon for personnel (French
      precedent in lib.js)
- [ ] Artist-analysis follow-ups (2026-07-16): Boston (Wally's, Regattabar)
      + one-venue satellite cities on the touring circuit — Bimhuis
      (Amsterdam), Porgy & Bess (Vienna), Jazzhus Montmartre (Copenhagen)
- [ ] Tokyo — the endgame (strongest scene on earth; blocked on real i18n:
      Japanese titles break the personnel lexicon + romaji search)

## Ongoing
- [x] **Monitoring (2026-07-16):** CloudWatch dashboard "jazzlineup" (requests,
      bytes, 4xx/5xx, crawler invocations/errors/duration) + email alarms
      (crawler fails 2 runs in a row; site >5% 5xx) + CloudFront access logs
      to S3 (90-day retention) — all in CDK, all free tier
- [x] Markup-drift alerting at CLUB level (2026-07-16): Lambda emits a
      "ProblemClubs" metric per crawl (total + per city); alarm emails after
      ~24h of any club staying suspect/failed; dashboard widget shows the
      trend. Which club = crawler log group
- [ ] Crawler politeness: descriptive UA, delays, cache/etag use where possible

## Brand simmer (open, non-blocking)

- [ ] "More metallic / horn-like" color treatment (gradient wordmark?);
      modern font question stays open — current: Abril Fatface + brass #d6a071
- [ ] Dim ornate f-hole curves (like a bass) as corner/border ornament —
      prototype as SVG, pairs with commissioned-art item
- [x] Venue colors (2026-07-16): live-mixer review with Zach — 8 recolors
      baked (Smoke brick per brand red, Dizzy's deeper orange, Barbès claret,
      Bill's Place walnut, LunÀtico sea-green, Jazz Cultural indigo, 2220
      magenta, Harvelle's brightened). Zinc kept steel; Smoke/Zinc twin
      resolved. Future venues: run the collision audit before picking

## With Brian (second admin)

- [ ] Security review: S3/CloudFront policies, IAM least-privilege (replace
      AdministratorAccess users with scoped roles), dependency audit
- [ ] Failsafe/infra review: CloudWatch alarm on crawler failures (SNS email),
      backup strategy for events.json history, cdk best practices

## Someday / big swings

- [ ] Sister site for classical / opera / ballet — the crawler + registry +
      calendar machinery is genre-agnostic; new venue registry, new skin,
      new domain (Lincoln Center, Carnegie, the Met…)
