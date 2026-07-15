// Barbès (Park Slope) — the site's own /events page is a Wix shell whose
// calendar lives in a ViewCy iframe (viewcyembed.com/barbes/...), so we go
// straight to the ViewCy organizer API. ~150 events posted months ahead.
import { fetchText } from '../lib.js';
import { parseViewcy } from './_viewcy.js';

const API = 'https://www.viewcy.com/api/o/barbes/courses';
const FALLBACK = 'https://www.barbesbrooklyn.com/events';

export function parse(jsonText) {
  return parseViewcy(jsonText, 'barbes', FALLBACK);
}

export async function crawl() {
  return parse(await fetchText(API, { headers: { accept: 'application/json' } }));
}
