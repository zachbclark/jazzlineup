import React, { useEffect, useMemo, useState } from 'react';
import { fetchData, initialCity, todayIso } from './api';
import { useIsMobile } from './useIsMobile';
import CitySwitcher from './components/CitySwitcher';
import BoroughBar from './components/BoroughBar';
import FilterBar from './components/FilterBar';
import MonthGrid from './components/MonthGrid';
import ListView from './components/ListView';

export default function App() {
  const [clubs, setClubs] = useState([]);
  const [events, setEvents] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // null = all clubs; else Set of ids
  const [borough, setBorough] = useState(null); // null = all boroughs
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
        setActive(null); // filters reset when the city changes
        setBorough(null);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [city]);

  const changeCity = (id) => {
    setCity(id);
    localStorage.setItem('jl.city', id);
    window.history.pushState({}, '', '/' + id);
  };

  const clubById = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs]);

  // Borough scope narrows first; the venue-chip set applies on top of it.
  const boroughs = useMemo(
    () => [...new Set(clubs.map((c) => c.borough).filter(Boolean))],
    [clubs]
  );
  const scopedClubs = useMemo(
    () => (borough ? clubs.filter((c) => c.borough === borough) : clubs),
    [clubs, borough]
  );
  const visible = useMemo(() => {
    const inScope = new Set(scopedClubs.map((c) => c.id));
    return events.filter((e) => inScope.has(e.clubId) && (active === null || active.has(e.clubId)));
  }, [events, active, scopedClubs]);
  const shownClubCount = scopedClubs.filter((c) => active === null || active.has(c.id)).length;

  const toggleClub = (id) => {
    setActive((prev) => {
      const next = new Set(prev ?? clubs.map((c) => c.id));
      if (next.has(id)) next.delete(id); else next.add(id);
      return next.size === clubs.length ? null : next;
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
        // "All clubs" toggles: everything on <-> everything off
        onAll={() => setActive((prev) => (prev === null ? new Set() : null))}
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
      </footer>
    </div>
  );
}
