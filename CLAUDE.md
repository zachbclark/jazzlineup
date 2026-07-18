# CLAUDE.md

Read NOTES.md before doing anything — it is the institutional memory:
curation rules, crawler conventions, hard-won parsing lessons, ops, and
the city backlog. The standing directives at its top (NYC first, clean UI,
no em dashes in user copy, personnel is core) apply to every change.

Quick orientation: crawlers in crawler/clubs/ (zero-dependency; parse() is
pure and fixture-tested in crawler/test.mjs), frontend in web/ (UI suite:
node web/test-ui.mjs), deploys happen by merging to main (GitHub Actions),
site DATA refreshes only when the crawler Lambda runs (every 4h or manual
invoke — command in NOTES.md).
