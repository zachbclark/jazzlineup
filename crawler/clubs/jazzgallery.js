// The Jazz Gallery — Squarespace site; /calendar?format=json returns the
// events collection as JSON. Cleanest source of the bunch.
import { fetchText, makeEvent, extractTimes, htmlToText, isoDate } from '../lib.js';

const URL_ = 'https://jazzgallery.org/calendar?format=json';

// Epoch ms -> YYYY-MM-DD in America/New_York regardless of host TZ.
function nyDate(ms) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
  return p; // en-CA gives YYYY-MM-DD
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function parse(jsonText) {
  const j = JSON.parse(jsonText);
  const events = [];
  for (const it of j.upcoming ?? []) {
    const title = it.title ?? '';
    // Skip passes/announcements that span weeks (e.g. Summerpass promos).
    const start = nyDate(it.startDate);
    const end = nyDate(it.endDate);
    let span = 0;
    for (let d = start; d <= end && span < 40; d = addDays(d, 1)) span++;
    if (span > 7 || /pass|membership/i.test(title)) continue;

    const excerpt = htmlToText(it.excerpt ?? '');
    const setsM = excerpt.match(/sets? at ([^.]{0,40}?)(?:ET|\.|$)/i);
    const sets = setsM ? extractTimes(setsM[1].replace(/(\d{1,2}(?::\d{2})?)(?=\s*[+&])/g, '$1pm')) : [];
    // "7pm + 9pm": the second time carries pm; ensure the first does too (handled above).

    for (let d = start, i = 0; d <= end && i < span; d = addDays(d, 1), i++) {
      events.push(makeEvent({
        clubId: 'jazzgallery',
        title,
        date: d,
        sets,
        url: 'https://jazzgallery.org' + (it.fullUrl ?? '/calendar'),
        details: excerpt.slice(0, 400) || null,
      }));
    }
  }
  return events;
}

export async function crawl() {
  return parse(await fetchText(URL_, { headers: { accept: 'application/json' } }));
}
