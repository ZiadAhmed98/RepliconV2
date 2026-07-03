// Client-side CSRF: read the double-submit cookie and attach it as the
// `x-csrf-token` header on every mutating, same-origin request.
// Importing this module also patches window.fetch (side effect), so the many
// raw fetch() calls across the app are covered without editing each one.

export function getCsrfToken() {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)mds_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

const MUTATING = /^(POST|PUT|PATCH|DELETE)$/i;

if (typeof window !== 'undefined' && !window.__mdsCsrfPatched) {
  window.__mdsCsrfPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    try {
      const method = String(
        init.method || (input && typeof input === 'object' ? input.method : '') || 'GET'
      ).toUpperCase();
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
      if (MUTATING.test(method) && sameOrigin) {
        const token = getCsrfToken();
        if (token) {
          const headers = new Headers(
            init.headers || (input && typeof input === 'object' ? input.headers : undefined) || undefined
          );
          if (!headers.has('x-csrf-token')) headers.set('x-csrf-token', token);
          init = { ...init, headers };
        }
      }
    } catch { /* never break fetch */ }
    return nativeFetch(input, init);
  };
}
