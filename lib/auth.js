import crypto        from 'crypto';
import { promisify } from 'util';
import { logger }    from './helpers.js';

export const scryptAsync = promisify(crypto.scrypt);

const sessions = new Map();

setInterval(() => {
  for (const [token, s] of sessions) {
    if (Date.now() > s.expiresAt) sessions.delete(token);
  }
}, 10 * 60 * 1000);

export function createSession(user) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (Number(process.env.SESSION_MS) || 3600000);
  sessions.set(token, { user, expiresAt });
  return { token, expiresAt };
}

export function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
  return session;
}

export function deleteSession(token) {
  sessions.delete(token);
}

export function sessionCount() {
  return sessions.size;
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

// Admins OR employees with role='pm' or 'supervisor'
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
