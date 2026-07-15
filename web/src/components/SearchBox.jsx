import React, { useRef } from 'react';

// Artist search — matches titles, personnel rosters, details, and club
// names across the whole city (chip/borough filters don't constrain it:
// "where is Mark Turner playing" should never depend on filter state).
export default function SearchBox({ query, onChange }) {
  const ref = useRef(null);
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
        onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); ref.current?.blur(); } }}
      />
      {query && (
        <button className="search-clear" aria-label="clear search"
          onClick={() => { onChange(''); ref.current?.focus(); }}>
          &times;
        </button>
      )}
    </div>
  );
}
