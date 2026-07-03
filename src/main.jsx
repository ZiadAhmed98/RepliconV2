import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './csrf';           // CSRF header injection — must load before any fetch
import './styles/global.css';

// Optional Sentry (front-end) — only active when VITE_SENTRY_DSN is set at build time.
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react')
    .then((Sentry) => Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE }))
    .catch(() => {});
}

import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);