import 'dotenv/config';
import path                         from 'path';
import { fileURLToPath }            from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import crypto                       from 'crypto';
import pino                         from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const DATA_DIR = path.join(__dirname, '..', 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const USERS_FILE         = path.join(DATA_DIR, 'users.json');
export const AUDIT_FILE         = path.join(DATA_DIR, 'audit-log.json');
export const FEEDBACK_FILE      = path.join(DATA_DIR, 'insights-feedback.json');
export const CACHE_FILE         = path.join(DATA_DIR, 'insights-cache.json');
export const SUMMARY_FILE       = path.join(DATA_DIR, 'insights-summary.json');
export const CHAT_FEEDBACK_FILE = path.join(DATA_DIR, 'chat-feedback.json');
export const TIMESHEETS_FILE    = path.join(DATA_DIR, 'smart-timesheets.json');

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function newUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

// Parse ?limit/?offset for paginated list endpoints. Returns { paged:false } when
// no positive limit is given, so callers keep their pre-pagination behavior.
export function pageArgs(req) {
  const rawLimit = parseInt(req.query?.limit, 10);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) return { paged: false, limit: null, offset: 0 };
  return { paged: true, limit: Math.min(rawLimit, 500), offset: Math.max(0, parseInt(req.query?.offset, 10) || 0) };
}

export function auditLog(user, action, details = {}) {
  logger.info({ audit: true, user, action, ...details }, `AUDIT: ${user} → ${action}`);
}

export function cleanStr(str) {
  return !str ? '' : str.replace(/[\r\n\t]/g, '').trim();
}

export function parseCSVLine(line) {
  const result = []; let cur = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(cleanStr(cur)); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cleanStr(cur));
  return result;
}

export function parseNumber(val) {
  return parseFloat(String(val).replace(/"/g, '').replace(/,/g, '')) || 0;
}

export function parseDateToTimestamp(dateStr) {
  const p = Date.parse((dateStr || '').replace(/"/g, ''));
  return isNaN(p) ? 0 : p;
}

export function readJSON(file, fallback) {
  try { if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')); } catch { }
  return fallback;
}

export function writeJSON(file, data) {
  try { writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (e) { logger.warn({ err: e.message }, 'writeJSON failed: ' + file); }
}

export function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function calcHours(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return Math.round((ms / 3600000) * 4) / 4;
}

export function buildFbCounts(feedback) {
  const counts = {};
  feedback.forEach(f => {
    counts[f.type] = counts[f.type] || { pos: 0, neg: 0 };
    f.helpful ? counts[f.type].pos++ : counts[f.type].neg++;
  });
  return counts;
}
