import React, { useEffect, useMemo, useState } from 'react';
import { fetchData, initialCity, todayIso } from './api';
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
  const [city, setCity] = useState(initialCity);
  // Everyone lands on the calendar; today is pre-selected so tonight's
  // lineup shows in the day drawer immediately.
  const [view, setView] = useState('month');
  const isMobile = useIsMobile();
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

  const changeCity = (id) => {
    setCity(id);
    localStorage.setItem('jl.city', id);
    window.history.pushState({}, '', '/' + id);
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
  const shownClubCount = scopedClubs.filter((c) => active === null || active.has(c.id)).length;

  const toggleClub = (id) => {
    setActive((prev) => {
      const next = new Set(prev ?? clubs.map((c) => c.id));
      if (next.has(id)) next.delete(id); else next.add(id);
      const result = next.size === clubs.length ? null : next;
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
        <div className="view-toggle" role="tablist">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Calendar</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </header>

      <BoroughBar boroughs={boroughs} borough={borough} onChange={setBorough} />

      <FilterBar
        clubs={scopedClubs}
        active={active}
        onToggle={toggleClub}
        onReorder={reorderClub}
        onReorderEnd={persistOrder}
        hasCustomOrder={order !== null}
        onResetOrder={resetOrder}
        // "All clubs" toggles: everything on <-> everything off
        onAll={() => setActive((prev) => {
          const result = prev === null ? new Set() : null;
          persistActive(result);
          return result;
        })}
      />

      {error && <div className="error">Couldn&rsquo;t load shows: {error}</div>}

      {view === 'month' ? (
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
        {generatedAt && <span>Data crawled {new Date(generatedAt).toLocaleString()}</span>}
        <span className="foot-sep">&middot;</span>
        <span>{visible.length} shows across {shownClubCount} clubs</span>
        <span className="foot-sep">&middot;</span>
        <a className="tip-jar" href={TIP_URL} target="_blank" rel="noreferrer"
          title="Enjoying the site? Buy me a drink.">
          &#9835; tip jar
        </a>
      </footer>
    </div>
  );
}
