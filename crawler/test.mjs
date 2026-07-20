// Parser smoke tests against fixture snippets that mirror each site's real
// markup (structures verified against the live sites when each venue landed).
// Run: node crawler/test.mjs
//
// Suites live in crawler/tests/, one per city plus shared.mjs for the
// cross-venue machinery (lib.js personnel, merge rules, DICE tags,
// detail enrichment). _harness.mjs holds ok(), TODAY, and the summary.
import './tests/nyc.mjs';
import './tests/la.mjs';
import './tests/chi.mjs';
import './tests/sf.mjs';
import './tests/bos.mjs';
import './tests/tok.mjs';
import './tests/nol.mjs';
import './tests/par.mjs';
import './tests/lon.mjs';
import './tests/ber.mjs';
import './tests/shared.mjs';
