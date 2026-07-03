import { z } from 'zod';

// Express middleware factory: validate req.body against a zod schema.
// On success, req.body is replaced with the parsed (unknown keys stripped) data.
// On failure, responds 400 with a concise, non-leaky message.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first?.path?.join('.') || 'body';
      return res.status(400).json({ error: `${field}: ${first?.message || 'invalid input'}` });
    }
    req.body = result.data;
    next();
  };
}

export { z };
