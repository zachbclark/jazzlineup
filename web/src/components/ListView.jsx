import React, { useEffect, useMemo, useState } from 'react';
import { fmtSets, fmtDateHeading } from '../api';
import Personnel from './Personnel';

export default function ListView({ events, clubById, today }) {
  const [showJump, setShowJump] = useState(false);

  const groups = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      if (e.date < today) continue;
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date).push(e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [events, today]);

  // Floating "Tonight" button appears once the user has scrolled away.
  useEffect(() => {
    const onScroll = () => setShowJump(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!groups.length) return <div className="empty-list">No upcoming shows match the current filters.</div>;

  return (
    <div className="listview">
      {groups.map(([date, evs]) => (
        <section key={date} className="daygroup">
          <h3 className={date === today ? 'today-heading' : ''}>
            {fmtDateHeading(date)}
            {date === today && <span className="tonight">Tonight</span>}
          </h3>
          {evs.map((e) => {
            const club = clubById[e.clubId];
            return (
              <a key={e.id} className="row" href={e.url ?? '#'} target="_blank" rel="noreferrer">
                <span className="badge" style={{ background: club?.color }}>{club?.shortName}</span>
                <span className="row-title">
                  {e.title}
                  {e.personnel?.length
                    ? <span className="row-details"><Personnel personnel={e.personnel} /></span>
                    : e.details && <span className="row-details">{e.details}</span>}
                </span>
                <span className="row-sets">{fmtSets(e.sets)}</span>
              </a>
            );
          })}
        </section>
      ))}
      {showJump && (
        <button className="jump-tonight" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          &#9835; Tonight
        </button>
      )}
    </div>
  );
}
