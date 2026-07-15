import React from 'react';

// Quiet segmented control above the venue chips: All · Manhattan · Brooklyn.
// Only renders when the city actually spans more than one borough.
const label = (b) => b.charAt(0).toUpperCase() + b.slice(1).replace(/-/g, ' ');

export default function BoroughBar({ boroughs, borough, onChange }) {
  if (boroughs.length < 2) return null;
  return (
    <div className="borough-bar" role="tablist" aria-label="borough filter">
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
