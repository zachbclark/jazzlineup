import React, { useEffect, useRef, useState } from 'react';
import { CITIES } from '../api';

// The city badge next to the wordmark, now a dropdown. Closes on outside
// click or Escape. Cities with no data yet still render (empty calendar).
export default function CitySwitcher({ city, onChange }) {
  const [open, setOpen] = useState(false);
  // First-visit whisper ("← choose your city") — greets once, then gone:
  // the flag is set on first load, so a return visit never shows it, and
  // touching the switcher hides it immediately. (Brian's idea, quieted.)
  const [hint, setHint] = useState(() => {
    try {
      if (localStorage.getItem('jl.cityhint')) return false;
      localStorage.setItem('jl.cityhint', '1');
      return true;
    } catch { return false; }
  });
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
        onClick={() => { setOpen(!open); setHint(false); }}
      >
        {current.label} <span className="caret">{open ? '▴' : '▾'}</span>
      </button>
      {hint && <span className="city-hint" aria-hidden="true">&larr; choose your city</span>}
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
