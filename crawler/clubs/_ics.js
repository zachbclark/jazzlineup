// Minimal iCalendar (RFC 5545) event extractor — for venues that publish an
// ICS feed (Vortex London via The Events Calendar's ?ical=1 export).
// Handles line unfolding, TZID/UTC/floating DTSTART, and text unescaping.
// Zero dependencies, like everything else here.
import { tzDate, tzTime } from '../lib.js';

function unfold(text) {
  return String(text).replace(/\r?\n[ \t]/g, '');
}

function unescapeIcs(s) {
  return String(s ?? '')
    .replace(/\\n/gi, ' ')
    // RFC escapes are \\ \; \, — some exporters also escape & and :
    .replace(/\\([,;:&\\])/g, '$1');
}

// -> [{ summary, dtstart: {date:'YYYY-MM-DD', time:'HH:MM'|null}, url, description }]
export function parseIcs(text, { defaultTz }) {
  const events = [];
  for (const block of unfold(text).split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const field = (name) => (body.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'mi')) ?? [])[1]?.trim();
    const dtRaw = body.match(/^DTSTART(?:;TZID=([^:;]+))?(?:;[^:]*)?:(\d{8})(?:T(\d{6})(Z?))?/mi);
    if (!dtRaw) continue;
    const [, tzid, ymd, hms, zulu] = dtRaw;
    let date; let time = null;
    if (hms && zulu) {
      // UTC datetime -> venue-local
      const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(0, 2)}:${hms.slice(2, 4)}:00Z`;
      date = tzDate(iso, defaultTz);
      time = tzTime(iso, defaultTz);
    } else {
      // TZID or floating: already venue-local (tzid, if present, is the venue's)
      date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      if (hms) time = `${hms.slice(0, 2)}:${hms.slice(2, 4)}`;
    }
    events.push({
      summary: unescapeIcs(field('SUMMARY')),
      date,
      time,
      url: field('URL') ?? null,
      description: unescapeIcs(field('DESCRIPTION') ?? '').slice(0, 500),
    });
  }
  return events;
}
