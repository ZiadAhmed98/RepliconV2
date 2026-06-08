import crypto        from 'crypto';
import { promisify } from 'util';
import { logger }    from './helpers.js';
import db            from './db.js';

export const scryptAsync = promisify(crypto.scrypt);

// Clean expired sessions every 15 minutes
setInterval(() => {
  try { db.prepare('DELETE FROM sessions WHERE expiresAt < ?').run(Date.now()); }
  catch (e) { logger.warn({ err: e }, 'Session cleanup failed'); }
}, 15 * 60 * 1000);

export function createSession(user) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (Number(process.env.SESSION_MS) || 3600000);
  db.prepare('INSERT OR REPLACE INTO sessions (token, user, expiresAt, createdAt) VALUES (?,?,?,?)')
    .run(token, JSON.stringify(user), expiresAt, new Date().toISOString());
  return { token, expiresAt };
}

export function validateSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!row) return null;
  if (Date.now() > row.expiresAt) { db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null; }
  return { user: JSON.parse(row.user), expiresAt: row.expiresAt };
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}

export function sessionCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expiresAt > ?').get(Date.now())?.n || 0;
}

export function requireAuth(req, res, next) {
  const token   = req.cookies?.mds_session;
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  req.user = session.user;
  next();
}

export function requireAdmin(req, res, next) {
  const token   = req.cookies?.mds_session;
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized.' });
  if (!session.user?.isAdmin) return res.status(403).json({ error: 'Admin access required.' });
  req.user = session.user;
  next();
}

export function requirePM(req, res, next) {
  const token   = req.cookies?.mds_session;
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized.' });
  const u = session.user;
  const elevated = ['pm', 'supervisor'];
  if (!u?.isAdmin && !elevated.includes(u?.role)) return res.status(403).json({ error: 'Admin or Project Manager access required.' });
  req.user = u;
  next();
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf  = await scryptAsync(password, salt, 64);
  return `${salt}:${buf.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const buf = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), buf);
}
