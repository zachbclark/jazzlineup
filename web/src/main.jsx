import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ArchivePage from './archive/ArchivePage';
import './styles.css';

// /archive/... is its own page (no router library): everything else is the
// live calendar.
const isArchive = window.location.pathname.split('/')[1] === 'archive';
createRoot(document.getElementById('root')).render(isArchive ? <ArchivePage /> : <App />);

// Style lab: localhost only, switched on by visiting with ?lab (?lab=off
// turns it off). Off by default so the UI tests never see it.
if (window.location.hostname === 'localhost') {
  const lab = new URLSearchParams(window.location.search).get('lab');
  try {
    if (lab === 'off') localStorage.removeItem('jl.lab.enabled');
    else if (lab !== null) localStorage.setItem('jl.lab.enabled', '1');
    if (localStorage.getItem('jl.lab.enabled')) import('./dev/StyleLab').then((m) => m.mount());
  } catch { /* storage blocked: no lab */ }
}
