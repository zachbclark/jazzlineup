// Plain-English alert emails (Zach, 2026-11-03: "information I can understand
// and act on"). Every email says what happened, the likely cause, and what to
// do, with Eastern times and no AWS jargon. Pure: lambda.mjs (venue alerts)
// and alarm-mail.mjs (CloudWatch alarms) format through here, tests cover it.

// '2026-11-03T06:42:00Z' -> 'Nov 3, 1:42am ET'
export function etTime(iso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.month} ${parts.day}, ${parts.hour}:${parts.minute}${parts.dayPeriod.toLowerCase()} ET`;
}

// Raw crawler error -> what went wrong + likely cause, in words.
export function explainError(err) {
  const e = String(err ?? '');
  if (!e) return {
    what: 'the crawler got shows for the other venue on this page, but none for this one.',
    cause: 'their site changed for this venue only, or nothing is posted yet.',
  };
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

// items: { kind: 'dead' | 'still' | 'back' | 'archive', city, name?, url?,
//          since?, streak?, error? }
// -> { subject, message } for one email per crawl
export function venueEmail(items) {
  const order = { archive: 0, dead: 1, still: 2, back: 3 };
  const sorted = [...items].sort((a, b) => order[a.kind] - order[b.kind]);
  const blocks = sorted.map((it) => {
    if (it.kind === 'archive') {
      return [
        `Today's archive didn't save for ${it.city}.`,
        'What to do: nothing yet. The next crawl tries again in 4 hours. If this comes twice in a row, it needs a fix.',
        `Technical detail: ${it.error}`,
      ].join('\n');
    }
    if (it.kind === 'back') return `${it.name} (${it.city}) is updating again. Nothing to do.`;
    const { what, cause } = explainError(it.error);
    const head = it.kind === 'still'
      ? `${it.name} (${it.city}) still isn't updating. No new shows for ${it.streak} crawls, since ${etTime(it.since)}.`
      : `${it.name} (${it.city}) has had no new shows for ${it.streak} crawls, since ${etTime(it.since)}.`;
    return [
      head,
      'The site is still showing its last good list.',
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
      archive: `today's archive didn't save (${it.city})`,
      dead: `${it.name} stopped updating`,
      still: `${it.name} still isn't updating`,
      back: `${it.name} is updating again`,
    }[it.kind];
  } else {
    const n = (k, one, many) => count(k) && (count(k) === 1 ? one : `${count(k)} ${many}`);
    subject = [
      count('archive') && 'archive didn\'t save',
      n('dead', '1 venue stopped updating', 'venues stopped updating'),
      n('still', '1 venue still down', 'venues still down'),
      n('back', '1 venue back', 'venues back'),
    ].filter(Boolean).join(', ');
  }
  return { subject: `Jazz Lineup: ${subject}`, message: blocks.join('\n\n') };
}

// CloudWatch "Alarm State Change" event -> { subject, message }, or null for
// transitions that need no email (anything involving INSUFFICIENT_DATA, which
// is just an alarm starting up or a deploy).
const ALARMS = [
  {
    match: /CrawlerStopped/,
    alarm: ['the crawler hasn\'t run in 8 hours',
      (t) => `No shows have updated anywhere since about ${t}.\nWhat to do: check the crawler in AWS (Lambda, JazzLineup-Crawler).`],
    ok: ['the crawler is running again', () => 'Nothing to do.'],
  },
  {
    match: /CrawlerFailing/,
    alarm: ['the crawler crashed twice in a row',
      () => 'The whole crawl failed on 2 runs in a row, so no venue has updated for about 8 hours. The site still shows the last good data.\nWhat to do: check the crawler\'s logs in AWS (Lambda, JazzLineup-Crawler, Monitor, then Logs).'],
    ok: ['the crawler is working again', () => 'Nothing to do.'],
  },
  {
    match: /SiteErrors/,
    alarm: ['the site is erroring',
      () => 'More than 5% of visits failed for 15 minutes.\nWhat to do: open jazzlineup.com and check it loads.'],
    ok: ['the site is back to normal', () => 'Nothing to do.'],
  },
];

export function alarmEmail(event) {
  const d = event?.detail ?? {};
  const now = d.state?.value;
  const before = d.previousState?.value;
  if (!now || now === 'INSUFFICIENT_DATA' || before === 'INSUFFICIENT_DATA') return null;
  const name = String(d.alarmName ?? '');
  const def = ALARMS.find((a) => a.match.test(name));
  const t = etTime(d.state?.timestamp ?? event.time ?? Date.now());
  if (!def) {
    const short = name.replace(/^JazzLineup-/, '').replace(/[A-F0-9]{8}-\w+$/, '');
    return {
      subject: `Jazz Lineup: alarm ${short} is ${now === 'ALARM' ? 'on' : 'off'}`,
      message: `${d.configuration?.description ?? short}\nSince ${t}.`,
    };
  }
  const [what, body] = now === 'ALARM' ? def.alarm : def.ok;
  if (!what) return null;
  // CrawlerStopped fires 8h after the last run; say when updates stopped
  const since = now === 'ALARM' && def.match.source === 'CrawlerStopped'
    ? etTime(new Date(new Date(d.state?.timestamp ?? event.time ?? Date.now()).getTime() - 8 * 3600e3).toISOString())
    : t;
  return { subject: `Jazz Lineup: ${what}`, message: body(since) };
}
