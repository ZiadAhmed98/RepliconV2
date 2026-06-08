// Obfuscated paths for admin-only pages.
// These are the canonical client-side routes; the human-readable equivalents
// are blocked at the Express layer (server.js) with 403 Forbidden.
export const ADMIN_PATH = {
  administration: '/sys/3a7f',
  auditLog:       '/sys/8b4e',
  migration:      '/sys/5c9d',
};
