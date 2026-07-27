import React from 'react';

// Two plain actions above the venue chips: All and ★ My clubs. They light
// solid gold when the current view IS what they'd give you (the same
// grammar as the Calendar/List toggle) and stay quiet otherwise — during
// an ad-hoc chip filter neither lights, and the glowing chips themselves
// say what you're looking at. Buttons DO things; the lighting is just an
// echo of where you are, not a mode to manage.
export default function PicksBar({ active, saved, onAll, onMine, hasCustomOrder, onResetOrder }) {
  const allOn = active === null;
  const mineOn = active !== null && saved != null
    && active.size === saved.length && saved.every((id) => active.has(id));
  return (
    <div className="picks-row">
      <button className={'picks-btn seg-all' + (allOn ? ' on' : '')} onClick={onAll}>
        All
      </button>
      {saved?.length > 0 && (
        <button className={'picks-btn seg-mine' + (mineOn ? ' on' : '')} onClick={onMine}>
          <span className="picks-star">&#9733;</span> My clubs
        </button>
      )}
      {hasCustomOrder && (
        <button className="order-reset" onClick={onResetOrder} title="Reset venue order to default">
          &#8634; default order
        </button>
      )}
    </div>
  );
}
