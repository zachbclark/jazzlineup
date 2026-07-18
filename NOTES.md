# NOTES.md — the institutional memory

Everything a fresh collaborator (human or AI) needs that the code alone
doesn't say. Written 2026-07-19, when the site spanned six cities, 72
venues, ~2,700 upcoming events. Read this before touching crawlers.

## What this site is

Jazz Lineup curates jazz EVENTS, not jazz venues. The bar for a venue:
"would a jazz fan plan their week around this room's calendar." Legacy
institutions (Vanguard, Blue Note, Ronnie Scott's, Yoshi's, Baked Potato)
are included wholesale — everything they book. Mixed-genre rooms are
included but filtered to their jazz nights; showing 5 real jazz shows beats
padding to 11 (the Gold-Diggers precedent). Rooms where jazz is one night a
quarter: no.

Standing directives from Zach, in order:
1. NYC takes priority. Always.
2. Clean UI is paramount. Black + gold (#e8b458), venue-color chips.
3. The em dash is BANNED from user-facing copy (reads as AI). Join with
   " · " or rewrite the sentence.
4. Personnel (who's on the bandstand) is a core feature, not a nicety.
   "personnel is very important for me to show."
5. Crawls may take as long as they need if they get the data.
6. Give an assessment BEFORE implementing anything nontrivial.

## Architecture in one breath

Zero-dependency Node crawlers (`crawler/`) write `data/events-<city>.json`.
A Lambda (6-min timeout) runs the full crawl every 4 hours and publishes
the JSON + the built frontend to S3 behind CloudFront. React frontend
(`web/`), zero-dependency static server (`server/`) for local dev and UI
tests, CDK stack (`infra/`). Cities: nyc la chi sf par lon. `CITIES` in
`web/src/api.js` holds label/slug/clock24 per city (Paris and London render
24h times like "20h30" via setClock24, called synchronously in the App body).

DATA vs CODE, the #1 support question: merging to main deploys CODE via
GitHub Actions. DATA only changes when the crawler Lambda runs (4h schedule,
or manual invoke). "I deployed but the new venue isn't showing" is always
this.

Manual Lambda invoke:

    FN=$(aws cloudformation describe-stacks --stack-name JazzLineup --query "Stacks[0].Outputs[?OutputKey=='CrawlerFunctionName'].OutputValue" --output text)
    aws lambda invoke --function-name $FN /tmp/out.json && cat /tmp/out.json

## Crawler conventions

Module contract: export `parse(input, ...)` as pure testable function(s) and
`async crawl(ctx)` that fetches live. `crawl` may receive
`ctx.previousEvents` (prior crawl's events for this venue, id-stable) — use
it to avoid refetching detail pages. Events go through
`makeEvent(applyLateNight({...}))`; ids are `clubId:date:slug(title)` and
must stay stable across crawls, they're the enrichment reuse key.

`crawler/run.js` gotcha that once WIPED a city file: `targetIds` must be
built from ALL of the city's clubs even when `--club` narrows the crawl,
otherwise the merge drops every other club's events. It's fixed; never
regress it. `--club x --city y` is safe now.

Politeness: `sleep()` between page fetches, `maxPages` caps on detail-page
enrichment (venues fill over successive crawls via prior-reuse), concurrency
~3. We fetch each venue a handful of pages every 4 hours; that's fine.

User-Agent policy: the default fetchText UA is honest. Exactly ONE venue
(PizzaExpress) gets an unmarked browser UA plus origin/referer headers,
scoped and commented in its module. The comment says it plainly: delete the
venue rather than spread that pattern.

### The personnel machinery (lib.js)

- `parsePersonnel(text)` — dash-run rosters: "Name - instrument Name -
  instrument". Trailing glue (", and") is trimmed from instruments;
  connector words (With/featuring/avec) never join a name (lastNameRun).
- `personnelFromLines(text)` — line-per-player rosters (European detail
  pages, Baked Potato h3s). Strict: whole right side must be instrument
  words, needs 2+ players.
- `personnelFromStrongTags(html)` — bolded-name rosters (Barbès/ViewCy:
  `<strong>Name</strong> - instruments,`). Most precise; try before
  parsePersonnel where markup has strong tags.
- INSTRUMENTS set includes French (batterie, contrebasse, trompette...,
  accents NFD-stripped) and world/folk (ukulele, kora, balafon, bandoneon,
  congas...). German (Schlagzeug etc.) still TODO for Berlin.
- `_jazzartists.js` — known-artist safety net (~140 names) rescuing
  keyword-filtered venues without genre tags. Add names when the recall
  audit finds a miss (Bill Frisell at Zebulon was the founding case).

### Shared platform helpers (crawler/clubs/_*.js)

_dicepartners (DICE API; TRUST genre_tags when present, keyword+artist net
otherwise; fallbackKey for venues whose page key-scrape fails), _tribe
(Events Calendar REST; parallel page fetches; Sunset/Sunside need tiny
perPage + 60s timeout, their server takes 30-50s/request), _ics (Vortex),
_viewcy (Barbès, Close Up), _simpleevents (Pocket, Keys; enrichPersonnel
option), _enrichdetails (generic detail-page enrichment: copies prior-crawl
fields by id, fetches only what's missing, never overwrites), _seetickets,
_turntable, _wixevents, _fr (French dates).

### Hard-won parsing lessons (do not relearn these)

- NEVER assume field shapes. PizzaExpress cost four rounds: dates are prose
  ("Thursday 16th July", no year), prices are PENCE, itemsPerPage must be
  30 (their widget's value; 100 returns empty).
- Strip HTML comments BEFORE matching (Duc des Lombards: a template comment
  containing 'annule' inside every date block ate the whole venue).
- Decode entities before prefix-stripping (Bar Bayeux "&amp; 9:30" became
  a show called "& 9").
- Unicode dashes: date-range regexes must cover the whole hyphen block.
  The Vanguard silently lost an entire week to &#8209; (U+2011). Dash
  classes: `[-–—‐-―−]`.
- Sites serve different markup to non-browsers than DevTools shows
  (single-quoted attributes at Blue Note; regexes accept both quote styles).
- JSON-LD blobs can be malformed (New Morning's 130KB array fails
  JSON.parse) — keep a regex-based lenient fallback, and make sure the
  strict path's "success" isn't a false positive (their EventVenue node
  matched a loose /event/i filter and starved the fallback).
- zsh eats `!` in one-liners — write diagnostic scripts to files.
- Import alias collisions in test.mjs (bpParse, spParse...) — rename on
  collision, node errors are cryptic.

### Seed-fallback pattern (WAF-blocked venues)

`crawl()` tries the live site first (auto-heals if they unblock us), falls
back to a browser-captured seed file on 403. Current seed venues and their
capture dates live in `crawler/clubs/*-seed.js` headers: sfjazz-seed,
ronnies-seed (room codes M/U/L/X), jazzcafe-seed. Seeds go stale — REFRESH
EVERY ~2 WEEKS by capturing from a real browser (Zach's Chrome; the
seed-from-capture script is `npm run seed`). WAF taxonomy: SFJAZZ +
Freight = Cloudflare challenge (blocks all non-browsers; Freight is
BACKLOGGED, their TNEW API has no genre data); Jazz Cafe = AWS-IP block
only (local crawls work); Ronnie's = blocks all non-browsers.

Yoshi's note: currently a plain server-rendered parse (li.event-indv,
aria-label carries title+date+time). It once returned 0 events to
non-browser fetches; if that recurs, suspect an A/B client-rendered
variant and consider the seed pattern.

## Audits — how we know we're not missing shows

- `scripts/personnel-audit.mjs` — local coverage table per venue
  (pers%/det%/sets%), STRUCTURAL set marks venues that can never have
  rosters. Run after crawls; worst-first.
- `scripts/recall-audit.mjs` — Songkick diff (runs on Zach's Mac; venue
  list in the script). Findings feed _jazzartists.
- `scripts/nycjr-audit.mjs` — THE monthly ritual. The NYC Jazz Record's
  calendar (paper of record) ships only in their issue PDF. Grab it from
  nycjazzrecord.com, `pdftotext -layout`, run the script (it rebuilds the
  PDF's three print columns by char offset: ~0/~80/~158). First run caught
  the Vanguard U+2011 bug. Its "untracked rooms" list is the ranked NYC
  expansion shortlist: Five Spot Jazz, Aman, Roxy Lounge, The Stone at The
  New School, Red Pavillion, Sour Mouse, Birds, SEEDS, Ibeam, Iridium.

## Frontend conventions

Black surface, gold accent #e8b458, venue-color chips (colors live in the
registry with a comment explaining each choice; keep hues distinct WITHIN a
city — that's the collision domain). Serif wordmark (Abril Fatface); the
city is part of the wordmark ("Jazz Lineup NYC ▾") and IS the switcher.
First-visit whisper "← choose your city" shows once (jl.cityhint flag).
ⓘ tips popover in the header documents the hidden features.

Chips: first click solo-selects, further clicks add, deselecting the last
returns to All. Drag-to-reorder with FLIP glide (mouse: 6px threshold;
touch: 300ms press-and-hold). FLIP animates ONLY during active drag — any
other layout change snaps (animating borough switches made chips slide
like furniture). Mobile: chips wrap, collapsed to ~2 lines behind a real
"Show all N venues" button (was a whisper strip nobody saw).

Search: city-wide, ignores chip/borough filters, matches titles + personnel
+ details + club names, UPCOMING ONLY (data files keep a few past days for
merge continuity; counting them showed "2 shows" above an empty list).
Cross-city pills check other cities' feeds during search, same
upcoming-only rule. Esc clears. Mobile search box must stay full-width in
the has-query state (a specificity slip once made the clear × slide on
blur).

localStorage keys: jl.city, jl.active.<city>, jl.order.<city>.<scope>,
jl.cityhint. All optional; the app works with storage blocked.

Footer: updated-ago, counts, gold tip jar (ko-fi.com/jazzlineup — the
footer's ONLY gold), suggest-a-venue mailto (zachbclark+jazzlineup@
gmail.com, assembled at runtime so the address isn't a scannable literal;
subject/body prefilled, city prefilled from current view).

Share card: `scripts/make-og.mjs` regenerates web/public/og.png (screenshot
of an HTML page via Playwright). The og:image URL is versioned (?v=2) —
BUMP THE VERSION when regenerating or platforms serve the stale cached
card forever.

Tests: `node crawler/test.mjs` (fixture-based, zero-dep, ~90 groups) and
`node web/test-ui.mjs` (Playwright against the built app + real data
files, 18 tests). UI test brittleness rule learned twice: any test that
derives inputs from data files must derive from UPCOMING events, and tests
must clean up state (a failed search test once cascaded into the borough
test). Container/CI note: `web/build-offline.mjs` builds without vite
(esbuild); vite is the Mac/CI path.

## Ops

CI/CD: GitHub Actions (.github/workflows/ci.yml) — tests on every push/PR,
deploy on merge to main via OIDC into IAM role `github-deploy` (trust
pinned to repo:zachbclark/jazzlineup:ref:refs/heads/main; permissions =
sts:AssumeRole on cdk-* only; ARN in repo secret AWS_DEPLOY_ROLE_ARN). UI
suite deliberately not in CI yet (Playwright download cost) — phase 2.
Branch protection on main + CODEOWNERS (* @zachbclark): Zach's approval
gates merges; solo PRs use the admin "merge without waiting" override.
Workflow files can't be written remotely by AI tooling (protected) — Zach
places them by hand.

Everything is us-east-1 (CloudFront cert requirement). Monitoring: one
CloudWatch dashboard "jazzlineup" (traffic on top, crawler health below),
email alarms incl. a drift alarm for venues suspect ~24h. CloudFront
metrics only exist in us-east-1; dashboard "No data" is usually region or
time-range. Pending Brian projects: CloudFront logs -> Athena analytics,
per-city crawl fan-out, weekly recall-audit Lambda, budget alarms.

Crawl failure model: per-venue try/catch; a failing venue reports in the
Lambda summary's errors[] and keeps its previous events (kept count);
the site never breaks from one venue's outage.

## Data feed policy (external users)

The /events-<city>.json feeds are public. Policy given to Ben Welsh (TRMNL
e-ink display, github.com/kip-claw/trmnl-jazz-lineup, blessed 2026-07-19):
attribution link to jazzlineup.com, gentle usage, no archival scraping, no
shape guarantees (cities and fields get added) but we try not to break
existing consumers, email when something breaks. TODO: publish this as an
/about or README note so future consumers self-serve.

## City queue and backlog

BOSTON SHIPPED 2026-07-19 (city id bos, 6 venues): Wally's (pure
generator — no artist calendar exists, jam Tue-Sat 19:00 + nightly night
set 21:00), Scullers (MusicIDB widget crawl, venueId 715, flaky host ->
seed fallback in scullers-seed.js), Regattabar (TicketWeb = Ticketmaster,
assumed bot-hostile, SEED-ONLY in regattabar-seed.js — refresh ~2 weeks
from ticketweb.com/venue/748814; same-title dates merge into sets),
Lilypad (gcal-template links on the homepage carry exact UTC times; light
non-music filter per Zach), Mad Monkfish (BentoBox /jazz-schedule/?p=N,
aria-label "M/D Title [time]"; "12-1am" tails are true after-midnight
sets), Beehive (named fixtures ONLY per Zach: Bruce Bears Sunday blues +
weekend brunch — no genre-roulette nightly filler). City Winery Boston:
BACKLOGGED per Zach (calendar is hip-hop/comedy/R&B; jazz ~one night a
quarter). Boston recall-audit candidate: Bostonshows.org (jazz filter).
personnel-audit STRUCTURAL should gain: wallys, beehive, regattabar,
scullers.

TOKYO SHIPPED 2026-07-19 (city id tok, 7 venues; slug /tokyo; clock24:
'colon' = Japanese 19:30 style). Architecture: searchNorm now folds
katakana->hiragana and full-width->ASCII (JP search works in any script);
events carry optional titleAlt (curated romaji under native titles —
_jpromaji.js, VERIFIED READINGS ONLY, grow it over time, absent beats
wrong); personnelFromJpRun in lib.js parses Name(Abbr) roster runs in both
paren widths with a romaji-abbreviation instrument map. Venues: Pit Inn
(http NOT https; /schedule + /next-schedule + /schedule-day day_box
markup; rosters nightly; Start times; sold-out flag), Blue Note Tokyo +
Cotton Club (shared _bluenotejp.js; reserve.<host>/reserve/schedule/move/
YYYYMM; one table.later per run, rowspan fans dates; price + intro; NO set
times in this view — detail enrichment is a future pass), Body & Soul
(WP /schedule; date lives in the /event/YYMMDD slug; 1st/2nd set times;
rosters), Sometime (text-regular live.html + liveYYYYMM.html archives;
full-width-paren rosters; matinees tagged 昼の部), Alfie (alfie.tokyo
/schedule/YYYYMM.html; genre tags [jazz]/[world] kept with non-jazz noted
in details; house set time parsed from the header line), Intro (pure jam
generator: Tue/Wed/Thu/Sun practice jams + SATURDAY 10-HOUR ALL-NIGHT JAM
18:30-4:30; Mon closed, Fri at their sister cafe). BILLBOARD LIVE PENDING:
site was in payment-system maintenance during recon — recon
billboard-live.com/pg/shop/show/index.php?mode=list&shop=1 (shop=1 =
Tokyo; 2/3 are Osaka/Yokohama), then include WHOLESALE per Zach's ruling
on mixed supper clubs. Personnel: five of seven venues publish nightly
rosters — Tokyo launches with the best personnel coverage of any city.

TOKYO TIER-3 CANDIDATES (v2, from scene knowledge — recon before
building): Someday (Shinjuku, nightly, big-band scene), Aketa no Mise
(Nishi-Ogikubo, legendary underground since 1974), B Flat (Akasaka),
JZ Brat (Cerulean Tower, Shibuya), Blues Alley Japan (Meguro). Also
grow _jpromaji.js continuously — every un-romanized famous name is a
one-line fix.

NEW CITY LAUNCH CHECKLIST (learned on Boston): merge deploys CODE only;
the city 404s until the Lambda writes events-<id>.json. Invoke the Lambda,
and if the city page still errors, CloudFront cached the HTML fallback for
that JSON path — invalidate /events-<id>.json.

Queue after Tokyo:
PHILLY (Chris' Jazz Cafe, South Jazz Kitchen, Solar Myth, Paris Bistro,
Clef Club, World Cafe Live filtered, Time; city id phl), then Berlin
(A-Trane, Quasimodo, Zig Zag, Donau115, Kunstfabrik Schlot; add German
instrument lexicon; Zig Zag got an unprompted 5-star endorsement in the
r/Jazz thread).

Boston intel from r/Jazz (u/thinair01, 2026-07): add Berklee Performance
Center and the Red Room at Cafe 939 (Berklee) as candidates — frequent but
not majority jazz, needs filtering. A big slice of Boston jazz happens as
roving SERIES rather than in clubs: Mandorla Music, Dave Bryant's Third
Thursdays, Square Root Roslindale Sundays, Long Live Roxbury Thursdays,
The Makanda Project (monthly-ish, free, Roxbury). The Marjorie's/Bird &
Beckett generator pattern may fit the regular ones. Bostonshows.org has a
jazz filter and is "super comprehensive" — evaluate it as Boston's
recall-audit source (the NYCJR role), or a data collaboration.

LA note: Danny Janklow reportedly holds a standing first-Thursday-monthly
night at the Baked Potato (r/Jazz commenter) — verify against crawl data.

Tokyo is parked deliberately (deserves proper i18n): recon notes — Blue
Note Tokyo reserve.bluenote.co.jp server-rendered tables with roman artist
names; Pit Inn is http-only, WP REST /wp-json/wp/v2/artist_live_info, full
rosters in 菊地成孔(Sax,Vo) format, has an English page; venue list Blue
Note, Cotton Club, Billboard Live, Pit Inn, Body & Soul, Sometime, Intro,
Alfie. Decisions made: English titles, native-script search at launch via
the tested kana-folding searchNorm, curated romaji table as v2.

Also parked: satellite one-club cities (Bimhuis Amsterdam, Porgy & Bess
Vienna, Jazzhus Montmartre Copenhagen), festivals as seasonal venues
(Charlie Parker Aug, Chicago Labor Day, Hyde Park Sept, Angel City, Winter
Jazzfest Jan), NYC Tier 2 from the NYCJR shortlist, conservatory calendars
in September, Freight & Salvage (WAF), SFJAZZ outreach email (drafted;
Zach sends), LA round 3.

## Feature roadmap (user-requested)

- Deep routing for sharing (r/Jazz, Zach: "top of my improvements list"):
  /:city/:district/ paths (e.g. /nyc/manhattan/) and a ?date=YYYY-MM-DD
  param, so a filtered view is a shareable link. City slugs already exist;
  this extends the pattern to borough + date state.
- Classical music sibling site/section for the same cities — Zach
  committed to this publicly in the r/Jazz thread ("classical is next").
  Big scope; treat as its own project, likely reusing the whole crawler +
  registry architecture.

## Working-copy discipline (learned the hard way, 2026-07-19)

Zach's Mac (/Users/zclark/github/jazzlineup) is the ONLY source of truth.
Any other working copy (an AI session's container, a scratch clone) can
silently revert to a stale snapshot; one stale-base sync force-overwrote
the Mac and deleted a shipped feature (the suggest-a-venue link — rebuilt
same day). Protocol: stage the CURRENT Mac copy of a file immediately
before editing it, edit that, sync back. Bulk multi-line rewrites must
assert every anchor string matched (a silent no-op replace is how features
half-vanish). When anything looks impossibly missing, check file mtimes
and git log before trusting the tree.

## Community state (as of 2026-07-19)

Posted to r/InternetIsBeautiful (r/dataisbeautiful removed the direct post
— tool links aren't visualizations; the way back in is an [OC] chart FROM
the data citing the site, generator ready at scripts/make-dib-chart.mjs;
rendered chart saved at repo root as jazz-nights.png). Ready-to-use post:
title "[OC] Which night of the week has the most live jazz? 2,700 upcoming
club dates across New York, LA, Chicago, SF, Paris and London"; required
source comment: "Data: jazzlineup.com, a site I built that crawls the
published calendars of 72 jazz venues. Tool: hand-rolled HTML/CSS. Happy
to share per-city breakdowns in the thread." Findings worth leading with:
Chicago Thursdays 23%, SF dead Mondays 5%, Paris and London trade places
on Sundays, New York nearly flat (every night is jazz night).
NYC Jazz Record community noticed the site. AI-assistance disclosure
stance: own it cheerfully, curation is the human part. Reddit voice: no
title case, no marketing cadence, lead with the problem, "yeah fair"
before any pushback.

