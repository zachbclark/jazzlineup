import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CITIES, citySlug, setClock24, fmtSets } from '../api';
import CitySwitcher from '../components/CitySwitcher';
import SearchBox from '../components/SearchBox';
import { loadIndex, loadMonth, loadAllMonths, loadMusicians, norm, musicianKey, showMatches } from './history';

// The archive: every past show since July 21, 2026, with who played.
// Its own page at /archive/<city>[/YYYY-MM[-DD]][?q=name]. The URL is the
// only source of truth for what's on screen, so Back always works.
const START = '2026-07-21';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseRoute() {
  const segs = window.location.pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());
  const match = CITIES.find((c) => c.slug === segs[1] || c.id === segs[1]);
  let city = match?.id;
  if (!city) {
    try { const saved = localStorage.getItem('jl.city'); city = CITIES.some((c) => c.id === saved) ? saved : 'nyc'; } catch { city = 'nyc'; }
  }
  const when = segs[2] ?? '';
  const q = new URLSearchParams(window.location.search).get('q') ?? '';
  return {
    city,
    date: /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : null,
    month: /^\d{4}-\d{2}$/.test(when) ? when : (/^\d{4}-\d{2}-\d{2}$/.test(when) ? when.slice(0, 7) : null),
    q,
  };
}

function formatRoute({ city, date, month, q }) {
  let p = `/archive/${citySlug(city)}`;
  if (date) p += `/${date}`; else if (month) p += `/${month}`;
  return q ? `${p}?q=${encodeURIComponent(q)}` : p;
}

const longDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthName = (ym) => new Date(ym + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const shiftDay = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const cityLabel = (id) => CITIES.find((c) => c.id === id)?.label ?? id;

export default function ArchivePage() {
  const [route, setRoute] = useState(parseRoute);
  const { city, q } = route;
  const [index, setIndex] = useState(undefined); // undefined = loading, null = failed
  const [monthData, setMonthData] = useState(null);
  const [allMonths, setAllMonths] = useState(null);
  const [musicians, setMusicians] = useState(null);
  const [query, setQueryState] = useState(route.q);

  const navigate = useCallback((next, { replace = false } = {}) => {
    const r = { ...route, ...next };
    const url = formatRoute(r);
    if (replace) window.history.replaceState(null, '', url); else window.history.pushState(null, '', url);
    setRoute(r);
  }, [route]);

  useEffect(() => {
    const onPop = () => { const r = parseRoute(); setRoute(r); setQueryState(r.q); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    setClock24(CITIES.find((c) => c.id === city)?.clock24);
    try { localStorage.setItem('jl.city', city); } catch {}
    setIndex(undefined); setMonthData(null); setAllMonths(null);
    loadIndex(city).then((ix) => setIndex(ix));
  }, [city]);

  // which month and night are on screen
  const lastNight = index?.throughDate ?? null;
  const month = route.month ?? lastNight?.slice(0, 7) ?? null;
  const night = route.date ?? (month && monthData?.shows?.length
    ? (route.month ? monthData.shows[0].date : lastNight)
    : null);

  useEffect(() => {
    if (!index || !month) return;
    setMonthData(null);
    loadMonth(city, month).then((m) => setMonthData(m ?? { shows: [], gaps: [] }));
  }, [city, month, index]);

  // search loads every month of the city (small today: NYC is 4 months)
  useEffect(() => {
    if (!q || !index) return;
    if (!allMonths) loadAllMonths(city, index).then(setAllMonths);
    if (!musicians) loadMusicians().then(setMusicians);
  }, [q, city, index, allMonths, musicians]);

  const venues = useMemo(() => Object.fromEntries((index?.venues ?? []).map((v) => [v.id, v])), [index]);

  const setQuery = (v) => {
    setQueryState(v);
    // first keystroke is a new history entry, the rest replace it
    navigate({ q: v.trim() }, { replace: !!route.q || !v });
  };

  const pickNight = (d) => { setQueryState(''); navigate({ date: d, month: d.slice(0, 7), q: '' }); window.scrollTo({ top: 0 }); };
  const searchName = (name) => { setQueryState(name); navigate({ q: name }); window.scrollTo({ top: 0 }); };
  const changeCity = (c) => navigate({ city: c });

  useEffect(() => {
    document.title = q ? `Jazz Lineup archive: "${q}" in ${cityLabel(city)}`
      : night ? `Jazz Lineup archive: ${cityLabel(city)}, ${shortDate(night)}` : `Jazz Lineup archive: ${cityLabel(city)}`;
  }, [city, night, q]);

  return (
    <div className="app archive">
      <header className="topbar">
        <div className="brand">
          <a className="brand-link" href={'/' + citySlug(city)} aria-label="Jazz Lineup home">
            <span className="brand-note">&#9835;</span> Jazz<span className="brand-accent">Lineup</span>
          </a>
          <CitySwitcher city={city} onChange={changeCity} />
        </div>
        <SearchBox query={query} onChange={setQuery} />
        <div className="view-toggle" role="tablist">
          <a href={'/' + citySlug(city)} aria-label="Calendar view">
            <span className="vt-icon" aria-hidden="true">&#9638;</span>
            <span className="vt-label">Calendar</span>
          </a>
          <a href={'/' + citySlug(city) + '?view=list'} aria-label="List view">
            <span className="vt-icon" aria-hidden="true">&#9776;</span>
            <span className="vt-label">List</span>
          </a>
          <button className="on" aria-label="Archive of past shows" aria-current="page">
            <span className="vt-icon" aria-hidden="true">&#9719;</span>
            <span className="vt-label">Archive</span>
          </button>
        </div>
      </header>
      <p className="archive-intro">
        <span className="beta-tag">beta</span>
        Every show since July 21, 2026, with who played. Pick a night or search a musician.
        {index?.throughDate && <span className="archive-through"> Updated through {shortDate(index.throughDate)}.</span>}
      </p>

      {index === undefined && <div className="empty-list">Loading the archive&hellip;</div>}
      {index === null && <div className="empty-list">Couldn&rsquo;t load the archive. Try again in a bit.</div>}

      {index && q && (
        <SearchResults q={q} city={city} months={allMonths} musicians={musicians} venues={venues}
          onNight={pickNight} onName={searchName} onCity={(c) => navigate({ city: c })} />
      )}

      {index && !q && (
        <div className="archive-cols">
          <ArchiveCalendar month={month} data={monthData} night={night} venues={venues}
            first={index.firstDate ?? START} last={lastNight}
            onMonth={(ym) => navigate({ month: ym, date: null })} onNight={pickNight} />
          <NightView night={night} data={monthData} venues={venues} first={index.firstDate ?? START} last={lastNight}
            onNight={pickNight} onName={searchName} city={city} />
        </div>
      )}

      <footer className="archive-foot">
        Shows are saved from each venue&rsquo;s own calendar every day. Lineups are as the venue listed them.
      </footer>
    </div>
  );
}

function ArchiveCalendar({ month, data, night, venues, first, last, onMonth, onNight }) {
  if (!month) return null;
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = new Map();
  for (const s of data?.shows ?? []) {
    if (s.status === 'cancelled') continue;
    (byDay.get(s.date) ?? byDay.set(s.date, []).get(s.date)).push(s);
  }
  const canPrev = shiftMonth(month, -1) >= first.slice(0, 7);
  const canNext = last && shiftMonth(month, 1) <= last.slice(0, 7);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(<span key={'b' + i} className="ac-cell blank" />);
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const shows = byDay.get(iso) ?? [];
    const filed = iso >= first && last && iso <= last;
    const dots = [...new Set(shows.map((s) => s.venueId))].slice(0, 6);
    cells.push(
      <button key={iso} className={'ac-cell' + (iso === night ? ' on' : '') + (filed ? '' : ' off')}
        disabled={!filed} onClick={() => onNight(iso)}
        aria-label={`${shortDate(iso)}: ${shows.length} shows`}>
        <span className="ac-num">{d}</span>
        <span className="ac-dots">
          {dots.map((v) => <i key={v} style={{ background: venues[v]?.color ?? '#777' }} />)}
        </span>
        {shows.length > 0 && <span className="ac-count">{shows.length}</span>}
      </button>,
    );
  }
  return (
    <aside className="archive-cal">
      <div className="ac-nav">
        <button disabled={!canPrev} onClick={() => onMonth(shiftMonth(month, -1))} aria-label="Previous month">&larr;</button>
        <span>{monthName(month)}</span>
        <button disabled={!canNext} onClick={() => onMonth(shiftMonth(month, 1))} aria-label="Next month">&rarr;</button>
      </div>
      <div className="ac-grid">
        {WEEKDAYS.map((w) => <span key={w} className="ac-wd">{w[0]}</span>)}
        {cells}
      </div>
    </aside>
  );
}

function NightView({ night, data, venues, first, last, onNight, onName, city }) {
  if (!data) return <section className="archive-night"><div className="empty-list">Loading&hellip;</div></section>;
  if (!night) return <section className="archive-night"><div className="empty-list">No shows on file for this month.</div></section>;
  const shows = data.shows.filter((s) => s.date === night);
  const live = shows.filter((s) => s.status !== 'cancelled');
  const cancelled = shows.filter((s) => s.status === 'cancelled');
  const venueCount = new Set(live.map((s) => s.venueId)).size;
  const down = (data.gaps ?? []).filter((g) => g.from <= night && g.to >= night).map((g) => venues[g.venueId]?.name ?? g.venueId);
  const canPrev = shiftDay(night, -1) >= first;
  const canNext = last && shiftDay(night, 1) <= last;
  return (
    <section className="archive-night">
      <div className="an-head">
        <button disabled={!canPrev} onClick={() => onNight(shiftDay(night, -1))} aria-label="Previous night">&lsaquo;</button>
        <h2>{longDate(night)}</h2>
        <button disabled={!canNext} onClick={() => onNight(shiftDay(night, 1))} aria-label="Next night">&rsaquo;</button>
      </div>
      <p className="an-count">
        {live.length ? `${live.length} show${live.length === 1 ? '' : 's'} at ${venueCount} venue${venueCount === 1 ? '' : 's'}` : 'No shows on file for this night.'}
        {cancelled.length > 0 && ` · ${cancelled.length} cancelled`}
      </p>
      <div className="listview">
        {[...live, ...cancelled].map((s) => <ArchiveRow key={s.id} show={s} venue={venues[s.venueId]} onName={onName} />)}
      </div>
      {down.length > 0 && (
        <p className="an-note">
          {down.length === 1
            ? `Couldn't read ${down[0]}'s site this night, so some shows may be missing.`
            : `Couldn't read these venues' sites this night: ${down.join(', ')}. Some shows may be missing.`}
        </p>
      )}
    </section>
  );
}

function ArchiveRow({ show, venue, onName, showDate = false, highlight = '' }) {
  const hl = (name) => highlight && musicianKey(name) === highlight;
  return (
    <div className={'row archive-row' + (show.status === 'cancelled' ? ' is-cancelled' : '')}>
      <span className="badge" style={{ background: venue?.color ?? '#777' }}>{venue?.shortName ?? show.venueId}</span>
      <span className="row-title">
        {showDate && <span className="ar-date">{shortDate(show.date)} · </span>}
        {/* no venue links on past shows: their event pages are usually gone.
            A saved copy (Internet Archive) link replaces this once captures exist. */}
        <span className="ar-title">{show.title}</span>
        {show.titleAlt && <span className="title-alt">{show.titleAlt}</span>}
        {show.replaced?.length > 0 && (
          <span className="ar-replaced">originally listed: {show.replaced.join(', ')}</span>
        )}
        {show.lineup.length > 0 && (
          <span className="row-details roster personnel">
            {show.lineup.map((p, i) => (
              <span key={i} className="p-member">
                <button className={'ar-name' + (hl(p.name) ? ' hl' : '')} onClick={() => onName(p.name)}>{p.name}</button>
                {p.instrument ? <> <span className="p-inst">{p.instrument.replace(/\bsaxophones?\b/g, 'sax')}</span></> : null}
                {i < show.lineup.length - 1 && <span className="p-sep"> · </span>}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="row-sets">
        {show.status === 'unconfirmed' && (
          <span className="late-tag status-tag" title="Couldn't read this venue's site around this date, so it may not have happened.">unconfirmed</span>
        )}
        {show.status === 'cancelled' && (
          <span className="late-tag status-tag" title="Came off the venue's calendar before the date.">cancelled</span>
        )}
        {show.late && <span className="late-tag">late</span>}
        {fmtSets(show.sets)}
      </span>
    </div>
  );
}

function SearchResults({ q, city, months, musicians, venues, onNight, onName, onCity }) {
  const nq = norm(q);
  const key = musicianKey(q);
  const results = useMemo(() => {
    if (!months) return null;
    const out = [];
    for (const m of months) for (const s of m.shows) {
      const byKey = s.lineup.some((p) => p.musician === key);
      if (byKey || showMatches(s, nq, venues[s.venueId]?.name)) out.push(s);
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [months, nq, key, venues]);
  const who = musicians?.musicians?.find((m) => m.key === key);
  const elsewhere = who ? Object.entries(who.cities).filter(([c]) => c !== city) : [];

  if (!results) return <div className="empty-list">Searching the archive&hellip;</div>;
  const played = results.filter((s) => s.status !== 'cancelled');
  const groups = new Map();
  for (const s of results) (groups.get(s.date.slice(0, 7)) ?? groups.set(s.date.slice(0, 7), []).get(s.date.slice(0, 7))).push(s);

  return (
    <section className="archive-search">
      <p className="search-summary">
        {played.length
          ? <><strong>{who?.name ?? q}</strong> · {played.length} show{played.length === 1 ? '' : 's'} in {cityLabel(city)} since {monthName(START.slice(0, 7))}</>
          : <>Nothing in the {cityLabel(city)} archive for &ldquo;{q}&rdquo;. It goes back to July 21, 2026. Try a last name or another city.</>}
        {elsewhere.map(([c, n]) => (
          <button key={c} className="other-city" onClick={() => onCity(c)}>{n} in {cityLabel(c)} &rarr;</button>
        ))}
      </p>
      {[...groups.entries()].map(([ym, list]) => (
        <div key={ym} className="daygroup">
          <h3>{monthName(ym)}</h3>
          {list.map((s) => (
            <div key={s.id} className="ar-result">
              <button className="ar-night" onClick={() => onNight(s.date)}>{shortDate(s.date)}</button>
              <ArchiveRow show={s} venue={venues[s.venueId]} onName={onName} highlight={key} />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
