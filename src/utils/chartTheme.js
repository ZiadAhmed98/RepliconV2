import { CHART_COLORS } from '../constants/index.js';

export const baseChartOptions = (overrides = {}) => ({
  chart: {
    background: 'transparent',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    animations: { enabled: true, easing: 'easeinout', speed: 600 },
    // Disable wheel/scroll zoom so the browser page scrolls normally when the
    // user hovers over any chart. Toolbar download menu is kept; zoom/pan
    // buttons are removed (they do nothing without scroll-zoom anyway).
    zoom: { enabled: false },
    toolbar: {
      show: true,
      tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false },
    },
    ...(overrides.chart || {}),
  },
  theme: { mode: 'dark' },
  grid: {
    borderColor: 'rgba(255,255,255,0.05)',
    strokeDashArray: 3,
    padding: { left: 4, right: 4 },
  },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '13px', fontFamily: "'Inter', sans-serif" },
    marker: { show: true },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    labels: { colors: CHART_COLORS.muted },
    fontSize: '12px',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    itemMargin: { horizontal: 12 },
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' },
  ...overrides,
});

export const sparklineOptions = (color = '#a855f7') => ({
  chart: { sparkline: { enabled: true }, background: 'transparent', toolbar: { show: false } },
  stroke: { curve: 'smooth', width: 2 },
  colors: [color],
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 100] },
  },
  tooltip: { enabled: true, theme: 'dark', y: { title: { formatter: () => '' } } },
});

export const labelStyle = () => ({
  style: { colors: CHART_COLORS.muted, fontSize: '12px', fontFamily: "'Inter', sans-serif" },
});

export const fmtK = (num) => {
  if (!num && num !== 0) return '0';
  const n = Math.round(num);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

export const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
