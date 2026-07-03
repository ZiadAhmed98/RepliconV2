import crypto from 'crypto';

// Double-submit-cookie CSRF protection.
// The server issues a random token in a readable (non-httpOnly) cookie; the SPA
// echoes it in the `x-csrf-token` header on every mutating request. A forged
// cross-site request cannot read our cookie (and sameSite=lax stops it being
// sent), so it can't produce a matching header.

export const CSRF_COOKIE = 'mds_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Paths that must work before a token exists, or where CSRF is not meaningful.
const EXEMPT_PATHS = new Set(['/api/v1/login', '/api/login', '/api/v1/logout']);

function isSecureReq(req) {
  return process.env.NODE_ENV === 'production'
    || req.secure
    || req.headers['x-forwarded-proto'] === 'https';
}

// Ensure a CSRF cookie exists for this session (called on login + /me).
export function setCsrfCookie(req, res) {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,                 // the SPA must read it to echo in a header
    secure:   isSecureReq(req),
    sameSite: 'lax',
    maxAge:   Number(process.env.SESSION_MS) || 3600000,
  });
  return token;
}

// Reject mutating /api requests whose header token doesn't match the cookie.
export function csrfProtection(req, res, next) {
  if (process.env.DISABLE_CSRF === '1') return next();          // emergency kill-switch
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.path.startsWith('/api')) return next();
  if (EXEMPT_PATHS.has(req.path.replace(/\/$/, ''))) return next();

  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (
    cookie && header &&
    cookie.length === header.length &&
    crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
  ) return next();

  return res.status(403).json({ error: 'Invalid or missing CSRF token. Please refresh the page and try again.' });
}
