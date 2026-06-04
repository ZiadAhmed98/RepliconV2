export const REPORT_URIS = {
  ROSTER:     '3f1148e3-624f-4666-ba25-6a0432a883ee',
  DRAFTS:     '523be039-0435-402a-b1ba-fc7fc5810bb1',
  CUBE:       'c4dc8459-d888-4db8-af86-051e965912b3',
  TIMESHEETS: '759875bf-264a-4aef-8a44-26649c81ae65',
};

export const EXCLUDED_USERS = ['Habib Matta', 'Ziad Shafik', 'Irfan Najmi', 'Admin', 'Admin '];

export const INTERNAL_PROGRAM_KEYWORD = 'internal';

export const SESSION_DURATION_MS  = 60 * 60 * 1000;
export const IDLE_WARNING_MS      = 15 * 60 * 1000;
export const IDLE_LOGOUT_MS       = 30 * 60 * 1000;
export const CACHE_STALE_AFTER_MS = 2  * 60 * 60 * 1000;

export const CHART_COLORS = {
  purple:  '#a855f7',
  blue:    '#32ade6',
  green:   '#30d158',
  yellow:  '#ffd60a',
  red:     '#ff3b30',
  coral:   '#ff453a',
  muted:   '#8e8e93',
  indigo:  '#6366f1',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
  teal:    '#14b8a6',
  sky:     '#0ea5e9',
};

export const CHART_PALETTE = [
  '#a855f7', '#32ade6', '#30d158', '#ffd60a',
  '#ff453a', '#6366f1', '#f43f5e', '#f59e0b',
  '#14b8a6', '#0ea5e9',
];

export const STATUS_COLOR_MAP = {
  'In Progress': '#32ade6',
  'Completed':   '#30d158',
  'Planning':    '#ffd60a',
  'Tentative':   '#ffd60a',
  'Archived':    '#8e8e93',
  'On Hold':     '#ff453a',
};

export const UTILIZATION_THRESHOLDS = {
  LOW:  60,
  HIGH: 100,
};

export const AT_RISK_THRESHOLD = 80;
