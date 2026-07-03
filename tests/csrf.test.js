import { describe, it, expect, vi, afterEach } from 'vitest';
import { csrfProtection } from '../lib/csrf.js';

function mk({ method = 'POST', path = '/api/v1/x', cookies = {}, headers = {} } = {}) {
  const req = { method, path, cookies, get: (h) => headers[h.toLowerCase()] };
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;      return this; },
  };
  return { req, res, next: vi.fn() };
}

afterEach(() => { delete process.env.DISABLE_CSRF; });

describe('csrfProtection', () => {
  it('allows safe methods (GET)', () => {
    const { req, res, next } = mk({ method: 'GET' });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows non-/api paths', () => {
    const { req, res, next } = mk({ path: '/home' });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('exempts the login route', () => {
    const { req, res, next } = mk({ path: '/api/v1/login' });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects a mutating request with no token (403)', () => {
    const { req, res, next } = mk();
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('rejects when cookie and header do not match', () => {
    const { req, res, next } = mk({ cookies: { mds_csrf: 'aaa' }, headers: { 'x-csrf-token': 'bbb' } });
    csrfProtection(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when cookie and header match (double-submit)', () => {
    const { req, res, next } = mk({ cookies: { mds_csrf: 'tok123' }, headers: { 'x-csrf-token': 'tok123' } });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('DISABLE_CSRF kill-switch bypasses enforcement', () => {
    process.env.DISABLE_CSRF = '1';
    const { req, res, next } = mk();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
