import React, { useMemo, useState } from 'react';
import { fmtSets, fmtDateHeading } from '../api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_PER_CELL = 4;

export default function MonthGrid({ events, clubById, cursor, onCursor, today }) {
  const [openDay, setOpenDay] = useState(null);

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

  const isoOf = (d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const nav = (delta) => {
    const nd = new Date(y, m - 1 + delta, 1);
    onCursor({ y: nd.getFullYear(), m: nd.getMonth() + 1 });
    setOpenDay(null);
  };

  return (
    <div className="monthwrap">
      <div className="monthnav">
        <button onClick={() => nav(-1)} aria-label="previous month">&larr;</button>
        <h2>{MONTHS[m - 1]} {y}</h2>
        <button onClick={() => nav(1)} aria-label="next month">&rarr;</button>
      </div>

      <div className="grid dow-row">
        {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
      </div>
      <div className="grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cell empty" />;
          const iso = isoOf(d);
          const dayEvents = byDate[iso] ?? [];
          const extra = dayEvents.length - MAX_PER_CELL;
          return (
            <div key={i} className={'cell' + (iso === today ? ' today' : '') + (iso < today ? ' past' : '')}>
              <div className="daynum">{d}</div>
              {dayEvents.slice(0, MAX_PER_CELL).map((e) => (
                <a key={e.id} className="ev" href={e.url ?? '#'} target="_blank" rel="noreferrer"
                  style={{ borderLeftColor: clubById[e.clubId]?.color ?? '#888' }}
                  title={`${e.title} — ${clubById[e.clubId]?.name}${e.sets.length ? ' · ' + fmtSets(e.sets) : ''}`}>
                  <span className="ev-title">{e.title}</span>
                </a>
              ))}
              {extra > 0 && (
                <button className="more" onClick={() => setOpenDay(openDay === iso ? null : iso)}>
                  {openDay === iso ? 'less' : `+${extra} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {openDay && byDate[openDay] && (
        <div className="daypanel">
          <h3>{fmtDateHeading(openDay)}</h3>
          {byDate[openDay].map((e) => {
            const club = clubById[e.clubId];
            return (
              <a key={e.id} className="row" href={e.url ?? '#'} target="_blank" rel="noreferrer">
                <span className="badge" style={{ background: club?.color }}>{club?.shortName}</span>
                <span className="row-title">{e.title}</span>
                <span className="row-sets">{fmtSets(e.sets)}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
