// Shared harness for the UI suites: the test() runner and the exit summary.
// Entry point: web/test-ui.mjs (boots the server + browser, runs suites in order).
let passed = 0, failed = 0;
export async function test(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
export function summary() {
  console.log(`\n${passed}/${passed + failed} UI tests passed`);
  process.exit(failed ? 1 : 0);
}
