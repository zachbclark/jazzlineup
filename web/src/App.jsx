import React, { useEffect, useMemo, useState } from 'react';
import { CITIES, fetchData, initialCity, todayIso, relTime, searchNorm, eventMatches, setClock24, citySlug } from './api';
import SearchBox from './components/SearchBox';
import { useIsMobile } from './useIsMobile';
import CitySwitcher from './components/CitySwitcher';
import BoroughBar from './components/BoroughBar';
import FilterBar from './components/FilterBar';
import MonthGrid from './components/MonthGrid';
import ListView from './components/ListView';

// Tip jar — "buy me a drink"
const TIP_URL = 'https://ko-fi.com/jazzlineup';

export default function App() {
  const [clubs, setClubs] = useState([]);
  const [events, setEvents] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // null = all clubs; else Set of ids
  const [borough, setBorough] = useState(null); // null = all boroughs
  const [order, setOrder] = useState(null); // saved chip order (array of ids) per city
  const [query, setQuery] = useState(''); // artist search
  const [otherCityEvents, setOtherCityEvents] = useState({}); // cityId -> events (lazy, for cross-city hint)
  const [city, setCity] = useState(initialCity);
  // Everyone lands on the calendar; today is pre-selected so tonight's
  // lineup shows in the day drawer immediately.
  const [view, setView] = useState('month');
  const isMobile = useIsMobile();
  // synchronous (not an effect): time formatting must be right on the same
  // render that shows the new city's events
  setClock24(CITIES.find((c) => c.id === city)?.clock24 ?? false);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  useEffect(() => {
    setError(null);
    fetchData(city)
      .then((d) => {
        setClubs(d.clubs);
        setEvents(d.events);
        setGeneratedAt(d.generatedAt);
        setBorough(null);
        // restore this city's saved chip selection (null = everything on)
        try {
          const saved = JSON.parse(localStorage.getItem(`jl.active.${city}`));
          setActive(Array.isArray(saved) ? new Set(saved) : null);
        } catch { setActive(null); }
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [city]);

  const cityLabel = CITIES.find((c) => c.id === city)?.label ?? city.toUpperCase();

  // Keep the browser tab honest when switching cities (was stuck on NYC).
  useEffect(() => {
    document.title = `Jazz Lineup: live jazz in ${cityLabel} tonight`;
  }, [cityLabel]);

  const changeCity = (id) => {
    setCity(id);
    localStorage.setItem('jl.city', id);
    window.history.pushState({}, '', '/' + citySlug(id));
  };

  // Chip order is saved per (city, borough scope): each of All / Manhattan /
  // Brooklyn / Queens keeps its own arrangement.
  const orderKey = `jl.order.${city}.${borough ?? 'all'}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(orderKey))
        ?? (borough === null ? JSON.parse(localStorage.getItem(`jl.order.${city}`)) : null); // pre-borough legacy key
      setOrder(Array.isArray(saved) ? saved : null);
    } catch { setOrder(null); }
  }, [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistActive = (val) => {
    if (val === null) localStorage.removeItem(`jl.active.${city}`);
    else localStorage.setItem(`jl.active.${city}`, JSON.stringify([...val]));
  };

  const clubById = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs]);

  // Saved chip order applies first (unknown/new clubs append in registry
  // order), then borough scope narrows, then the venue-chip set filters.
  const orderedClubs = useMemo(() => {
    if (!order) return clubs;
    const byId = Object.fromEntries(clubs.map((c) => [c.id, c]));
    const saved = order.map((id) => byId[id]).filter(Boolean);
    const rest = clubs.filter((c) => !order.includes(c.id));
    return [...saved, ...rest];
  }, [clubs, order]);

  // Returns true only when the order actually changed, so the drag layer can
  // apply its post-move cooldown to real moves and not to no-op crossings.
  const reorderClub = (dragId, targetId, placeAfter) => {
    const current = orderedClubs.map((c) => c.id);
    const ids = current.filter((id) => id !== dragId);
    const ti = ids.indexOf(targetId);
    if (ti === -1) return false;
    ids.splice(placeAfter ? ti + 1 : ti, 0, dragId);
    if (ids.length === current.length && ids.every((id, i) => id === current[i])) return false;
    setOrder(ids);
    return true;
  };
  // persist once, when the drag ends (not on every crossing)
  const persistOrder = () => {
    setOrder((ids) => {
      if (ids) localStorage.setItem(orderKey, JSON.stringify(ids));
      return ids;
    });
  };
  const resetOrder = () => {
    localStorage.removeItem(orderKey);
    if (borough === null) localStorage.removeItem(`jl.order.${city}`); // legacy key
    setOrder(null);
  };

  const boroughs = useMemo(
    () => [...new Set(clubs.map((c) => c.borough).filter(Boolean))],
    [clubs]
  );
  const scopedClubs = useMemo(
    () => (borough ? orderedClubs.filter((c) => c.borough === borough) : orderedClubs),
    [orderedClubs, borough]
  );
  // Event filtering must NOT depend on chip ORDER — recomputing 1500+ events
  // on every drag crossing is what made reordering feel laggy.
  const scopedIdSet = useMemo(
    () => new Set((borough ? clubs.filter((c) => c.borough === borough) : clubs).map((c) => c.id)),
    [clubs, borough]
  );
  const visible = useMemo(() => {
    return events.filter((e) => scopedIdSet.has(e.clubId) && (active === null || active.has(e.clubId)));
  }, [events, active, scopedIdSet]);

  // Artist search: city-wide, ignores chip/borough filters; results render
  // as a date-grouped list (the natural shape for "his next five dates").
  const normQuery = searchNorm(query.trim());
  const searching = normQuery.length > 0;
  const results = useMemo(
    () => (searching ? events.filter((e) => eventMatches(e, normQuery, clubById)) : null),
    [events, searching, normQuery, clubById]
  );

  const shownEvents = searching ? results : visible;
  const shownClubCount = searching
    ? new Set(results.map((e) => e.clubId)).size
    : scopedClubs.filter((c) => active === null || active.has(c.id)).length;

  // Cross-city hint: while searching, quietly check every OTHER city too and
  // offer a one-tap switch per city with matches (touring artists play all).
  useEffect(() => {
    if (!searching) return;
    for (const oc of CITIES) {
      if (oc.id === city || otherCityEvents[oc.id]) continue;
      fetchData(oc.id)
        .then((d) => setOtherCityEvents((prev) => ({ ...prev, [oc.id]: d.events })))
        .catch(() => { /* hint is best-effort; searching here still works */ });
    }
  }, [searching, city, otherCityEvents]);
  const otherMatches = useMemo(() => {
    if (!searching) return [];
    return CITIES.filter((c) => c.id !== city)
      .map((c) => ({
        city: c,
        count: (otherCityEvents[c.id] ?? []).filter((e) => eventMatches(e, normQuery, null)).length,
      }))
      .filter((x) => x.count > 0);
  }, [searching, normQuery, city, otherCityEvents]);

  // Selection model: from "all on", the first click selects ONLY that club;
  // further clicks add/remove clubs; removing the last one returns to all.
  const toggleClub = (id) => {
    setActive((prev) => {
      let result;
      if (prev === null) {
        result = new Set([id]);
      } else {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        result = (next.size === 0 || next.size === clubs.length) ? null : next;
      }
      persistActive(result);
      return result;
    });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-note">&#9835;</span> Jazz<span className="brand-accent">Lineup</span>
          <CitySwitcher city={city} onChange={changeCity} />
        </div>
        <SearchBox query={query} onChange={setQuery} />
        <div className="view-toggle" role="tablist">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')} aria-label="Calendar view">
            <span className="vt-icon" aria-hidden="true">&#9638;</span>
            <span className="vt-label">Calendar</span>
          </button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view">
            <span className="vt-icon" aria-hidden="true">&#9776;</span>
            <span className="vt-label">List</span>
          </button>
        </div>
      </header>

      {searching && (
        <div className="search-summary">
          {results.length
            ? <><strong>{results.length}</strong> show{results.length === 1 ? '' : 's'} across all {cityLabel} venues</>
            : <>No matches in {cityLabel}</>}
          {otherMatches.map(({ city: oc, count }) => (
            <button key={oc.id} className="other-city" onClick={() => changeCity(oc.id)}>
              {count} in {oc.label} &rarr;
            </button>
          ))}
        </div>
      )}

      {!searching && <BoroughBar boroughs={boroughs} borough={borough} onChange={setBorough} />}

      {!searching && <FilterBar
        clubs={scopedClubs}
        active={active}
        onToggle={toggleClub}
        onReorder={reorderClub}
        onReorderEnd={persistOrder}
        hasCustomOrder={order !== null}
        onResetOrder={resetOrder}
        // "All clubs" is a reset: everything back on
        onAll={() => {
          persistActive(null);
          setActive(null);
        }}
      />}

      {error && <div className="error">Couldn&rsquo;t load shows: {error}</div>}

      {searching ? (
        <ListView events={shownEvents} clubById={clubById} today={todayIso()} />
      ) : view === 'month' ? (
        <MonthGrid
          events={visible}
          clubById={clubById}
          cursor={cursor}
          onCursor={setCursor}
          today={todayIso()}
          compact={isMobile}
        />
      ) : (
        <ListView events={visible} clubById={clubById} today={todayIso()} />
      )}

      <footer className="foot">
        {generatedAt && (
          <span title={new Date(generatedAt).toLocaleString()}>
            Updated {relTime(generatedAt)}
          </span>
        )}
        <span className="foot-sep">&middot;</span>
        <span>{shownEvents.length} shows across {shownClubCount} clubs</span>
        <span className="foot-sep">&middot;</span>
        <a className="tip-jar" href={TIP_URL} target="_blank" rel="noreferrer"
          title="Enjoying the site? Buy me a drink.">
          {/* a literal tip jar: lid, slot, two coins — rattles on hover */}
          <svg className="jar-icon" viewBox="0 0 24 24" width="15" height="15"
            fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <rect x="7.5" y="2.5" width="9" height="3" rx="1" />
            <line x1="10.5" y1="4" x2="13.5" y2="4" strokeWidth="1.1" />
            <path d="M7 5.5 C6 8 5.5 10 5.5 13 c0 5 2.6 8.5 6.5 8.5 s6.5-3.5 6.5-8.5 c0-3-.5-5-1.5-7.5" />
            <circle cx="10.2" cy="17" r="1.7" strokeWidth="1.2" />
            <circle cx="14" cy="18" r="1.7" strokeWidth="1.2" />
          </svg>
          tip jar
        </a>
      </footer>
    </div>
  );
}
