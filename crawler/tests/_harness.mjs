// Shared harness for the parser suites in this directory: the ok() runner,
// the fixed test clock, and the exit summary. Entry point: crawler/test.mjs.
export const TODAY = new Date(2026, 6, 13); // Mon Jul 13 2026
let passed = 0, total = 0;
export function ok(name, fn) {
  total++;
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}
process.on('exit', () => console.log(`\n${passed}/${total} test groups passed`));
