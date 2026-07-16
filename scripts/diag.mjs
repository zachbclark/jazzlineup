// Diagnostics v2 — New Morning parse internals.
//   node scripts/diag.mjs
import { fetchText, extractJsonLd } from '../crawler/lib.js';
import { parse as nmParse } from '../crawler/clubs/newmorning.js';

const h = await fetchText('https://www.newmorning.com/programmation');
console.log('page bytes:', h.length);

// how many ld+json blocks, and does each JSON.parse?
const blocks = [...h.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
console.log('ld blocks found by regex:', blocks.length);
blocks.forEach((b, i) => {
  try {
    const p = JSON.parse(b[1].trim());
    const arr = Array.isArray(p) ? p : [p];
    console.log(`  block ${i}: parses OK — ${arr.length} node(s), types: ${[...new Set(arr.map((n) => n['@type']))].join(',').slice(0, 60)}`);
  } catch (err) {
    console.log(`  block ${i}: JSON.parse FAILED — ${String(err.message).slice(0, 80)} (len ${b[1].length})`);
  }
});

const nodes = extractJsonLd(h);
console.log('extractJsonLd total nodes:', nodes.length,
  '| Event nodes:', nodes.filter((n) => /event/i.test(String(n['@type'] ?? ''))).length);

const lenRe = /"@type"\s*:\s*"Event"[\s\S]{0,400}?"name"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,200}?"startDate"\s*:\s*"([^"]+)"[\s\S]{0,400}?"url"\s*:\s*"([^"]+)"/g;
console.log('lenient regex matches:', [...h.matchAll(lenRe)].length);

const evs = nmParse(h);
console.log('module parse():', evs.length, evs[0] ? `| first: ${evs[0].title} ${evs[0].date}` : '');
