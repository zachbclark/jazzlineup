// JazzSpot Intro (高田馬場, Takadanobaba) — Mr. Ibaraki's basement jam
// house. No bookings, only the weekly ritual (verified 2026-07-19):
// practice jam sessions Tue/Wed/Thu/Sun from opening at 18:30, and the
// famous 10-HOUR all-night jam every Saturday, 18:30 till 4:30 AM. Monday
// closed; Friday's session happens at their sister cafe (not this venue).
// Pure generator, like Wally's — the jam IS the institution.
import { makeEvent, isoDate } from '../lib.js';

const WEEKS_AHEAD = 8;
const URL_ = 'https://jazzspot.intro.co.jp/';

export function parse(today = new Date()) {
  const events = [];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * WEEKS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const date = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const dow = d.getDay(); // 0=Sun
    if ([0, 2, 3, 4].includes(dow)) {
      events.push(makeEvent({
        clubId: 'introtok',
        title: '練習ジャムセッション',
        titleAlt: 'Practice Jam Session',
        date,
        sets: ['18:30'],
        url: URL_,
        details: 'Bring your horn. Tomorrow’s Tokyo jazz leaders sharpening each other, nightly.',
      }));
    }
    if (dow === 6) {
      events.push(makeEvent({
        clubId: 'introtok',
        title: '10時間オールナイトジャム',
        titleAlt: '10-Hour All-Night Jam',
        date,
        sets: ['18:30'],
        url: URL_,
        details: 'Saturday institution: 6:30 PM to 4:30 AM, straight through.',
      }));
    }
  }
  return events;
}

export async function crawl() {
  return parse();
}
