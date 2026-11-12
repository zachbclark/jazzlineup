import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Local-only style lab (Zach, 2026-11-11): try the wordmark glow and a few
// gold shades on the real site. main.jsx loads it only on localhost after
// a visit with ?lab, so jazzlineup.com never downloads it. Choices are just
// CSS variables and data attributes on <html>, saved in this browser only.
//
// Kept small on purpose (Zach: "too much color"): the venue chips are the
// site's color, so the accent stays gold and the glow is the one extra.

const GOLDS = [
  ['Gold (today)', '#e8b458'],
  ['Champagne', '#e8d2a2'],
  ['Honey', '#f0a640'],
  ['Antique', '#c9aa70'],
  ['Rose gold', '#e2a487'],
];

const GLOWS = [
  ['off', 'No glow (today)'],
  ['steady', 'Steady glow'],
  ['letters', 'Glow + letter cascade'],
  ['swell', 'Glow + soft wave'],
];
const GAPS = [['5', 'Nonstop'], ['10', 'Again every 10s'], ['25', 'Again every 25s'], ['60', 'Again every minute']];

// One flare of light per letter, with a small dip near the top (the
// flicker). The rest of the period is quiet, which is how the cascade
// waits between runs. "letters" is quick and tight so one letter at a time
// lights up; "swell" (soft wave) is long and overlaps its neighbors.
const SHAPES = {
  letters: { len: 0.55, pts: [[0.22, 1], [0.38, 0.5], [0.5, 1]] },
  swell: { len: 2.6, pts: [[0.38, 0.8], [0.48, 0.6], [0.6, 1]] },
};
function flareFrames(kind, period) {
  const { len, pts } = SHAPES[kind];
  const s = (Math.min(len, period - 1) / period) * 100;
  const at = (f) => `${(s * f).toFixed(2)}%`;
  return `@keyframes lab-${kind}-${period} { 0% { --g: 0; } ${pts.map(([f, g]) => `${at(f)} { --g: ${g}; }`).join(' ')} ${at(1)}, 100% { --g: 0; } }`;
}

const mix = (n) => `color-mix(in srgb, var(--accent) ${n}%, transparent)`;
const CSS = `
html[data-lab-glow] .brand-note, html[data-lab-glow] .brand-accent { text-shadow: 0 0 4px ${mix(80)}, 0 0 16px ${mix(45)}; }
/* each letter's glow is one number, --g (0 to 1), so the browser can ease
   it smoothly. --r is 1 on the gold letters (they keep a resting glow)
   and 0 on "Jazz", which flashes gold as the cascade passes. */
@property --g { syntax: '<number>'; inherits: false; initial-value: 0; }
.lab-l { display: inline-block; white-space: pre; --g: 0;
  color: color-mix(in srgb, var(--lab-peak) calc(var(--g) * 100%), var(--lab-base));
  text-shadow: 0 0 calc(3px + 9px * var(--g)) color-mix(in srgb, var(--accent) calc((var(--r) * 60 + var(--g) * 40) * 1%), transparent),
    0 0 calc(14px + 30px * var(--g)) color-mix(in srgb, var(--accent) calc((var(--r) * 35 + var(--g) * 65) * 1%), transparent),
    0 0 calc(64px * var(--g)) color-mix(in srgb, var(--accent) calc(var(--g) * 60%), transparent); }
/* letter cascade: tight glow that stays on its own letter */
html[data-lab-glow=letters] .lab-l {
  text-shadow: 0 0 calc(3px + 2px * var(--g)) color-mix(in srgb, var(--accent) calc((var(--r) * 60 + var(--g) * 40) * 1%), transparent),
    0 0 calc(12px - 2px * var(--g)) color-mix(in srgb, var(--accent) calc((var(--r) * 35 + var(--g) * 55) * 1%), transparent); }
html[data-lab-glow=letters] .lab-l, html[data-lab-glow=swell] .lab-l {
  animation: var(--lab-flare) var(--lab-time) ease-in-out infinite; animation-delay: calc(500ms + var(--i) * var(--lab-step)); }
html[data-lab-glow=letters] { --lab-step: 150ms; }
html[data-lab-glow=swell] { --lab-step: 130ms; }
${['letters', 'swell'].flatMap((k) => GAPS.map(([g]) => `html[data-lab-glow=${k}][data-lab-gap="${g}"] { --lab-flare: lab-${k}-${g}; --lab-time: ${g}s; }\n${flareFrames(k, Number(g))}`)).join('\n')}
@media (prefers-reduced-motion: reduce) { html[data-lab-glow] .lab-l { animation: none !important; } }
.style-lab { position: fixed; right: 12px; bottom: 12px; z-index: 9999; width: 240px; max-height: calc(100vh - 24px); overflow-y: auto;
  padding: 10px 12px; background: rgba(0, 0, 0, 0.88); border: 1px solid #444; border-radius: 10px; color: #eee; font: 12.5px/1.4 -apple-system, sans-serif; }
.style-lab.closed { width: auto; }
.style-lab h4 { margin: 0; font-size: 12.5px; cursor: pointer; }
.style-lab .sw { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 8px 0 2px; }
.style-lab .sw button { height: 24px; border-radius: 5px; border: 2px solid transparent; cursor: pointer; padding: 0; }
.style-lab .sw button.on { border-color: #fff; }
.style-lab select { width: 100%; margin: 4px 0 6px; }
.style-lab .now { color: #aaa; margin: 0 0 8px; }
`;

// The cascade needs one span per letter. React owns the real wordmark, so
// the lab hides it and shows a split-up copy instead (lab only; the real
// version would render the spans in App.jsx and ArchivePage.jsx).
function setCascade(enabled) {
  document.querySelectorAll('.lab-clone').forEach((c) => c.remove());
  document.querySelectorAll('.brand-link').forEach((a) => { a.style.display = ''; });
  if (!enabled) return;
  document.querySelectorAll('.brand-link').forEach((a) => {
    const copy = a.cloneNode(true);
    copy.classList.add('lab-clone');
    let i = 0;
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const t of texts) {
      const gold = !!t.parentElement.closest('.brand-note, .brand-accent');
      const frag = document.createDocumentFragment();
      for (const ch of t.textContent) {
        if (ch === ' ') { frag.append(' '); continue; }
        const s = Object.assign(document.createElement('span'), { className: 'lab-l', textContent: ch });
        s.style.setProperty('--i', i++);
        s.style.setProperty('--r', gold ? 1 : 0);
        s.style.setProperty('--lab-base', gold ? 'var(--accent)' : 'var(--text)');
        // the flash: gold letters go white-hot, cream letters ("Jazz") go gold
        s.style.setProperty('--lab-peak', gold ? 'color-mix(in srgb, var(--accent) 30%, #fffaf0)' : 'color-mix(in srgb, var(--accent) 85%, #fff)');
        frag.append(s);
      }
      t.replaceWith(frag);
    }
    // the real link's href follows the city; read it at click time
    copy.addEventListener('click', () => { copy.href = a.href; });
    a.style.display = 'none';
    a.after(copy);
  });
}

const KEY = 'jl.lab';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const pick = (list, v, dflt) => (list.some(([x]) => x === v) ? v : dflt);

function StyleLab() {
  const saved = load();
  const [open, setOpen] = useState(saved.open ?? true);
  const [accent, setAccent] = useState(GOLDS.some(([, c]) => c === saved.accent) ? saved.accent : '#e8b458');
  const [glow, setGlow] = useState(pick(GLOWS, saved.glow, 'off'));
  const [gap, setGap] = useState(pick(GAPS, saved.gap, '10'));

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    if (glow !== 'off') root.dataset.labGlow = glow;
    else delete root.dataset.labGlow;
    root.dataset.labGap = gap;
    try { localStorage.setItem(KEY, JSON.stringify({ open, accent, glow, gap })); } catch {}
  }, [accent, open, glow, gap]);

  // build the letter copy when the cascade is picked (again shortly after,
  // in case the wordmark rendered after the lab mounted); a new gap
  // rebuilds it so the first run replays
  useEffect(() => {
    const cascade = glow === 'letters' || glow === 'swell';
    setCascade(cascade);
    const t = setTimeout(() => setCascade(cascade), 400);
    return () => clearTimeout(t);
  }, [glow, gap]);

  if (!open) return <div className="style-lab closed"><h4 onClick={() => setOpen(true)}>Style lab</h4></div>;
  const name = GOLDS.find(([, c]) => c === accent)?.[0];
  return (
    <div className="style-lab">
      <h4 onClick={() => setOpen(false)}>Style lab (hide)</h4>
      <div className="sw">
        {GOLDS.map(([n, c]) => (
          <button key={c} title={n} className={c === accent ? 'on' : ''} style={{ background: c }} onClick={() => setAccent(c)} />
        ))}
      </div>
      <div className="now">{name}</div>
      <select value={glow} onChange={(e) => setGlow(e.target.value)}>
        {GLOWS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      {(glow === 'letters' || glow === 'swell') && (
        <select value={gap} onChange={(e) => setGap(e.target.value)}>
          {GAPS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      )}
      <button onClick={() => { setAccent('#e8b458'); setGlow('off'); setGap('10'); }}>Reset to today</button>
    </div>
  );
}

export function mount() {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  const el = document.body.appendChild(document.createElement('div'));
  createRoot(el).render(<StyleLab />);
}
