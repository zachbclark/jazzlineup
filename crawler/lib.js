// Shared helpers for all club crawlers. Zero dependencies by design:
// parsers work from JSON APIs, JSON-LD blocks, and targeted HTML extraction,
// so the whole crawler runs on bare Node >= 20.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 jazzlineup-bot/0.1 (+https://jazzlineup.com; polite crawler)';

export async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...opts.headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

export async function fetchJson(url, opts = {}) {
  return JSON.parse(await fetchText(url, opts));
}

// --- HTML extraction (no DOM library; targeted and defensive) ---------------

// Extract every <script type="application/ld+json"> block as parsed JSON,
// flattening arrays and @graph containers.
export function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else if (parsed['@graph']) blocks.push(...parsed['@graph']);
      else blocks.push(parsed);
    } catch { /* ignore malformed blocks */ }
  }
  return blocks;
}

// Strip tags and decode common entities -> plain text.
export function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', eacute: 'é', amp_: '&',
};
export function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Return the inner HTML of each element whose opening tag matches `tagRe`
// (a regex tested against the full opening tag). Handles nesting of the same
// tag name. Good enough for the specific, stable structures we scrape.
export function matchBlocks(html, tagName, attrRe) {
  const out = [];
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let m;
  while ((m = openRe.exec(html))) {
    if (!attrRe.test(m[0])) continue;
    const start = m.index + m[0].length;
    // find matching close, accounting for nested same-name tags
    let depth = 1;
    const scanner = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}>`, 'gi');
    scanner.lastIndex = start;
    let s;
    while (depth > 0 && (s = scanner.exec(html))) {
      depth += s[0][1] === '/' ? -1 : 1;
    }
    if (depth === 0) out.push(html.slice(start, s.index));
  }
  return out;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- dates & times -----------------------------------------------------------

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
export function monthNum(name) {
  return MONTHS[String(name).slice(0, 3).toLowerCase()] ?? null;
}

// Given month/day possibly without a year, pick the year that keeps the date
// within [-45 days, +320 days] of today (handles Dec->Jan rollover).
export function inferYear(month, day, today = new Date()) {
  const y = today.getFullYear();
  for (const cand of [y - 1, y, y + 1]) {
    const d = new Date(cand, month - 1, day);
    const days = (d - today) / 86400000;
    if (days >= -45 && days <= 320) return cand;
  }
  return y;
}

export function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// "2026-07-15T19:00:00-04:00" or "2026-07-15 19:00" -> { date, time }
export function splitIso(iso) {
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return m ? { date: m[1], time: m[2] } : { date: String(iso).slice(0, 10), time: null };
}

// Normalize "7:30 PM", "7pm", "19:30" -> "19:30" (24h HH:MM), else null.
export function normalizeTime(str) {
  if (!str) return null;
  const m = String(str).trim().match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (!m || (!m[2] && !m[3])) return null; // bare number with no am/pm or minutes: too ambiguous
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap?.startsWith('p') && h < 12) h += 12;
  if (ap?.startsWith('a') && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Pull every time-looking token out of a string: "7:00 PM & 9:00 PM" -> ['19:00','21:00']
export function extractTimes(str) {
  if (!str) return [];
  const out = [];
  const re = /(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/gi;
  let m;
  while ((m = re.exec(str))) {
    const t = normalizeTime(m[1]);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.sort();
}

// --- event shape --------------------------------------------------------------

// Every crawler returns events via makeEvent():
// { id, clubId, title, date 'YYYY-MM-DD', sets ['19:00',...], url, details,
//   personnel [{name, instrument}] | null, priceText }
export function makeEvent(e) {
  if (!e.clubId || !e.title || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')) {
    throw new Error(`bad event: ${JSON.stringify(e)}`);
  }
  return {
    id: `${e.clubId}:${e.date}:${slug(e.title)}`,
    clubId: e.clubId,
    title: cleanText(e.title),
    date: e.date,
    sets: [...new Set((e.sets ?? []).filter(Boolean))].sort(),
    url: e.url ?? null,
    details: e.details ? cleanText(e.details).slice(0, 500) : null,
    personnel: Array.isArray(e.personnel) && e.personnel.length ? e.personnel : null,
    priceText: e.priceText ? cleanText(e.priceText) : null,
  };
}

export function cleanText(s) {
  return decodeEntities(String(s)).replace(/\s+/g, ' ').trim();
}

export function slug(s) {
  return cleanText(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// Read a fixture file if FIXTURES env var is set (used by tests), else fetch live.
export async function textFromFixtureOrLive(fixtureName, url, opts) {
  if (process.env.FIXTURES) {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    return readFile(join(process.env.FIXTURES, fixtureName), 'utf8');
  }
  return fetchText(url, opts);
}

// --- personnel ---------------------------------------------------------------

// Instrument lexicon for splitting "Name - instrument Name - instrument" runs.
const INSTRUMENTS = new Set([
  'guitar', 'guitars', 'bass', 'drums', 'piano', 'keys', 'keyboard', 'keyboards',
  'saxophone', 'saxophones', 'sax', 'alto', 'tenor', 'soprano', 'baritone',
  'trumpet', 'flugelhorn', 'cornet', 'trombone', 'tuba', 'euphonium', 'horn',
  'voice', 'vocals', 'vocal', 'vibraphone', 'vibes', 'marimba', 'organ',
  'flute', 'clarinet', 'oboe', 'bassoon', 'cello', 'violin', 'viola', 'strings',
  'percussion', 'harmonica', 'accordion', 'banjo', 'mandolin', 'harp', 'oud',
  'synth', 'synthesizer', 'electronics', 'turntables', 'dj', 'composer',
  'conductor', 'arranger', 'leader', 'electric', 'acoustic', 'upright',
]);
const isInstrumentWord = (w) => INSTRUMENTS.has(w.toLowerCase().replace(/[^a-z]/gi, ''));

// Promo / boilerplate that pollutes event descriptions.
const PROMO_RE = /\b(?:FREE WITH SUMMERPASS|SUMMERPASS|TICKETS\s*(?:&|and)\s*MORE INFO|GET (?:YOUR )?TICKETS?|MORE INFO|BUY TICKETS?|LIVESTREAM|SOLD OUT)\b[.!]?/gi;

export function stripPromo(text) {
  return cleanText(String(text).replace(PROMO_RE, ' '));
}

// Parse a personnel run like:
//   "Miles Okazaki - guitar Caroline Davis - alto saxophone Dan Weiss - drums"
//   "Bill Frisell – Guitar Greg Tardy – Saxophone"
// into [{ name, instrument }]. Returns [] if the text doesn't look like a roster.
export function parsePersonnel(text) {
  const t = stripPromo(String(text))
    .replace(/\bsets? at [^.]*$/i, '') // trailing "Sets at 7pm + 9pm ET"
    .trim();
  // Split on dashes that have whitespace on both sides (name/instrument seams).
  const parts = t.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return [];

  const personnel = [];
  let name = lastNameRun(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    const tokens = parts[i].split(/\s+/);
    // Leading tokens that are instrument-ish belong to the current player...
    const instr = [];
    let j = 0;
    while (j < tokens.length && (isInstrumentWord(tokens[j]) || /^(?:&|and|\/|,)$/i.test(tokens[j]))) {
      instr.push(tokens[j]);
      j++;
    }
    if (name && instr.length) {
      personnel.push({ name: cleanText(name), instrument: cleanText(instr.join(' ').toLowerCase()) });
    }
    // ...and the rest is the next player's name.
    name = lastNameRun(tokens.slice(j).join(' '));
  }
  return personnel.length >= 2 ? personnel : [];
}

// From trailing text, take the final run of capitalized-ish tokens (a name).
function lastNameRun(text) {
  const tokens = cleanText(text).split(/\s+/).filter(Boolean);
  let start = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^[A-Z(“"']/.test(tokens[i]) && !isInstrumentWord(tokens[i])) start = i;
    else break;
  }
  const run = tokens.slice(start).join(' ');
  return run.length >= 3 && start >= tokens.length - 4 ? run : '';
}
