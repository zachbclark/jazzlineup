// Le Piano Vache (8 rue Laplace, 5e) — Latin Quarter bar by the Panthéon.
// Asked for by the bar itself (Adrien, 2026-10-14). The /en/ page embeds the
// whole program as schema.org MusicEvent JSON-LD with real local times.
// Mixed program: gypsy jazz Mondays and blues Tuesdays are kept (Zach,
// 2026-11-02); the Irish session and one-offs that never say jazz or blues
// are dropped. Shows don't name players, so no personnel; a blues night's
// performer is the band, which becomes the title.
import { fetchText, makeEvent, extractJsonLd, cleanText } from '../lib.js';

const URL_ = 'https://lepianovache.com/en/';
const KEEP = /jazz|manouche|swing|blues/i;

export function parse(html) {
  const events = [];
  const seen = new Set();
  for (const node of extractJsonLd(html)) {
    if (!/^(?:Music)?Event$/i.test(String(node['@type'] ?? ''))) continue;
    if (!node.name || !node.startDate) continue;
    if (!KEEP.test(`${node.name} ${node.description ?? ''}`)) continue;
    const date = String(node.startDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const time = (String(node.startDate).match(/T(\d{2}:\d{2})/) ?? [])[1];
    const kind = cleanText(String(node.name).replace(/\s+at Le Piano Vache\s*$/i, ''));
    const band = [].concat(node.performer ?? []).map((p) => cleanText(p?.name ?? '')).find(Boolean);
    const free = node.isAccessibleForFree === true || String(node.offers?.price ?? '') === '0';
    const ev = makeEvent({
      clubId: 'pianovache',
      title: band ?? kind,
      date,
      sets: time ? [time] : [],
      url: URL_,
      details: band ? kind : null,
      priceText: free ? 'Free' : null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_));
}
