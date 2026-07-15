import React from 'react';

export default function FilterBar({ clubs, active, onToggle, onAll }) {
  return (
    <div className="filterbar">
      <button className={'chip chip-all' + (active === null ? ' on' : '')} onClick={onAll}>
        All clubs
      </button>
      {clubs.map((c) => {
        const on = active === null || active.has(c.id);
        return (
          <button
            key={c.id}
            className={'chip' + (on ? ' on' : '')}
            style={on ? {
              borderColor: c.color,
              background: c.color + '22',
              // the one glow tier: active venue chips halo in their own color
              boxShadow: `0 0 12px ${c.color}55`,
            } : undefined}
            onClick={() => onToggle(c.id)}
            title={`${c.name} — ${c.neighborhood}`}
          >
            <span className="dot" style={{ background: c.color }} />
            {c.shortName}
          </button>
        );
      })}
    </div>
  );
}
