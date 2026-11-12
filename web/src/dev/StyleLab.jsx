import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Local-only style lab (Zach, 2026-11-11): try accent colors and a few
// button/label styles on the real site. main.jsx loads it only on
// localhost after a visit with ?lab, so jazzlineup.com never downloads it.
// Choices are just CSS variables and data attributes on <html>; nothing
// here is saved anywhere but this browser.

const GOLDS = [
  ['Gold (today)', '#e8b458'],
  ['Champagne', '#e8d2a2'],
  ['Pale gold', '#eedc9a'],
  ['Honey', '#f0a640'],
  ['Marigold', '#f6a821'],
  ['Saffron', '#f4c13d'],
  ['Amber', '#ffbf00'],
  ['Brass', '#c8a951'],
  ['Antique', '#c9aa70'],
  ['Bronze', '#cd7f32'],
  ['Copper', '#d48a5e'],
  ['Rose gold', '#e2a487'],
  ['jazzin.nyc', '#c8923a'],
];
// colors real neon tubes come in
const NEONS = [
  ['Warm white', '#fff1d6'],
  ['Tangerine', '#ff9a3c'],
  ['Neon red', '#ff4f4f'],
  ['Coral', '#ff7f6e'],
  ['Hot pink', '#ff6fae'],
  ['Orchid', '#e07be0'],
  ['Violet', '#b48cff'],
  ['Ice blue', '#8fd3ff'],
  ['Electric blue', '#4fb3ff'],
  ['Teal', '#4fd1c5'],
  ['Mint', '#7af0b0'],
  ['Lime', '#c6f36b'],
];
const ACCENTS = [...GOLDS, ...NEONS];

// wordmark fonts (Playfair is jazzin.nyc's, so it's left out)
const FONTS = [
  ['Abril (today)', null],
  ['DM Serif Display', 'DM+Serif+Display'],
  ['Fraunces', 'Fraunces:opsz,wght@144,800'],
  ['Archivo Black', 'Archivo+Black'],
];

const TOGGLES = [
  ['case', 'Normal-case labels', 'no spaced-out ALL CAPS on tabs, days, headings'],
  ['round', 'Round buttons', 'pill-shaped toggles and arrows'],
  ['sansMonth', 'Sans month title', '"November 2026" without the serif'],
];

// neon ideas (Zach, 2026-11-11). Glow is on the wordmark only; drift
// slides the whole accent (every gold thing) through a set of colors.
const GLOWS = [
  ['off', 'No glow (today)'],
  ['steady', 'Steady glow'],
  ['breathe', 'Slow breathing glow'],
  ['flicker', 'Flickers on, then steady'],
  ['wave', 'Cascade: light runs across the letters'],
  ['lightUp', 'Cascade: letters switch on one by one'],
];
const DRIFTS = [
  ['off', 'No drift (today)'],
  ['warm', 'Warm: gold, honey, copper'],
  ['wide', 'Wide: gold, amber, copper, rose'],
  ['sunset', 'Sunset: gold, tangerine, coral, hot pink'],
  ['neon', 'Neon sign: gold, hot pink, violet, ice blue'],
];
const SPEEDS = [['8s', 'Fast (8s loop)'], ['20s', 'Medium (20s loop)'], ['40s', 'Slow (40s loop)']];

const mix = (n) => `color-mix(in srgb, var(--accent) ${n}%, transparent)`;
const CSS = `
html[data-lab-glow] .brand-note, html[data-lab-glow] .brand-accent { text-shadow: 0 0 4px ${mix(80)}, 0 0 16px ${mix(45)}; }
html[data-lab-glow=breathe] .brand-note, html[data-lab-glow=breathe] .brand-accent { animation: lab-breathe 4s ease-in-out infinite; }
html[data-lab-glow=flicker] .brand-note, html[data-lab-glow=flicker] .brand-accent { animation: lab-flicker 1.8s linear 1 both; }
@keyframes lab-breathe { 50% { text-shadow: 0 0 2px ${mix(50)}, 0 0 6px ${mix(20)}; } }
@keyframes lab-flicker {
  0%, 8%, 14%, 30%, 34% { opacity: .25; text-shadow: none; }
  6%, 11%, 18%, 32%, 100% { opacity: 1; } }
html[data-lab-glow=wave] .lab-l { animation: lab-wave 3.5s ease-in-out infinite; animation-delay: calc(var(--i) * 90ms); }
@keyframes lab-wave { 9% { color: color-mix(in srgb, var(--accent) 70%, white); text-shadow: 0 0 6px var(--accent), 0 0 18px var(--accent), 0 0 34px ${mix(60)}; } 22% { } }
html[data-lab-glow=lightUp] .lab-l { animation: lab-light-up .5s linear 1 both; animation-delay: calc(300ms + var(--i) * 160ms); }
@keyframes lab-light-up { 0%, 40% { opacity: .12; text-shadow: none; } 50% { opacity: 1; } 62% { opacity: .3; } 100% { opacity: 1; } }
.lab-l { display: inline-block; white-space: pre; }
@property --accent { syntax: '<color>'; inherits: true; initial-value: #e8b458; }
html[data-lab-drift] { animation: var(--lab-drift-name) var(--lab-speed, 20s) ease-in-out infinite; }
html[data-lab-drift=warm] { --lab-drift-name: lab-drift-warm; }
html[data-lab-drift=wide] { --lab-drift-name: lab-drift-wide; }
html[data-lab-drift=sunset] { --lab-drift-name: lab-drift-sunset; }
html[data-lab-drift=neon] { --lab-drift-name: lab-drift-neon; }
@keyframes lab-drift-warm { 0%, 100% { --accent: #e8b458; } 33% { --accent: #f0a640; } 66% { --accent: #d48a5e; } }
@keyframes lab-drift-wide { 0%, 100% { --accent: #e8b458; } 25% { --accent: #f28c28; } 50% { --accent: #cf6f4a; } 75% { --accent: #e39a9a; } }
@keyframes lab-drift-sunset { 0%, 100% { --accent: #e8b458; } 25% { --accent: #ff9a3c; } 50% { --accent: #ff7f6e; } 75% { --accent: #ff6fae; } }
@keyframes lab-drift-neon { 0%, 100% { --accent: #e8b458; } 25% { --accent: #ff6fae; } 50% { --accent: #b48cff; } 75% { --accent: #8fd3ff; } }
@media (prefers-reduced-motion: reduce) { html[data-lab-glow] *, html[data-lab-drift] { animation: none !important; } }
html[data-lab-case] .city-hint, html[data-lab-case] .borough-btn, html[data-lab-case] .dow,
html[data-lab-case] .daypanel h3, html[data-lab-case] .daygroup h3 { text-transform: none !important; letter-spacing: 0 !important; }
html[data-lab-case] .borough-btn, html[data-lab-case] .daypanel h3, html[data-lab-case] .daygroup h3 { font-size: 14px !important; font-weight: 600 !important; }
html[data-lab-round] .view-toggle, html[data-lab-round] .monthnav button, html[data-lab-round] .chips-toggle,
html[data-lab-round] .borough-btn { border-radius: 999px !important; }
html[data-lab-sans-month] .monthnav h2 { font-family: inherit !important; font-weight: 700 !important; letter-spacing: 0 !important; }
html[data-lab-font] .brand { font-family: var(--lab-font), Georgia, serif !important; }
.style-lab { position: fixed; right: 12px; bottom: 12px; z-index: 9999; width: 260px; max-height: calc(100vh - 24px); overflow-y: auto;
  padding: 10px 12px; background: rgba(0, 0, 0, 0.88); border: 1px solid #444; border-radius: 10px; color: #eee; font: 12.5px/1.4 -apple-system, sans-serif; }
.style-lab.closed { width: auto; }
.style-lab h4 { margin: 0; font-size: 12.5px; cursor: pointer; }
.style-lab h5 { margin: 8px 0 0; font-size: 11px; color: #aaa; font-weight: 600; }
.style-lab .sw { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin: 5px 0; }
.style-lab .sw button { height: 24px; border-radius: 5px; border: 2px solid transparent; cursor: pointer; padding: 0; }
.style-lab .sw button.on { border-color: #fff; }
.style-lab label { display: block; margin: 5px 0; cursor: pointer; }
.style-lab small { color: #999; display: block; margin-left: 20px; }
.style-lab select, .style-lab input[type=color] { width: 100%; margin: 4px 0 6px; }
.style-lab .now { color: #aaa; margin: 2px 0 6px; }
`;

// The cascades need one span per letter. React owns the real wordmark, so
// the lab hides it and shows a split-up copy instead (lab only; the real
// version would render the spans in App.jsx).
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
      const frag = document.createDocumentFragment();
      for (const ch of t.textContent) {
        if (ch === ' ') { frag.append(' '); continue; }
        const s = Object.assign(document.createElement('span'), { className: 'lab-l', textContent: ch });
        s.style.setProperty('--i', i++);
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

function StyleLab() {
  const saved = load();
  const [open, setOpen] = useState(saved.open ?? true);
  const [accent, setAccent] = useState(saved.accent ?? '#e8b458');
  const [font, setFont] = useState(saved.font ?? null);
  const [on, setOn] = useState(saved.on ?? {});
  const [glow, setGlow] = useState(GLOWS.some(([v]) => v === saved.glow) ? saved.glow : 'off');
  const [drift, setDrift] = useState(DRIFTS.some(([v]) => v === saved.drift) ? saved.drift : 'off');
  const [speed, setSpeed] = useState(saved.speed ?? '20s');

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    for (const [k] of TOGGLES) {
      if (on[k]) root.dataset[`lab${k[0].toUpperCase()}${k.slice(1)}`] = '';
      else delete root.dataset[`lab${k[0].toUpperCase()}${k.slice(1)}`];
    }
    if (font) {
      const id = 'lab-font-' + font;
      if (!document.getElementById(id)) {
        const l = Object.assign(document.createElement('link'), { id, rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${font}&display=swap` });
        document.head.appendChild(l);
      }
      root.style.setProperty('--lab-font', `'${font.split(':')[0].replace(/\+/g, ' ')}'`);
      root.dataset.labFont = '';
    } else delete root.dataset.labFont;
    if (glow !== 'off') root.dataset.labGlow = glow;
    else delete root.dataset.labGlow;
    if (drift !== 'off') root.dataset.labDrift = drift;
    else delete root.dataset.labDrift;
    root.style.setProperty('--lab-speed', speed);
    try { localStorage.setItem(KEY, JSON.stringify({ open, accent, font, on, glow, drift, speed })); } catch {}
  }, [accent, font, on, open, glow, drift, speed]);

  // build the letter copy when a cascade is picked (again shortly after,
  // in case the wordmark rendered after the lab mounted). Switching between
  // the two cascades rebuilds it so the switch-on replays.
  useEffect(() => {
    const cascade = glow === 'wave' || glow === 'lightUp';
    setCascade(cascade);
    const t = setTimeout(() => setCascade(cascade), 400);
    return () => clearTimeout(t);
  }, [glow]);

  if (!open) return <div className="style-lab closed"><h4 onClick={() => setOpen(true)}>Style lab</h4></div>;
  const name = ACCENTS.find(([, c]) => c === accent)?.[0] ?? 'Custom';
  const swatches = (list) => (
    <div className="sw">
      {list.map(([n, c]) => (
        <button key={c} title={`${n} ${c}`} className={c === accent ? 'on' : ''} style={{ background: c }} onClick={() => setAccent(c)} />
      ))}
    </div>
  );
  return (
    <div className="style-lab">
      <h4 onClick={() => setOpen(false)}>Style lab (hide)</h4>
      <h5>Golds and metals</h5>
      {swatches(GOLDS)}
      <h5>Neon sign colors</h5>
      {swatches(NEONS)}
      <div className="now">{name} {accent}</div>
      <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
      <div>Glow</div>
      <select value={glow} onChange={(e) => setGlow(e.target.value)}>
        {GLOWS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      <div>Color drift</div>
      <select value={drift} onChange={(e) => setDrift(e.target.value)}>
        {DRIFTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      {drift !== 'off' && (
        <select value={speed} onChange={(e) => setSpeed(e.target.value)}>
          {SPEEDS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      )}
      {TOGGLES.map(([k, label, hint]) => (
        <label key={k}>
          <input type="checkbox" checked={!!on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} /> {label}
          <small>{hint}</small>
        </label>
      ))}
      <div>Wordmark</div>
      <select value={font ?? ''} onChange={(e) => setFont(e.target.value || null)}>
        {FONTS.map(([n, f]) => <option key={n} value={f ?? ''}>{n}</option>)}
      </select>
      <button onClick={() => { setAccent('#e8b458'); setFont(null); setOn({}); setGlow('off'); setDrift('off'); setSpeed('20s'); }}>Reset to today</button>
    </div>
  );
}

export function mount() {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  const el = document.body.appendChild(document.createElement('div'));
  createRoot(el).render(<StyleLab />);
}
