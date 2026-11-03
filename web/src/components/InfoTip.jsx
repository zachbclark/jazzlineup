import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ⓘ in the header: the home for features nobody would otherwise discover
// (drag-to-reorder above all). Popover matches the city menu; closes on
// outside click or Escape.
export default function InfoTip() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);

  // the footer wraps differently at every phone width, so the button moves;
  // nudge the panel back inside the screen before it paints
  useLayoutEffect(() => {
    const m = menuRef.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    const pad = 12;
    const shift = r.right > innerWidth - pad ? innerWidth - pad - r.right
      : r.left < pad ? pad - r.left : 0;
    if (shift) m.style.transform = `translateX(${Math.round(shift)}px)`;
  }, [open]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <span className="info-tip" ref={ref}>
      <button
        className="info-btn"
        aria-label="Tips"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        i
      </button>
      {open && (
        <div className="info-menu" ref={menuRef}>
          <h4>Tips</h4>
          <p><b>Search</b> Any musician, leader or band member.</p>
          <p><b>Save</b> Tap a venue, then &#9733;.</p>
          <p><b>Reorder</b> Drag venues. Hold first on mobile.</p>
          <p><b>Archive</b> Every past show since July 2026.</p>
        </div>
      )}
    </span>
  );
}
