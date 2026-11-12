import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Local-only style lab (Zach, 2026-11-11): try accent colors and a few
// button/label styles on the real site. main.jsx loads it only on
// localhost after a visit with ?lab, so jazzlineup.com never downloads it.
// Choices are just CSS variables and data attributes on <html>; nothing
// here is saved anywhere but this browser.

const ACCENTS = [
  ['Gold (today)', '#e8b458'],
  ['Champagne', '#e8d2a2'],
  ['Honey', '#f0a640'],
  ['Saffron', '#f4c13d'],
  ['Antique', '#c9aa70'],
  ['Rose gold', '#e2a487'],
  ['Copper', '#d48a5e'],
  ['jazzin.nyc', '#c8923a'],
];

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

// neon ideas (Zach, 2026-11-11): the glow sits on the gold parts of the
// wordmark only; "drift" slides the whole accent through the warm family.
const GLOWS = [
  ['off', 'No glow (today)'],
  ['steady', 'Steady glow'],
  ['breathe', 'Slow breathing glow'],
  ['flicker', 'Flickers on, then steady'],
  ['drift', 'Whole site drifts gold to copper'],
];

const CSS = `
html[data-lab-glow] .brand-note, html[data-lab-glow] .brand-accent {
  text-shadow: 0 0 4px color-mix(in srgb, var(--accent) 80%, transparent), 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent); }
html[data-lab-glow=breathe] .brand-note, html[data-lab-glow=breathe] .brand-accent { animation: lab-breathe 4s ease-in-out infinite; }
html[data-lab-glow=flicker] .brand-note, html[data-lab-glow=flicker] .brand-accent { animation: lab-flicker 1.8s linear 1 both; }
@keyframes lab-breathe { 50% { text-shadow: 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent), 0 0 6px color-mix(in srgb, var(--accent) 20%, transparent); } }
@keyframes lab-flicker {
  0%, 8%, 14%, 30%, 34% { opacity: .25; text-shadow: none; }
  6%, 11%, 18%, 32%, 100% { opacity: 1; } }
@property --accent { syntax: '<color>'; inherits: true; initial-value: #e8b458; }
html[data-lab-glow=drift] { animation: lab-drift 40s ease-in-out infinite; }
@keyframes lab-drift { 0%, 100% { --accent: #e8b458; } 33% { --accent: #f0a640; } 66% { --accent: #d48a5e; } }
@media (prefers-reduced-motion: reduce) { html[data-lab-glow] *, html[data-lab-glow] { animation: none !important; } }
html[data-lab-case] .city-hint, html[data-lab-case] .borough-btn, html[data-lab-case] .dow,
html[data-lab-case] .daypanel h3, html[data-lab-case] .daygroup h3 { text-transform: none !important; letter-spacing: 0 !important; }
html[data-lab-case] .borough-btn, html[data-lab-case] .daypanel h3, html[data-lab-case] .daygroup h3 { font-size: 14px !important; font-weight: 600 !important; }
html[data-lab-round] .view-toggle, html[data-lab-round] .monthnav button, html[data-lab-round] .chips-toggle,
html[data-lab-round] .borough-btn { border-radius: 999px !important; }
html[data-lab-sans-month] .monthnav h2 { font-family: inherit !important; font-weight: 700 !important; letter-spacing: 0 !important; }
html[data-lab-font] .brand { font-family: var(--lab-font), Georgia, serif !important; }
.style-lab { position: fixed; right: 12px; bottom: 12px; z-index: 9999; width: 250px; padding: 10px 12px;
  background: rgba(0, 0, 0, 0.85); border: 1px solid #444; border-radius: 10px; color: #eee; font: 12.5px/1.4 -apple-system, sans-serif; }
.style-lab.closed { width: auto; }
.style-lab h4 { margin: 0; font-size: 12.5px; cursor: pointer; }
.style-lab .sw { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0; }
.style-lab .sw button { height: 26px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; }
.style-lab .sw button.on { border-color: #fff; }
.style-lab label { display: block; margin: 5px 0; cursor: pointer; }
.style-lab small { color: #999; display: block; margin-left: 20px; }
.style-lab select, .style-lab input[type=color] { width: 100%; margin: 4px 0 6px; }
.style-lab .now { color: #aaa; margin: 2px 0 6px; }
`;

const KEY = 'jl.lab';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };

function StyleLab() {
  const saved = load();
  const [open, setOpen] = useState(saved.open ?? true);
  const [accent, setAccent] = useState(saved.accent ?? '#e8b458');
  const [font, setFont] = useState(saved.font ?? null);
  const [on, setOn] = useState(saved.on ?? {});
  const [glow, setGlow] = useState(saved.glow ?? 'off');

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
    try { localStorage.setItem(KEY, JSON.stringify({ open, accent, font, on, glow })); } catch {}
  }, [accent, font, on, open, glow]);

  if (!open) return <div className="style-lab closed"><h4 onClick={() => setOpen(true)}>Style lab</h4></div>;
  const name = ACCENTS.find(([, c]) => c === accent)?.[0] ?? 'Custom';
  return (
    <div className="style-lab">
      <h4 onClick={() => setOpen(false)}>Style lab (hide)</h4>
      <div className="sw">
        {ACCENTS.map(([n, c]) => (
          <button key={c} title={`${n} ${c}`} className={c === accent ? 'on' : ''} style={{ background: c }} onClick={() => setAccent(c)} />
        ))}
      </div>
      <div className="now">{name} {accent}</div>
      <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
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
      <div>Neon</div>
      <select value={glow} onChange={(e) => setGlow(e.target.value)}>
        {GLOWS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      <button onClick={() => { setAccent('#e8b458'); setFont(null); setOn({}); setGlow('off'); }}>Reset to today</button>
    </div>
  );
}

export function mount() {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  const el = document.body.appendChild(document.createElement('div'));
  createRoot(el).render(<StyleLab />);
}
