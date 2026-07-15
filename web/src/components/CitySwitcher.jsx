import React, { useEffect, useRef, useState } from 'react';
import { CITIES } from '../api';

// The city badge next to the wordmark, now a dropdown. Closes on outside
// click or Escape. Cities with no data yet still render (empty calendar).
export default function CitySwitcher({ city, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const current = CITIES.find((c) => c.id === city) ?? CITIES[0];

  return (
    <span className="city-switcher" ref={ref}>
      <button
        className="city-badge city-badge-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {current.label} <span className="caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <span className="city-menu" role="listbox">
          {CITIES.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={c.id === city}
              className={'city-option' + (c.id === city ? ' on' : '')}
              onClick={() => { setOpen(false); onChange(c.id); }}
            >
              {c.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
