// Shared parser for ViewCy-powered venues (Barbès, Close Up).
// ViewCy exposes a public JSON API per organizer:
//   GET https://www.viewcy.com/api/o/<org>/courses
// -> { data: [{ name, description(html), url, timezone, tags,
//               events: [{ name, starts_at(UTC ISO), ends_at, book_url }] }],
//      total_count, has_more }
// One "course" per show; events[] carries the actual date(s)/set(s).
import {
  makeEvent, htmlToText, nyDate, nyTime, applyLateNight, stripPromo,
  parsePersonnel, personnelFromStrongTags,
} from '../lib.js';

// "Artist Name - Set 2" / "Artist (late set)" -> base title for set-merging.
function baseTitle(name) {
  return String(name).replace(/\s*[-–—(]\s*(?:set|show)\s*#?\d\)?\s*$/i, '').trim();
}

export function parseViewcy(jsonText, clubId, fallbackUrl) {
  const j = JSON.parse(jsonText);
  const grouped = new Map(); // `${date}:${slugish title}` -> draft
  for (const course of j.data ?? []) {
    const desc = htmlToText(course.description ?? '');
    // bolded-name rosters first (exact boundaries), dash-run prose second
    const strong = personnelFromStrongTags(course.description ?? '');
    const personnel = strong.length ? strong : parsePersonnel(desc);
    for (const ev of course.events ?? []) {
      if (!ev?.starts_at) continue;
      const date = nyDate(ev.starts_at);
      const time = nyTime(ev.starts_at);
      const title = baseTitle(ev.name || course.name || '');
      if (!title) continue;
      const key = `${date}:${title.toLowerCase()}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          clubId,
          title,
          date,
          sets: [],
          url: ev.book_url || course.url || fallbackUrl,
          details: personnel.length ? null : stripPromo(desc).slice(0, 300) || null,
          personnel,
        });
      }
      grouped.get(key).sets.push(time);
    }
  }
  return [...grouped.values()].map((d) => makeEvent(applyLateNight(d)));
}
