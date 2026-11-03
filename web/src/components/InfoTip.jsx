import React, { useEffect, useRef, useState } from 'react';

// ⓘ in the header: the home for features nobody would otherwise discover
// (drag-to-reorder above all). Popover matches the city menu; closes on
// outside click or Escape.
export default function InfoTip() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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
        <div className="info-menu">
          <h4>Tips</h4>
          <p>Search any musician. Sidemen count too.</p>
          <p>Tap venues to filter. Star the ones you like.</p>
          <p>Drag to reorder. On a phone, hold first.</p>
        </div>
      )}
    </span>
  );
}
