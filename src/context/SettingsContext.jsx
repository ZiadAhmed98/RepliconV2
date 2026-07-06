import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── Application settings, applied globally ──────────────────────────────────
// Admins edit these on the /settings/* pages. Historically they saved to the
// app_settings table and nothing ever read them back, so changing them did
// nothing. This context loads the display-affecting subset for every user and
// actually applies it: accent colour → CSS var, company name → document title
// + favicon, date/number/currency format → shared formatters used app-wide.

const SettingsContext = createContext(null);

const DEFAULTS = {
  branding:     { companyName: '', primaryColor: '', logoUrl: '', faviconUrl: '' },
  localization: { currency: 'USD', numberFormat: '1,234.56', firstDayOfWeek: 'sunday', language: 'en' },
  general:      { appName: '', dateFormat: 'MM/DD/YYYY', timezone: 'UTC' },
};

const CURRENCY_SYMBOL = { USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ', EGP: 'E£' };

function applyBranding(branding, general) {
  const root = document.documentElement;

  // Accent colour → the primary CSS token everything themeable reads from.
  if (branding.primaryColor) {
    root.style.setProperty('--accent-primary', branding.primaryColor);
    root.style.setProperty('--accent-purple',  branding.primaryColor);
    root.style.setProperty('--violet',         branding.primaryColor);
  } else {
    root.style.removeProperty('--accent-primary');
    root.style.removeProperty('--accent-purple');
    root.style.removeProperty('--violet');
  }

  // Company / app name → browser tab title.
  const title = branding.companyName || general.appName;
  if (title) document.title = title;

  // Favicon.
  if (branding.faviconUrl) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = branding.faviconUrl;
  }
}

// Build a date formatter from the saved dateFormat + timezone.
function makeFormatDate(dateFormat, timezone) {
  return (value) => {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d)) return '—';
    const opt = timezone && timezone !== 'UTC' ? { timeZone: timezone } : {};
    const p = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', ...opt })
      .formatToParts(d)
      .reduce((a, x) => (a[x.type] = x.value, a), {});
    switch (dateFormat) {
      case 'DD/MM/YYYY': return `${p.day}/${p.month}/${p.year}`;
      case 'YYYY-MM-DD': return `${p.year}-${p.month}-${p.day}`;
      case 'MM/DD/YYYY':
      default:           return `${p.month}/${p.day}/${p.year}`;
    }
  };
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/settings/operational', { credentials: 'include' });
      if (!r.ok) return; // not logged in yet, or endpoint unavailable — keep defaults
      const { settings: s } = await r.json();
      setSettings({
        ...s,   // every group (projects, tasks, timesheets, …) is available
        branding:     { ...DEFAULTS.branding,     ...(s.branding     || {}) },
        localization: { ...DEFAULTS.localization, ...(s.localization || {}) },
        general:      { ...DEFAULTS.general,      ...(s.general      || {}) },
      });
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-load when the admin saves settings, or when auth changes (login/logout).
  useEffect(() => {
    const h = () => load();
    window.addEventListener('mds:settings-updated', h);
    window.addEventListener('mds:auth-changed', h);
    return () => {
      window.removeEventListener('mds:settings-updated', h);
      window.removeEventListener('mds:auth-changed', h);
    };
  }, [load]);

  // Apply branding side-effects whenever the relevant values change.
  useEffect(() => {
    applyBranding(settings.branding, settings.general);
  }, [settings.branding, settings.general]);

  const formatDate = makeFormatDate(settings.general.dateFormat, settings.general.timezone);

  const curCfg = settings.currency || {};
  const formatCurrency = (amount, currency) => {
    const cur = currency || curCfg.baseCurrency || settings.localization.currency || 'USD';
    const n   = Number(amount || 0);
    const sym = (CURRENCY_SYMBOL[cur] ?? cur).trim();
    const gap = sym.length > 1 ? ' ' : '';               // "AED 100" but "$100"
    const useEu = settings.localization.numberFormat === '1.234,56';
    const dp  = Number.isFinite(Number(curCfg.decimalPlaces)) ? Number(curCfg.decimalPlaces) : 2;
    const str = n.toLocaleString(useEu ? 'de-DE' : 'en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return curCfg.symbolPosition === 'after' ? `${str}${gap}${sym}` : `${sym}${gap}${str}`;
  };

  // Convert between currencies using the configured rates (1 base = rate units).
  const convert = (amount, from, to) => {
    const rates = curCfg.rates || {};
    const base  = curCfg.baseCurrency || 'USD';
    const rateOf = (c) => (c === base ? 1 : Number(rates[c]) || 1);
    return Number(amount || 0) / rateOf(from) * rateOf(to);
  };

  const value = {
    settings,
    branding:     settings.branding,
    localization: settings.localization,
    general:      settings.general,
    projects:     settings.projects || {},
    // Generic accessor for any settings group, e.g. group('timesheets').
    group:        (name) => settings[name] || {},
    accent:       settings.branding.primaryColor || '#8b5cf6',
    companyName:  settings.branding.companyName || settings.general.appName || 'Liveroute Replicon',
    formatDate,
    formatCurrency,
    convert,
    refresh: load,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within SettingsProvider');
  return ctx;
}
