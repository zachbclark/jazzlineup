import React, { useEffect, useRef } from 'react';

// Artist search — matches titles, personnel rosters, and club
// names across the whole city (chip/borough filters don't constrain it:
// "where is Mark Turner playing" should never depend on filter state).
export default function SearchBox({ query, onChange }) {
  const ref = useRef(null);

  // Phones: the keyboard covered the results until you tapped elsewhere.
  // Dragging the page closes it (a finger drag, not scroll events: results
  // re-rendering while you type can scroll the page too).
  useEffect(() => {
    const onDrag = (e) => {
      const input = ref.current;
      if (input && document.activeElement === input && !input.parentElement.contains(e.target)) input.blur();
    };
    window.addEventListener('touchmove', onDrag, { passive: true });
    return () => window.removeEventListener('touchmove', onDrag);
  }, []);

  return (
    <div className={'search-box' + (query ? ' has-query' : '')}>
      <span className="search-icon" aria-hidden="true">&#9836;</span>
      <input
        ref={ref}
        type="search"
        value={query}
        placeholder="Search artists"
        aria-label="Search artists and shows"
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="search"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { onChange(''); ref.current?.blur(); }
          // the phone keyboard's search key closes it; on a laptop Enter keeps focus
          if (e.key === 'Enter' && window.matchMedia('(pointer: coarse)').matches) ref.current?.blur();
        }}
      />
      {query && (
        <button className="search-clear" aria-label="clear search"
          onMouseDown={(e) => e.preventDefault()} // don't blur the input: a blur
          // mid-click resizes the box and slides this button away (2-click bug)
          onClick={() => { onChange(''); ref.current?.focus(); }}>
          &times;
        </button>
      )}
    </div>
  );
}
