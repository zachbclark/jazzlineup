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
          <p>Search any musician. Sideman gigs count too.</p>
          <p>Tap a venue chip to see just that club. Tap more to add them.</p>
          <p>Save picks makes a selection yours. My clubs brings it back.</p>
          <p>Drag chips to reorder them. Press and hold first on a phone.</p>
          <p>Your order and picks are remembered on this device.</p>
        </div>
      )}
    </span>
  );
}
