import React from 'react';
import { createRoot } from 'react-dom/client';
import { initConfig } from './config.js';
import { initData } from './data.js';
import { initEmailTemplates } from './components/emailengine.js';
// supabase.js registers globals.syncConfig at module evaluation time (side effect)
import './supabase.js';
import App from './App.jsx';
import './styles.css';

// Initialize in the same order as the old script tags
initConfig();
initEmailTemplates(); // apply default HTML templates (needs hotelSettings loaded)
initData();

const root = createRoot(document.getElementById('root'));
root.render(<App />);
