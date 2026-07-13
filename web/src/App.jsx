import React, { useEffect, useMemo, useState } from 'react';
import { fetchClubs, fetchEvents, todayIso } from './api';
import FilterBar from './components/FilterBar';
import MonthGrid from './components/MonthGrid';
import ListView from './components/ListView';

export default function App() {
  const [clubs, setClubs] = useState([]);
  const [events, setEvents] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // null = all clubs; else Set of ids
  const [view, setView] = useState('month'); // 'month' | 'list'
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  useEffect(() => {
    Promise.all([fetchClubs(), fetchEvents()])
      .then(([cs, ev]) => {
        setClubs(cs);
        setEvents(ev.events);
        setGeneratedAt(ev.generatedAt);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const clubById = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs]);

  const visible = useMemo(
    () => (active ? events.filter((e) => active.has(e.clubId)) : events),
    [events, active]
  );

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
          <span className="brand-note">&#9835;</span> JazzMap <span className="brand-nyc">NYC</span>
        </div>
        <div className="view-toggle" role="tablist">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Calendar</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </header>

      <FilterBar
        clubs={clubs}
        active={active}
        onToggle={toggleClub}
        onAll={() => setActive(null)}
      />

      {error && <div className="error">Couldn&rsquo;t load shows: {error}</div>}

      {view === 'month' ? (
        <MonthGrid
          events={visible}
          clubById={clubById}
          cursor={cursor}
          onCursor={setCursor}
          today={todayIso()}
        />
      ) : (
        <ListView events={visible} clubById={clubById} today={todayIso()} />
      )}

      <footer className="foot">
        {generatedAt && <span>Data crawled {new Date(generatedAt).toLocaleString()}</span>}
        <span className="foot-sep">&middot;</span>
        <span>{visible.length} shows across {active ? active.size : clubs.length} clubs</span>
      </footer>
    </div>
  );
}
