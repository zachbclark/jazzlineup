# NOTES.md — the institutional memory

Everything a fresh collaborator (human or AI) needs that the code alone
doesn't say.
Strategy, community plans, and session-protocol notes live in
NOTES-private.md (gitignored, Zach's machine only). Written 2026-07-19, when the site spanned six cities, 72
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

data/ is GITIGNORED (since 2026-07-20; it used to be tracked and every
local crawl dirtied ten files into unrelated PRs). Prod S3 is the source
of truth; `npm run data:pull` fetches the live public feeds into data/
for local dev, UI tests, and audit scripts — at most 4h stale, often
fresher than a checked-in snapshot ever was. Local crawls overwrite the
same files freely. The Lambda never touches repo data (it reads/writes
S3 directly), and the CDK stack bundles only web/dist + crawler/.

Manual Lambda invoke (--cli-read-timeout 0: the full crawl outlives the
CLI's 60s default, which "errors" while the Lambda finishes fine):

    FN=$(aws cloudformation describe-stacks --stack-name JazzLineup --query "Stacks[0].Outputs[?OutputKey=='CrawlerFunctionName'].OutputValue" --output text)
    aws lambda invoke --cli-read-timeout 0 --function-name $FN /tmp/out.json && cat /tmp/out.json

One city only (targeted refresh after adding/fixing a venue; payload takes
"par" or ["par","ber"], typos fail loudly, no payload = full crawl):

    aws lambda invoke --cli-read-timeout 0 --cli-binary-format raw-in-base64-out \
      --payload '{"city":"par"}' --function-name $FN /tmp/out.json && cat /tmp/out.json

Partial runs skip the aggregate ProblemClubs metric on purpose — a subset
reporting 0 would reset the ~24h drift alarm and mask a rotting venue in a
city the run never touched (per-city dimensions still emit).

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
Lodge Room 429s on back-to-back fetches — one homepage hit per crawl only.

Seasonal venues: a registry entry may carry `emptyOk: true` (92NY, whose
jazz is mostly the Jazz in July festival) — its module returning 0 events
logs as off-season instead of SUSPECT, so a dark hall doesn't nag the
drift alarm. A shared module is emptyOk only if every club it serves is.

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
- Names-only rosters are legitimate personnel (Bar Bayeux "w/Adam Kolker,
  Jeremy Stratton", A-Trane "HEUTE MIT:"): emit instrument '' and the UI
  skips the instrument span. Validators are strict — every part must read
  like a 2-4 word capitalized name, billing words (band/trio/presents)
  poison the whole run, and ambiguous dash-splits (Werra-Magro) reject
  rather than guess.
- `titleCaseName` fixes ALL-CAPS/lowercase roster names (A-Trane, Zig Zag);
  leave mixed-case names alone.
- `_enrichdetails` `alsoFill`: fields filled on a fetch but never
  TRIGGERING one. Use for data published later than the roster (New
  Morning times/prices) or missing on some shows (Zig Zag rosters) so
  incomplete shows don't refetch forever and starve new ones.
- 2026-07-18 personnel sweep verdicts, so nobody re-recons these: rosters
  FOUND at New Morning + Bal Blomet + Sunset/Sunside (Paris detail pages;
  Sunside's <div class=artistes> is UNQUOTED-attr markup), Mr. Tipple's
  (pipe-separated, already in the tribe description), PizzaExpress
  (__NEXT_DATA__ band_line_up_copy), Blue Note Tokyo + Cotton Club (artist
  pages, two MEMBER markups; the reserve page's details block also has
  per-date SET TIMES — the "no times in this view" note was wrong), Zig Zag
  (detail pages, chaotic case). STRUCTURAL (no roster exists; list in
  personnel-audit.mjs): Blue Note NYC/LA, Birdland, Cellar Dog, Nublu,
  Yoshi's, 606, Andy's, Harvelle's, Vibrato, Schlot + the generators.

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
- Ethan Iverson's do-the-gig venue list (old but trusted, cross-referenced
  2026-07-18): The Stone, Iridium, SEEDS and Ibeam appear on BOTH his list
  and the NYCJR shortlist — that's the ranked top of NYC Tier 2. (Mezzrow
  looked like a gap at first read but is already tracked — smalls.js
  serves both rooms.)
- NYC EXPANSION 2026-07-20: The Stone + SEEDS + Ibeam SHIPPED (see the
  registry for the parsing notes: Stone's lexicon-free roster parser and
  residency-titled generics, SEEDS' seeds.calendar Tockify feed, Ibeam's
  "upcoming"-not-"items" Squarespace blog with the program in the post
  body). Verification VERDICTS from the same session, so nobody re-recons:
  Swing 46 CLOSED (site hours all say CLOSED, last calendar entry Dec
  2023). Minton's has NO web presence (mintonsharlem.com is a casino-spam
  domain squat — do not trust it; mintonsplayhouse.com dead; verify the
  room's status in person before any seed). Ginny's Supper Club: site is a
  splash page; music lives on redroosterharlem.com/music-schedule with no
  parseable feed found; looks brunch-led — curation call deferred.
  Soapbox Gallery DORMANT (Squarespace events collection empty across
  months). Still-unverified candidates: Room 623, Tomi Jazz, The Owl,
  Cleopatra's Needle (site alive, no calendar tech on homepage), Gin
  Fizz, Scholes Street Studio, Bushwick Public House, 11th Street Bar,
  Halyard's, NYC Baha'i Center. Arturo's is ACTIVE nightly with no
  published calendar — a generator venue like Wally's, good follow-up.
  Curation calls for Zach: Knickerbocker, Cafe Carlyle, Saint Peter's.
  Iridium is next up and needs the jazz-filter treatment (Wix + TicketWeb;
  books blues/rock/tribute alongside jazz — Gold-Diggers precedent).

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

Tests: `node crawler/test.mjs` (fixture-based, zero-dep, ~134 groups) and
`node web/test-ui.mjs` (Playwright against the built app + real data
files, 22 tests). Both entry points are thin aggregators since 2026-07-20:
crawler suites live in crawler/tests/ (one per city plus shared.mjs for
lib/merge/enrichment; each also runs standalone, e.g. `node
crawler/tests/chi.mjs`), UI suites in web/tests/ (desktop-basics, chips,
search-routing, mobile — they share one boot and run IN ORDER; don't
shuffle them). New venue tests go in the city's suite file. UI test
brittleness rule learned twice: any test that derives inputs from data
files must derive from UPCOMING events, and tests must clean up state (a
failed search test once cascaded into the borough test). Container/CI
note: `web/build-offline.mjs` builds without vite (esbuild); vite is the
Mac/CI path.

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

## Command cheat sheet

Everyday dev (repo root):

    npm run data:pull              # fetch prod feeds into data/ (gitignored; do this first on a fresh clone)
    node crawler/test.mjs          # parser tests (138 groups as of the Stone/SEEDS/Ibeam batch)
    node web/test-ui.mjs           # browser UI tests (needs Playwright + data:pull)
    node crawler/index.js          # full crawl, writes data/events-*.json
    node crawler/index.js --city nol   # one city (nyc la chi sf bos par lon tok nol ber)
    cd web && npm run dev          # local UI dev server

Data sanity after a crawl:

    node -e "const d=require('./data/events-nol.json'); console.log(d.events.length,'events'); console.log([...new Set(d.events.map(e=>e.clubId))])"

Audits and assets:

    node scripts/personnel-audit.mjs   # coverage by venue, flags enrichable gaps
    node scripts/nycjr-audit.mjs       # recall vs NYC Jazz Record (pdftotext first)
    node scripts/make-og.mjs           # share card; bump ?v= in web/index.html AND web/build-offline.mjs

Ship it (deploy runs itself when main updates):

    git checkout main && git pull      # ALWAYS branch from fresh main
    git checkout -b my-feature
    git add -A && git commit -m "..."
    git push -u origin my-feature      # then PR, admin merge

Phantom PR conflicts (squash-merge echo; branch is always the newer superset):

    git merge origin/main
    git checkout --ours .
    git add -A && git commit --no-edit && git push

Refresh live data (deploy ships CODE only; the crawler Lambda also
self-runs every 4h):

    FN=$(aws cloudformation describe-stacks --stack-name JazzLineup --query "Stacks[0].Outputs[?OutputKey=='CrawlerFunctionName'].OutputValue" --output text)
    aws lambda invoke --function-name $FN /tmp/out.json && cat /tmp/out.json

New city 404s / stale JSON (CloudFront cached the HTML fallback):

    DIST=$(aws cloudfront list-distributions --query "DistributionList.Items[0].Id" --output text)
    aws cloudfront create-invalidation --distribution-id $DIST --paths "/events-nol.json"

Traffic: CloudFront console -> distribution -> Monitoring tab (us-east-1;
data lags a few hours, an empty chart right after launch is normal).

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
18:30-4:30; Mon closed, Fri at their sister cafe). BILLBOARD LIVE
SHIPPED 2026-07-19 after their maintenance (they relaunched on Next.js
mid-recon): billboardtok.js walks /schedules?today=YYYY-MM-DD day pages
(35 ahead); each page carries ALL THREE shops' cards, attributed by the
nearest preceding >TOKYO</>YOKOHAMA</>OSAKA< marker; React comment nodes
stripped before parsing; CSS-module hashes churn per deploy so only
stable class PREFIXES are matched; JP name in aria-label + EN tour title
= free titleAlt; both stage Start times = sets; min price = "from ¥N".
OSAKA IS NEARLY FREE: same pages — pass shop='OSAKA' + a new clubId to
parse(). Personnel: five of seven venues publish nightly
rosters — Tokyo launches with the best personnel coverage of any city.

NEW ORLEANS SHIPPED 2026-07-19 (city id nol, slug /nola, 7 venues,
America/Chicago). Snug Harbor (TicketWeb WP plugin like Birdland; one
listing PER SET, merged by date+title), Preservation Hall (generator:
three nightly sets 17:00/18:30/20:00, from their own meta copy; rotating
band names = future enrichment), d.b.a. + Spotted Cat (BILL'S GIGULATOR —
shared _gigulator.js; publish.billsgigulator.com/shows.html?site=1048 /
1052; it's the NOLA-standard listing service, check it FIRST for any
future NOLA venue), Blue Nile (Squarespace /calendar-tickets-?format=json,
epoch-ms dates, titles carry "• SAT JUL. 18 • 7:30PM" decoration to
strip), Maple Leaf (existing _wixevents helper unchanged), Fritzel's
(generator, nightly trad since 1969, deliberately no fake set times).

BERLIN SHIPPED 2026-07-18 (city id ber, slug /berlin, 6 venues,
Europe/Berlin, clock24: 'colon' — Germans write 19:30, not the launch
pack's assumed Paris style). Platform: lib.js MONTHS gained German
prefixes (mär/mrz/mai/okt/dez), INSTRUMENTS gained the German set
(schlagzeug, kontrabass, posaune...), personnelFromJpRun takes
{maxName} for western Name(Instrument) rosters and accepts written-out
instrument words + trailing-dot abbreviations (keyb.). Venues: A-Trane
(EventON on WordPress; homepage server-renders ~6 weeks of
.eventon_list_event blocks; data-time="start-end" epochs are LOCAL TIME
PRETENDING TO BE UTC — format with tzDate/tzTime 'UTC' and wall-clock
falls out, DST-proof; PRÄSENTIERT prefix stripped; GESCHLOSSEN
placeholders skipped), Zig Zag (Squarespace hand-built /programmneu
summary page, ENGLISH dates, genre paren "(Jazz)" opens each excerpt,
Beginn times via detail enrichment), b-flat (Squarespace events JSON =
the Blue Nile pattern; Concert time rides tags, roster rides excerpt in
Name(abbr) form; startDate clock is bogus, date-only), Donau115 (their
Wix site loads a PUBLIC FIREBASE FEED .../events.json — ISO dates, live
flag, members rosters in two shapes; Two-Song Tuesday songwriter night
filtered out, Thursday Jazz Jam kept), Kunstfabrik Schlot (WP Offbeat
theme /programm/ list, GERMAN month abbrevs, no year (inferYear), no
times on list — detail enrichment; kabarett/comedy title filter),
Quasimodo (WP Events Manager; TRUST THEIR TAG PAGES /events/tags/jazz +
latin-jazz + blues, numeric dd.mm.yyyy dates, title-keyword rescue over
the full list). Colors all site-verified via dominant-color extraction
except Donau115 (monochrome site, assigned green). Four of six venues
carry personnel. A-Trane leads the chips.

CHIP COLOR VERIFICATION (mechanical task, any session): registry colors
whose comment cites a real brand hex are verified; comments saying "quick
read" or vibes are NOT. Sweep the unverified ones (most of bos/tok/nol)
with the dominant-color extractor: load the venue site in a browser, count
computed backgroundColor/color/borderColor values excluding grays, top hit
is the brand color, glow-tune for the black background. Snug Harbor was
caught wearing an invented red this way (real brand: #a54399 purple —
Zach, from having actually been there). One-line fixes; community
corrections welcome.

NEW CITY LAUNCH CHECKLIST (learned on Boston): merge deploys CODE only;
the city 404s until the Lambda writes events-<id>.json. Invoke the Lambda,
and if the city page still errors, CloudFront cached the HTML fallback for
that JSON path — invalidate /events-<id>.json.

## Feature roadmap (user-requested)

- Google Analytics: SHIPPED 2026-07-20 as GTM (container GTM-5RPXJCWF,
  Joe's script) with Consent Mode defaults DENYING all storage, declared
  BEFORE the GTM loader in both web/index.html and the build-offline.mjs
  template (the og-bump dual-edit rule applies here too). Consequences,
  so nobody "fixes" them: the site still sets ZERO cookies and needs no
  EU banner; tags Joe adds in the GTM console (GA4 etc.) run in
  cookieless-ping mode, so his numbers read lower/modeled than a cookied
  setup — that is the deal, not a bug. A UI test guards the promise
  (desktop-basics: zero first-party cookies); if it ever fails, a GTM tag
  is misconfigured — fix the tag or ship a consent banner (flip via
  gtag('consent','update',...)), never the test. Tell Joe: enable GA4
  Enhanced Measurement history tracking so SPA city/borough switches
  count as page views (deep routes give clean paths). Joe is also setting
  up Search Console access. GTM console changes deploy instantly without
  code review — the cookie test is the only tripwire.

- Deep routing for sharing (r/Jazz, Zach: "top of my improvements list"):
  /:city/:district/ paths (e.g. /nyc/manhattan/) and a ?date=YYYY-MM-DD
  param, so a filtered view is a shareable link. SHIPPED, plus ?venues=
  (2026-07-19): comma-joined club ids mirror the chip selection live;
  a shared link applies once on load and never overwrites the visitor's
  saved chips; bad ids degrade gracefully; All = no param.
- Classical music sibling site/section for the same cities — Zach
  committed to this publicly in the r/Jazz thread ("classical is next").
  Big scope; treat as its own project, likely reusing the whole crawler +
  registry architecture.
