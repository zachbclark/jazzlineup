// Shared extractor for Wix Events sites (Sam First, Terraza 7). The events
// page embeds full event objects in <script id="wix-warmup-data">; we parse
// that JSON and walk the tree for the first array of
// { title, slug, scheduling:{ config:{ startDate (UTC ISO), timeZoneId } } }.
export function wixWarmupEvents(html) {
  const m = html.match(/<script[^>]*id="wix-warmup-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }
  let found = null;
  (function walk(o) {
    if (!o || typeof o !== 'object' || found) return;
    if (Array.isArray(o)) {
      if (o.length && o[0] && typeof o[0] === 'object' && o[0].scheduling && o[0].title) { found = o; return; }
      o.forEach(walk);
      return;
    }
    Object.values(o).forEach(walk);
  })(data);
  return found ?? [];
}
