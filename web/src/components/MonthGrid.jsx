import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtSets, fmtDateHeading, mainArtist } from '../api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_PER_CELL = 4;
const MAX_DOTS = 6;

export default function MonthGrid({ events, clubById, cursor, onCursor, today, compact = false }) {
  const [openDay, setOpenDay] = useState(null);
  const userTapped = useRef(false); // guards the one-time auto-select of today

  const byDate = useMemo(() => {
    const m = {};
    for (const e of events) (m[e.date] ??= []).push(e);
    return m;
  }, [events]);

  const { y, m } = cursor;
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const isoOf = (d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const nav = (delta) => {
    const nd = new Date(y, m - 1 + delta, 1);
    onCursor({ y: nd.getFullYear(), m: nd.getMonth() + 1 });
    setOpenDay(null);
  };
  const toggleDay = (iso) => {
    userTapped.current = true;
    setOpenDay(openDay === iso ? null : iso);
  };

  // Open with today pre-selected (if the visible month is the current one and
  // today has shows) so the calendar is useful before the first tap.
  useEffect(() => {
    if (openDay === null && !userTapped.current
        && today.startsWith(`${y}-${String(m).padStart(2, '0')}`)
        && byDate[today]?.length) {
      setOpenDay(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, y, m]);

  return (
    <div className="monthwrap">
      <div className="monthnav">
        <button onClick={() => nav(-1)} aria-label="previous month">&larr;</button>
        <h2>{MONTHS[m - 1]} {y}</h2>
        <button onClick={() => nav(1)} aria-label="next month">&rarr;</button>
      </div>

      {events.length === 0 && (
        <div className="empty-list">No clubs selected — tap a club above to see shows.</div>
      )}
      <div className="grid dow-row">
        {DOW.map((d) => <div key={d} className="dow">{compact ? d[0] : d}</div>)}
      </div>
      <div className="grid">
        {weeks.map((week, wi) => (
          <React.Fragment key={wi}>
            {week.map((d, i) => renderCell(d, wi * 7 + i))}
            {/* Inline expansion: the day detail opens directly beneath the
                tapped week row, so it appears at eye level with no scrolling. */}
            {openDay && byDate[openDay] && week.some((d) => d !== null && isoOf(d) === openDay) && (
              <div className="daypanel inline">
                <h3>{fmtDateHeading(openDay)}</h3>
                {byDate[openDay].map((e) => {
                  const club = clubById[e.clubId];
                  return (
                    <a key={e.id} className="row" href={e.url ?? '#'} target="_blank" rel="noreferrer">
                      <span className="badge" style={{ background: club?.color }}>{club?.shortName}</span>
                      <span className="row-title">
                        {e.title}
                        {e.details && <span className="row-details">{e.details}</span>}
                      </span>
                      <span className="row-sets">{fmtSets(e.sets)}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  function renderCell(d, i) {
          if (d === null) return <div key={i} className="cell empty" />;
          const iso = isoOf(d);
          const dayEvents = byDate[iso] ?? [];
          const extra = dayEvents.length - MAX_PER_CELL;
          const classes = 'cell'
            + (iso === today ? ' today' : '')
            + (iso < today ? ' past' : '')
            + (dayEvents.length ? ' has-events' : '')
            + (openDay === iso ? ' open' : '');

          // Compact (phone): day number + colored dots; tap opens the day panel.
          if (compact) {
            return (
              <button
                key={i}
                className={classes}
                onClick={() => dayEvents.length && toggleDay(iso)}
                aria-label={`${fmtDateHeading(iso)}: ${dayEvents.length} shows`}
              >
                <div className="daynum">{d}</div>
                <div className="dotrow">
                  {dayEvents.slice(0, MAX_DOTS).map((e) => (
                    <span key={e.id} className="dot-sm"
                      style={{ background: clubById[e.clubId]?.color ?? '#888' }} />
                  ))}
                  {dayEvents.length > MAX_DOTS && <span className="dot-extra">+</span>}
                </div>
              </button>
            );
          }

          // Full (desktop): event titles inline; whole cell also opens the panel.
          return (
            <div key={i} className={classes}
              onClick={() => dayEvents.length && toggleDay(iso)}
              role={dayEvents.length ? 'button' : undefined}>
              <div className="daynum">{d}</div>
              {dayEvents.slice(0, MAX_PER_CELL).map((e) => (
                <a key={e.id} className="ev" href={e.url ?? '#'} target="_blank" rel="noreferrer"
                  onClick={(ev) => ev.stopPropagation()}
                  style={{ borderLeftColor: clubById[e.clubId]?.color ?? '#888' }}
                  title={`${e.title} — ${clubById[e.clubId]?.name}${e.sets.length ? ' · ' + fmtSets(e.sets) : ''}`}>
                  <span className="ev-title">{mainArtist(e.title)}</span>
                </a>
              ))}
              {extra > 0 && (
                <button className="more" onClick={(ev) => { ev.stopPropagation(); toggleDay(iso); }}>
                  {openDay === iso ? 'less' : `+${extra} more`}
                </button>
              )}
            </div>
          );
  }
}
