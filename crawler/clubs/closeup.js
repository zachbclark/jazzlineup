// Close Up (Lower East Side) — musician-run room on Orchard St; the young
// scene's home base. Wix site links out to a ViewCy calendar, so we use the
// ViewCy organizer API directly (same shape as Barbès).
import { fetchText } from '../lib.js';
import { parseViewcy } from './_viewcy.js';

const API = 'https://www.viewcy.com/api/o/closeup/courses';
const FALLBACK = 'https://www.closeupnyc.com';

export function parse(jsonText) {
  return parseViewcy(jsonText, 'closeup', FALLBACK);
}

export async function crawl() {
  return parse(await fetchText(API, { headers: { accept: 'application/json' } }));
}
