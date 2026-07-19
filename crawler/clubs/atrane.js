// A-Trane (Bleibtreustraße 1, Charlottenburg) — Berlin's nightly
// institution since 1992; Wynton and Brad Mehldau recorded live albums in
// this room. WordPress + EventON calendar; the HOMEPAGE server-renders
// about six weeks of .eventon_list_event blocks (verified 2026-07-18):
//   <div class="eventon_list_event ... event ..." data-time="1784579400-1784591400">
//     <span class="evcal_event_title">A-TRANE PRÄSENTIERT:<br>ARTIST...</span>
//     <span class="evcal_event_subtitle">EINTRITT FREI & ENTRANCE FREE</span>
//     <a href="https://a-trane.de/Events-Directory/...">
// data-time is EventON's start-end pair in "local time pretending to be
// UTC" (their schema block confirms 20:30 CEST while the epoch decodes to
// 20:30 UTC) — so format it AS UTC and the wall-clock time falls out,
// DST-proof. Weekly fixtures: Saturday
// late-night jam after the second set, Monday Andreas Schmidt & Friends
// (free). "HEUTE GESCHLOSSEN - TODAY CLOSED" placeholder days are skipped.
// All jazz — no filter.
import {
  fetchText, makeEvent, htmlToText, cleanText, tzDate, tzTime,
} from '../lib.js';

const BASE = 'https://a-trane.de';

// "A-TRANE PRÄSENTIERT:" (with or without colon/spacing) decorates most
// titles; the useful name follows it.
const PREFIX_RE = /^A[- ]?TRANE PR[ÄA]SENTIERT:?\s*/i;

// Sidemen hide in the subtitle lines as labeled name runs:
//   "HEUTE MIT: HEINRICH KÖBBERLING-RUDI MAHALL"
//   "FEAT: Luca Zambito-Sebastian Wolfgruber" · "Special Guest: ETIENNE WITTICH"
// The dash is the separator BUT can also be a hyphenated surname
// ("Till Sahm-Björn Werra-Magro" — is Magro a person or half a surname?).
// Conservative rule: split on every dash; if any fragment isn't exactly a
// 2-3 word name, reject that run entirely (precision-first). ALL-CAPS names
// are title-cased for display. Instrument-less, like Bar Bayeux.
const ROSTER_LABEL_RE = /(?:HEUTE MIT|FEAT\.?|FEATURING|SPECIAL GUESTS?)\s*:?\s*([^·«»]+)/gi;
function titleCaseName(name) {
  return name.toLowerCase().replace(/(^|[\s\-'])(\p{Ll})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}
export function personnelFromSubtitle(lines) {
  const personnel = [];
  const seen = new Set();
  for (const line of lines) {
    for (const m of String(line).matchAll(ROSTER_LABEL_RE)) {
      const frags = m[1].split(/\s*[-–]\s*|\s*,\s*|\s+&\s+/).map((s) => cleanText(s)).filter(Boolean);
      if (!frags.length) continue;
      const ok = frags.every((f) => {
        const words = f.split(/\s+/);
        return words.length >= 2 && words.length <= 3 && words.every((w) => /^\p{Lu}/u.test(w));
      });
      if (!ok) continue;
      for (const f of frags) {
        const name = /\p{Ll}/u.test(f) ? f : titleCaseName(f);
        if (seen.has(name)) continue;
        seen.add(name);
        personnel.push({ name, instrument: '' });
      }
    }
  }
  return personnel;
}

export function parse(html) {
  const events = [];
  const seen = new Set();
  const chunks = String(html).split(/(?=<div[^>]+class=["'][^"']*eventon_list_event)/).slice(1);
  for (const box of chunks) {
    const tm = box.match(/data-time=["'](\d{9,12})-(\d{9,12})["']/);
    if (!tm) continue;
    const startMs = Number(tm[1]) * 1000;
    // raw serves class="evoet_title evcal_desc2 evcal_event_title"; the DOM
    // version is rewritten to just evcal_event_title — match anywhere in class
    const lines = htmlToText(box.match(/class=["'][^"']*evcal_event_title[^"']*["'][^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '')
      .split('\n').map((l) => cleanText(l)).filter(Boolean);
    if (!lines.length) continue;
    if (/GESCHLOSSEN|TODAY CLOSED/i.test(lines[0])) continue;
    let title = lines[0].replace(PREFIX_RE, '');
    // residency headers ("A Summer Residency DAY1:") keep the artist line
    if (!title || /^a summer residency|^artist in (summer )?residence/i.test(title)) {
      title = (lines[1] ?? '').replace(PREFIX_RE, '') || title;
    }
    if (!title) continue;
    const rest = lines.slice(1).filter((l) => !cleanText(l).startsWith(title));
    const subtitle = cleanText(htmlToText(box.match(/class=["'][^"']*evcal_event_subtitle[^"']*["'][^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''));
    const url = box.match(/href="(https?:\/\/(?:www\.)?a-trane\.de\/Events-Directory\/[^"]+)"/)?.[1];
    const ev = makeEvent({
      clubId: 'atrane',
      title,
      date: tzDate(startMs, 'UTC'),
      sets: [tzTime(startMs, 'UTC')],
      url: url ?? `${BASE}/programm/`,
      personnel: personnelFromSubtitle(rest),
      details: rest.join(' · ') || null,
      priceText: /EINTRITT FREI/i.test(subtitle) ? 'Free' : null,
    });
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(`${BASE}/`));
}
