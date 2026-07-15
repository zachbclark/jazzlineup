// Harvelle's (1432 4th St, Santa Monica) — blues/soul room since 1931.
// SeatEngine-powered site with a server-rendered month calendar:
//   /calendar              (current month)
//   /calendar?month=8&year=2026
// Cells: <span class='date'>N</span> … <a href="/events/137965">Title</a> …
//        <a class='event-btn…'>9:00 PM</a>
import { fetchText, makeEvent, htmlToText, extractTimes, isoDate, tzDate, sleep } from '../lib.js';

const BASE = 'https://santamonica.harvelles.com';

export function parse(html, year, month) {
  const events = [];
  // Split on date-cell markers; each chunk belongs to one day number.
  const parts = html.split(/<span[^>]*class=['"]date['"][^>]*>\s*(\d{1,2})\s*<\/span>/);
  // parts: [pre, day1, chunk1, day2, chunk2, …]
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const day = Number(parts[i]);
    const chunk = parts[i + 1];
    const evRe = /<a[^>]*href=['"](\/events\/\d+)['"][^>]*>([\s\S]*?)<\/a>/g;
    let m;
    const seen = new Set();
    while ((m = evRe.exec(chunk))) {
      const title = htmlToText(m[2]);
      if (!title || seen.has(title)) continue;
      seen.add(title);
      // first plausible show time after this link
      const after = chunk.slice(m.index, m.index + 1200);
      const times = extractTimes(htmlToText(after)).filter((t) => t >= '17:00' || t < '03:00');
      events.push(makeEvent({
        clubId: 'harvelles',
        title,
        date: isoDate(year, month, day),
        sets: times.slice(0, 2),
        url: BASE + m[1],
      }));
    }
  }
  return events;
}

export async function crawl() {
  const out = [];
  const [y, mo] = tzDate(Date.now(), 'America/Los_Angeles').split('-').map(Number);
  for (let i = 0; i < 2; i++) {
    const d = new Date(Date.UTC(y, mo - 1 + i, 1));
    const yy = d.getUTCFullYear(), mm = d.getUTCMonth() + 1;
    const url = i === 0 ? `${BASE}/calendar` : `${BASE}/calendar?month=${mm}&year=${yy}`;
    try {
      out.push(...parse(await fetchText(url), yy, mm));
    } catch (err) {
      if (i === 0) throw err;
    }
    await sleep(150);
  }
  return out;
}
