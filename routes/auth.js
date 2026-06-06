import { Router }                                    from 'express';
import rateLimit                                     from 'express-rate-limit';
import { createSession, requireAuth, verifyPassword,
         deleteSession, sessionCount }               from '../lib/auth.js';
import { ALL_PAGES, allPermissions, appendAudit }   from '../lib/rbac.js';
import { logger, auditLog }                          from '../lib/helpers.js';
import db                                            from '../lib/db.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             15,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

router.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    uptime:    Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    version:   '2.0.0',
    sessions:  sessionCount(),
  });
});

async function handleLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const id   = String(username).toLowerCase().trim();
  const row  = db.prepare('SELECT * FROM users WHERE id=?').get(id);

  if (!row) {
    logger.warn({ username: id, ip: req.ip }, 'Failed login — unknown user');
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  let valid = false;
  try { valid = await verifyPassword(password, row.passwordHash); } catch { /* fall through */ }

  if (!valid) {
    logger.warn({ username: id, ip: req.ip }, 'Failed login — wrong password');
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const permissions = JSON.parse(row.permissions || '{}');

  // Back-fill any missing page keys
  let permChanged = false;
  ALL_PAGES.forEach(p => { if (permissions[p] === undefined) { permissions[p] = true; permChanged = true; } });
  if (permChanged) {
    db.prepare('UPDATE users SET permissions=?, updatedAt=? WHERE id=?')
      .run(JSON.stringify(permissions), new Date().toISOString(), id);
  }

  const emp = db.prepare('SELECT role, id AS employeeId FROM employees WHERE userId=?').get(id);
  const sessionUser = {
    id:          row.id,
    name:        row.displayName,
    isAdmin:     !!row.isAdmin,
    permissions,
    role:        emp?.role || 'resource',
    employeeId:  emp?.employeeId || null,
  };
  const { token: sessionToken } = createSession(sessionUser);

  res.cookie('mds_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   Number(process.env.SESSION_MS) || 3600000,
  });

  appendAudit({ user: row.displayName, action: 'LOGIN', ip: req.ip });
  auditLog(row.displayName, 'LOGIN', { ip: req.ip });
  logger.info({ user: row.displayName }, 'Login success');
  res.json({ success: true, displayName: row.displayName });
}

router.post('/api/v1/login', loginLimiter, (req, res) => handleLogin(req, res));
router.post('/api/login',    loginLimiter, (req, res) => handleLogin(req, res));

router.get('/api/v1/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/api/v1/logout', (req, res) => {
  const token = req.cookies?.mds_session;
  if (token) deleteSession(token);
  res.clearCookie('mds_session');
  res.json({ success: true });
});

export default router;
