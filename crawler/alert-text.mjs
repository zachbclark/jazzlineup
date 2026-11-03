// Plain-English alert emails (Zach, 2026-11-03: "information I can understand
// and act on"). Every email says what happened, the likely cause, and what to
// do, with Eastern times and no AWS jargon. Pure: lambda.mjs (venue alerts)
// and alarm-mail.mjs (CloudWatch alarms) format through here, tests cover it.

// SNS subjects must be ASCII and under 100 characters ("Barbès" would
// fail the whole send), so accents are folded and anything else dropped.
export function asciiSubject(subject) {
  return String(subject).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().slice(0, 99);
}

// '2026-11-03T06:42:00Z' -> 'Nov 3, 1:42am ET'
export function etTime(iso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.month} ${parts.day}, ${parts.hour}:${parts.minute}${parts.dayPeriod.toLowerCase()} ET`;
}

// Raw crawler error -> what went wrong + likely cause, in words. No error
// at all happens two ways: a crawler that serves several venues (Smalls +
// Mezzrow) got shows for the others but not this one, or nothing was logged.
export function explainError(err, { shared = false } = {}) {
  const e = String(err ?? '');
  if (!e && shared) return {
    what: 'its crawler got shows for the other venues it covers, but none for this one.',
    cause: 'their site changed for this venue only, or nothing is posted yet.',
  };
  if (!e) return { what: 'no error was recorded.', cause: 'unknown. The crawler needs a look.' };
  if (/returned 0 events/.test(e)) return {
    what: 'their site returned 0 shows.',
    cause: 'they changed their website. The crawler needs a fix.',
  };
  if (/->\s*403\b/.test(e)) return { what: 'their site refused the request (403).', cause: 'their site is blocking us.' };
  if (/->\s*404\b/.test(e)) return { what: 'the page wasn\'t found (404).', cause: 'the page moved. Find the new address.' };
  if (/->\s*5\d\d\b/.test(e)) return { what: 'their site had a server error.', cause: 'their site is having trouble. It usually fixes itself.' };
  if (/fetch failed|timed? ?out|ETIMEDOUT|ECONN|ENOTFOUND|abort/i.test(e)) return {
    what: 'the crawler couldn\'t reach their site.',
    cause: 'their site is down or slow. If it lasts a few days, check it.',
  };
  return { what: 'the crawler hit an error.', cause: 'unknown. The crawler needs a look.' };
}

// items: { kind: 'dead' | 'still' | 'back' | 'archive' | 'check', city?,
//          name?, url?, since?, streak?, error?, shared?,
//          check?: 'dead' | 'shrink' (which check crashed) }
// -> { subject, message } for one email per crawl
export function venueEmail(items) {
  const order = { check: 0, archive: 1, dead: 2, still: 3, back: 4 };
  // a crashed check usually crashes in every city: one paragraph per check
  const checks = new Map();
  for (const it of items.filter((x) => x.kind === 'check')) {
    const c = checks.get(it.check) ?? { ...it, cities: [] };
    c.cities.push(it.city);
    checks.set(it.check, c);
  }
  const sorted = [...checks.values(), ...items.filter((x) => x.kind !== 'check')]
    .sort((a, b) => order[a.kind] - order[b.kind]);
  const blocks = sorted.map((it) => {
    if (it.kind === 'check') {
      const which = it.check === 'shrink' ? 'venues that look off' : 'broken venues';
      return [
        `The check that spots ${which} crashed (${it.cities.join(', ')}), so this crawl couldn't tell you about any.`,
        `What to do: this needs a fix. Until then, ${which} won't email you.`,
        `Technical detail: ${it.error}`,
      ].join('\n');
    }
    if (it.kind === 'archive') {
      return [
        `The archive copy for ${it.city} didn't save on this crawl.`,
        'If an earlier crawl today saved, today\'s record is just a few hours older than it should be. If every crawl today fails, today\'s record is missing for good.',
        'What to do: if this comes twice in a row, it needs a fix.',
        `Technical detail: ${it.error}`,
      ].join('\n');
    }
    if (it.kind === 'back') return `${it.name} (${it.city}) is updating again. Nothing to do.`;
    const { what, cause } = explainError(it.error, { shared: it.shared });
    const head = it.kind === 'still'
      ? `${it.name} (${it.city}) still isn't updating. No new shows for ${it.streak} crawls, since ${etTime(it.since)}.`
      : `${it.name} (${it.city}) has had no new shows for ${it.streak} crawls, since ${etTime(it.since)}.`;
    return [
      head,
      'Jazz Lineup is still showing its last good list.',
      `What went wrong: ${what}`,
      `Likely cause: ${cause}`,
      it.url ? `Their site: ${it.url}` : null,
      it.error ? `Technical detail: ${it.error}` : null,
    ].filter(Boolean).join('\n');
  });

  const count = (k) => sorted.filter((it) => it.kind === k).length;
  let subject;
  if (sorted.length === 1) {
    const it = sorted[0];
    subject = {
      check: `the ${it.check === 'shrink' ? 'look-off' : 'broken-venue'} check crashed`,
      archive: `the archive didn't save (${it.city})`,
      dead: `${it.name} stopped updating`,
      still: `${it.name} still isn't updating`,
      back: `${it.name} is updating again`,
    }[it.kind];
  } else {
    const n = (k, one, many) => count(k) && (count(k) === 1 ? one : `${count(k)} ${many}`);
    subject = [
      count('check') && 'a venue check crashed',
      count('archive') && 'archive didn\'t save',
      n('dead', '1 venue stopped updating', 'venues stopped updating'),
      n('still', '1 venue still down', 'venues still down'),
      n('back', '1 venue back', 'venues back'),
    ].filter(Boolean).join(', ');
  }
  return { subject: `Jazz Lineup: ${subject}`, message: blocks.join('\n\n') };
}

// Silent-rot digest: venues that still update but look wrong (anomaly.mjs
// detectAnomalies). items: { city, name, url?, reasons: [raw reason] }
const REASONS = [
  [/^events (\d+) vs usual ~(\d+)$/, (m) => `${m[1]} shows listed, usually about ${m[2]}`],
  [/^no future events$/, () => 'no upcoming shows'],
  [/^personnel (\d+)% vs usual ~(\d+)%$/, (m) => `lineups on ${m[1]}% of shows, usually about ${m[2]}%`],
];
const plainReason = (r) => {
  for (const [re, fn] of REASONS) { const m = String(r).match(re); if (m) return fn(m); }
  return String(r);
};

export function shrinkEmail(items) {
  const n = items.length;
  return {
    subject: n === 1 ? `Jazz Lineup: ${items[0].name} looks off` : `Jazz Lineup: ${n} venues look off`,
    message: [
      `${n === 1 ? 'This venue still updates' : 'These venues still update'}, but something looks off:`,
      '',
      ...items.map((it) => `${it.name} (${it.city}): ${it.reasons.map(plainReason).join('; ')}.${it.url ? ` Their site: ${it.url}` : ''}`),
      '',
      'Likely cause: their site changed and the crawler is only reading part of it. Or the venue really is quieter.',
      'What to do: compare each venue\'s site with Jazz Lineup. One email per venue per day at most.',
    ].join('\n'),
  };
}

// CloudWatch "Alarm State Change" event -> { subject, message }, or null for
// transitions that need no email: going TO INSUFFICIENT_DATA, or from it to
// OK (an alarm starting up after a deploy). INSUFFICIENT_DATA -> ALARM still
// emails: that's a real problem found on startup. Every alarm here sets
// treatMissingData, so INSUFFICIENT_DATA only happens at creation; an
// ALARM -> INSUFFICIENT_DATA -> OK recovery (which would skip "back to
// normal") can't happen in practice.
// lagHours: how long before the alarm time the problem began.
const ALARMS = [
  {
    match: /CrawlerStopped/,
    lagHours: 8,
    alarm: ['the crawler hasn\'t run in 8 hours',
      (t) => `No shows have updated anywhere ${t ? `since about ${t}` : 'for at least 8 hours'}.\nWhat to do: check the crawler in AWS (Lambda, JazzLineup-Crawler).`],
    ok: 'the crawler is running again',
  },
  {
    match: /CrawlerFailing/,
    alarm: ['the crawler crashed twice in a row',
      () => 'The whole crawl failed on 2 runs in a row, so no venue has updated for about 8 hours. The site still shows the last good data.\nWhat to do: check the crawler\'s logs in AWS (Lambda, JazzLineup-Crawler, Monitor, then Logs).'],
    ok: 'the crawler is working again',
  },
  {
    match: /SiteErrors/,
    alarm: ['the site is erroring',
      () => 'More than 5% of visits failed for 15 minutes.\nWhat to do: open jazzlineup.com and check it loads.'],
    ok: 'the site is back to normal',
  },
];

export function alarmEmail(event) {
  const d = event?.detail ?? {};
  const now = d.state?.value;
  const before = d.previousState?.value;
  if (!now || now === 'INSUFFICIENT_DATA') return null;
  if (now === 'OK' && before === 'INSUFFICIENT_DATA') return null;
  const name = String(d.alarmName ?? '');
  const at = new Date(d.state?.timestamp ?? event.time ?? Date.now());
  const def = ALARMS.find((x) => x.match.test(name));
  if (!def) {
    const short = name.replace(/^JazzLineup-/, '').replace(/[A-F0-9]{8}-\w+$/, '');
    return {
      subject: `Jazz Lineup: alarm ${short} is ${now === 'ALARM' ? 'on' : 'off'}`,
      message: `${d.configuration?.description ?? short}\nSince ${etTime(at)}.`,
    };
  }
  if (now === 'OK') return { subject: `Jazz Lineup: ${def.ok}`, message: 'Nothing to do.' };
  const [what, body] = def.alarm;
  // straight from startup there's no "last good" moment to count back from
  const began = before === 'INSUFFICIENT_DATA' ? null : etTime(new Date(at.getTime() - (def.lagHours ?? 0) * 3600e3));
  return { subject: `Jazz Lineup: ${what}`, message: body(began) };
}
