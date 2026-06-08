// Per-session navigation token — set once after login, used by all navigation.
// Stored only in memory (lost on tab close / reload without token in URL).
let _token = '';

export function setNavToken(t) { _token = t || ''; }
export function getNavToken()  { return _token; }

// Appends ?_t=<token> (or &_t=<token>) to any path string.
export function withToken(path) {
  if (!_token) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}_t=${_token}`;
}
