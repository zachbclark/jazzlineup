import React, { useEffect, useMemo, useState } from 'react';
import { fmtSets, fmtDateHeading } from '../api';
import Personnel from './Personnel';

const DAYS_PER_PAGE = 21; // day-windowed rendering: the full list at 1500+
                          // events makes filter toggles janky on phones

export default function ListView({ events, clubById, today }) {
  const [showJump, setShowJump] = useState(false);
  const [shownDays, setShownDays] = useState(DAYS_PER_PAGE);

  const allGroups = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      if (e.date < today) continue;
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date).push(e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [events, today]);
  const groups = allGroups.slice(0, shownDays);
  const hiddenDays = allGroups.length - groups.length;

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
                    ? <span className="row-details roster"><Personnel personnel={e.personnel} /></span>
                    : e.details && <span className="row-details prose">{e.details}</span>}
                </span>
                <span className="row-sets">
                  {e.late && <span className="late-tag">late</span>}
                  {fmtSets(e.sets)}
                </span>
              </a>
            );
          })}
        </section>
      ))}
      {hiddenDays > 0 && (
        <button className="show-more-days" onClick={() => setShownDays((n) => n + DAYS_PER_PAGE)}>
          Show {Math.min(hiddenDays, DAYS_PER_PAGE)} more days
        </button>
      )}
      {showJump && (
        <button className="jump-tonight" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          &#9835; Tonight
        </button>
      )}
    </div>
  );
}
