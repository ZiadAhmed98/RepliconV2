import { describe, it, expect, vi } from 'vitest';
import { validate, z } from '../lib/validate.js';

const schema = z.object({ name: z.string().min(1), age: z.number().optional() });

function mk(body) {
  const req = { body };
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;      return this; },
  };
  return { req, res, next: vi.fn() };
}

describe('validate middleware', () => {
  it('passes a valid body and strips unknown keys', () => {
    const { req, res, next } = mk({ name: 'Bob', extra: 'nope' });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Bob' });
  });

  it('rejects an invalid field with 400', () => {
    const { req, res, next } = mk({ name: '' });
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects a missing required field with 400', () => {
    const { req, res, next } = mk({});
    validate(schema)(req, res, next);
    expect(res.statusCode).toBe(400);
  });
});
