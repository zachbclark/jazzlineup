# CLAUDE.md

Read NOTES.md before doing anything — it is the institutional memory:
curation rules, crawler conventions, hard-won parsing lessons, ops, and
the city backlog. The standing directives at its top (NYC first, clean UI,
no em dashes in user copy, personnel is core) apply to every change.

Also read NOTES-private.md if present (gitignored, exists only on Zach's
machine): launch strategy, community plans, crawl workarounds, and the
working-copy protocol for AI sessions live there.

VOICE (Zach, 2026-07-26): no AI-style language ANYWHERE public — site
copy, README, PR descriptions, Reddit, emails. That means: no corporate
"we", no em dashes, no marketing cadence, no "earns a crawler" style
cleverness, no "leverage"/"surface"/"robust". Write like a person: short
plain sentences, contractions fine, Zach's casual register. When in
doubt, read it out loud; if it sounds like a press release or a chatbot,
rewrite it. Keep PR descriptions to three plain lines max.

Quick orientation: crawlers in crawler/clubs/ (zero-dependency; parse() is
pure and fixture-tested in crawler/test.mjs), frontend in web/ (UI suite:
node web/test-ui.mjs), deploys happen by merging to main (GitHub Actions),
site DATA refreshes only when the crawler Lambda runs (every 4h or manual
invoke — command in NOTES.md).
