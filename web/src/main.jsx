import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ArchivePage from './archive/ArchivePage';
import './styles.css';

// /archive/... is its own page (no router library): everything else is the
// live calendar.
const isArchive = window.location.pathname.split('/')[1] === 'archive';
createRoot(document.getElementById('root')).render(isArchive ? <ArchivePage /> : <App />);
