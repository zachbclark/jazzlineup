import React, { useEffect, useLayoutEffect, useRef } from 'react';

// Venue chips with drag-to-reorder. Zero dependencies:
//  - mouse: drag starts after a 6px move (a plain click still toggles)
//  - touch: press-and-hold ~300ms lifts the chip (quick swipes scroll the
//    rail as usual); a non-passive touchmove listener blocks scrolling only
//    while a drag is active, which is what iOS requires
//  - FLIP animation: when the order changes mid-drag, displaced chips glide
//    to their new spots instead of teleporting
// The parent owns the order; we report moves via onReorder(dragId, targetId,
// placeAfter), then onReorderEnd() once on drop (that's when it persists).
export default function FilterBar({
  clubs, active, saved, onToggle, onAll, onMine, onSaveMine,
  onReorder, onReorderEnd, hasCustomOrder, onResetOrder,
}) {
  const barRef = useRef(null);
  const drag = useRef({ id: null, el: null, active: false, sx: 0, sy: 0, timer: null, didDrag: false });
  const rects = useRef(new Map());
  const lastMoveAt = useRef(0); // cooldown: let each FLIP glide settle before the next reorder
  // Mobile: chips wrap (no sideways scrolling); collapsed shows ~2 lines with
  // an expand strip below. Desktop never collapses (CSS ignores the class).
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const check = () => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [clubs, expanded]);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const block = (e) => { if (drag.current.active) e.preventDefault(); };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  // FLIP: glide chips displaced by an ACTIVE DRAG only. Any other layout
  // change (borough switch, toggles, reset) must snap — animating those made
  // chips slide around the bar like furniture (Zach, 2026-07-16).
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const animate = drag.current.active;
    for (const el of bar.querySelectorAll('[data-chip-id]')) {
      const id = el.getAttribute('data-chip-id');
      const r = el.getBoundingClientRect();
      const p = rects.current.get(id);
      if (animate && p && (p.left !== r.left || p.top !== r.top) && !el.classList.contains('dragging')) {
        el.style.transition = 'none';
        el.style.transform = `translate(${p.left - r.left}px, ${p.top - r.top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 70ms ease-out';
          el.style.transform = '';
          setTimeout(() => { el.style.transition = ''; }, 100);
        });
      } else if (!animate && el.style.transform) {
        el.style.transition = '';
        el.style.transform = '';
      }
      rects.current.set(id, { left: r.left, top: r.top });
    }
  });

  const activate = () => {
    const d = drag.current;
    if (d.active || !d.el) return;
    d.active = true;
    d.el.classList.add('dragging');
    navigator.vibrate?.(12);
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.active) {
      // touch: a real move before the hold timer fires means "scroll", not drag
      if (e.pointerType === 'touch') {
        if (Math.hypot(dx, dy) > 10) cleanup(false);
        return;
      }
      if (Math.hypot(dx, dy) > 6) activate();
      if (!d.active) return;
    }
    d.didDrag = true;
    // Anti-thrash: reordering reflows chips under the cursor, which would
    // immediately fire another reorder and oscillate. Three guards:
    //  1) cooldown after a real move (matched to the FLIP glide duration)
    //  2) ignore chips mid-glide (their rects are transformed = wrong)
    //  3) dead zone around the target midpoint (hysteresis at the boundary)
    if (performance.now() - lastMoveAt.current < 70) return;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-chip-id]');
    const targetId = under?.getAttribute('data-chip-id');
    if (!targetId || targetId === d.id || under.style.transform) return;
    const box = under.getBoundingClientRect();
    const mid = box.left + box.width / 2;
    if (Math.abs(e.clientX - mid) < box.width * 0.2) return;
    if (onReorder(d.id, targetId, e.clientX > mid)) {
      lastMoveAt.current = performance.now();
    }
  };

  const cleanup = (dropped) => {
    const d = drag.current;
    if (d.timer) clearTimeout(d.timer);
    d.el?.classList.remove('dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    const didDrag = d.didDrag;
    drag.current = { ...d, id: null, el: null, active: false, timer: null };
    if (dropped && didDrag) onReorderEnd?.();
  };

  const onUp = () => cleanup(true);
  const onCancel = () => cleanup(false);

  const onDown = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    const d = drag.current;
    d.id = id;
    d.el = e.currentTarget;
    d.sx = e.clientX;
    d.sy = e.clientY;
    d.didDrag = false;
    if (e.pointerType === 'touch') d.timer = setTimeout(activate, 300);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const onChipClick = (id) => {
    // a drop is not a toggle
    if (drag.current.didDrag) { drag.current.didDrag = false; return; }
    onToggle(id);
  };

  return (
    <>
    <div className={'filterbar' + (expanded ? '' : ' collapsed')} ref={barRef}>
      <button className={'chip chip-all' + (active === null ? ' on' : '')} onClick={onAll}>
        All clubs
      </button>
      {saved?.length > 0 && (
        <button
          className={'chip chip-mine' + (active !== null && active.size === saved.length && saved.every((id) => active.has(id)) ? ' on' : '')}
          onClick={onMine}
        >
          My clubs
        </button>
      )}
      {active !== null && !(saved && active.size === saved.length && saved.every((id) => active.has(id))) && (
        <button className="chip chip-save" onClick={onSaveMine}>
          Save picks
        </button>
      )}
      {clubs.map((c) => {
        const on = active === null || active.has(c.id);
        return (
          <button
            key={c.id}
            data-chip-id={c.id}
            className={'chip' + (on ? ' on' : '')}
            style={on ? {
              borderColor: c.color,
              background: c.color + '22',
              // the one glow tier: active venue chips halo in their own color
              boxShadow: `0 0 12px ${c.color}55`,
            } : undefined}
            onPointerDown={(e) => onDown(e, c.id)}
            onClick={() => onChipClick(c.id)}
            title={`${c.name} — ${c.neighborhood}`}
          >
            <span className="dot" style={{ background: c.color }} />
            {c.shortName}
          </button>
        );
      })}
      {/* appears only once an order has been customized — otherwise invisible */}
      {hasCustomOrder && (
        <button className="chip chip-reset" onClick={onResetOrder} title="Reset venue order to default">
          &#8634; default
        </button>
      )}
    </div>
    {(overflows || expanded) && (
      <button className="chips-toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Show fewer venues ▴' : `Show all ${clubs.length} venues ▾`}
      </button>
    )}
    </>
  );
}
