import { Router }                                    from 'express';
import rateLimit                                     from 'express-rate-limit';
import { createSession, requireAuth, verifyPassword,
         deleteSession, sessionCount }               from '../lib/auth.js';
import { loadUsers, saveUsers, ALL_PAGES,
         allPermissions, appendAudit }               from '../lib/rbac.js';
import { logger, auditLog }                          from '../lib/helpers.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            15,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many login attempts. Please try again in 15 minutes.' },
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

  const id    = String(username).toLowerCase().trim();
  const users = loadUsers();
  const user  = users[id];

  if (!user) {
    logger.warn({ username: id, ip: req.ip }, 'Failed login attempt — unknown user');
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  let valid = false;
  try { valid = await verifyPassword(password, user.passwordHash); } catch { /* fall through */ }

  if (!valid) {
    logger.warn({ username: id, ip: req.ip }, 'Failed login attempt — wrong password');
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  let permChanged = false;
  ALL_PAGES.forEach(p => {
    if (user.permissions[p] === undefined) { user.permissions[p] = true; permChanged = true; }
  });
  if (permChanged) { users[id] = user; saveUsers(users); }

  const sessionUser = {
    id:          user.id,
    name:        user.displayName,
    isAdmin:     user.isAdmin || false,
    permissions: user.permissions || allPermissions(),
  };
  const { token: sessionToken } = createSession(sessionUser);

  res.cookie('mds_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   Number(process.env.SESSION_MS) || 3600000,
  });

  appendAudit({ user: user.displayName, action: 'LOGIN', ip: req.ip });
  auditLog(user.displayName, 'LOGIN', { ip: req.ip });
  logger.info({ user: user.displayName }, 'Login success');
  res.json({ success: true, displayName: user.displayName });
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
