# nycjazzcal.com — backlog

## Features
- [ ] **More clubs** — Smoke, Ornithology, Bar Bayeux, Zinc Bar, The Stone…
      One module per club in `crawler/clubs/` + registry entry + parser test.
- [ ] **Artist filtering/search** — search box matching title + personnel
      (`details` already carries band members for Jazz Gallery & Vanguard).
- [ ] **Saved artists + email notifications** — user enters email, follows
      artists, gets notified when a followed artist shows up in a new crawl.
      Needs subscriber storage + a post-crawl diff step (AWS: DynamoDB + SES).
- [ ] **"Featuring" page: newly added shows** — stamp events with
      `firstSeenAt` by diffing against the previous crawl; "New this week"
      view sorted by it. (Same diff powers the artist emails.)
- [ ] **Favoritable filters** — star clubs into a "My clubs" preset once the
      club list gets long.
- [ ] **Click a date in calendar mode → full-day list** — extend the existing
      "+N more" day panel to open on any day click, showing every show that
      day with full band personnel.
- [ ] **"Refresh now" button** — trigger a server-side re-crawl from the UI,
      with a warning that it takes a while; disable while running.

## Robustness
- [ ] **Markup-drift protection** — per-crawl sanity checks (event count vs.
      last run, plausible date range, % events with sets/urls) that mark a
      club "suspect" instead of shipping bad data; staleness warnings in the
      UI footer; alert (email/webhook) after N consecutive failed crawls.
      Already in place: per-club failure isolation, last-good-data retention,
      `errors[]` in events.json, fixture tests (`node crawler/test.mjs`).

## Deployment
- [ ] Register **nycjazzcal.com**
- [ ] AWS: Lambda crawler on EventBridge schedule → S3 `events.json` →
      CloudFront + S3 static frontend (see README).
