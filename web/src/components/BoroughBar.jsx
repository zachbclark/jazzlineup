import React, { useEffect, useRef } from 'react';

// Quiet segmented control above the venue chips: All · Manhattan · Brooklyn.
// Only renders when the city actually spans more than one borough.
// On phones the row swipes sideways when the tabs don't fit (styles.css).
const label = (b) => b.charAt(0).toUpperCase() + b.slice(1).replace(/-/g, ' ');

export default function BoroughBar({ boroughs, borough, onChange }) {
  const ref = useRef(null);

  // fade whichever edge is hiding a tab
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const edges = () => {
      el.classList.toggle('more-left', el.scrollLeft > 1);
      el.classList.toggle('more-right', el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    edges();
    document.fonts?.ready.then(edges); // tab widths change once the font lands
    el.addEventListener('scroll', edges, { passive: true });
    const ro = new ResizeObserver(edges);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', edges); ro.disconnect(); };
  }, [boroughs.length]);

  // keep the picked tab on screen (sideways only, never moves the page)
  useEffect(() => {
    const el = ref.current;
    const on = el?.querySelector('.on');
    if (!on) return;
    const r = on.getBoundingClientRect(), box = el.getBoundingClientRect();
    if (r.left < box.left) el.scrollLeft -= box.left - r.left;
    else if (r.right > box.right) el.scrollLeft += r.right - box.right;
  }, [borough, boroughs.length]);

  if (boroughs.length < 2) return null;
  return (
    <div ref={ref} className="borough-bar" role="tablist" aria-label="borough filter">
      <button
        className={'borough-btn' + (borough === null ? ' on' : '')}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {boroughs.map((b) => (
        <button
          key={b}
          className={'borough-btn' + (borough === b ? ' on' : '')}
          onClick={() => onChange(borough === b ? null : b)}
        >
          {label(b)}
        </button>
      ))}
    </div>
  );
}
