import axios from 'axios';

const api = axios.create({
  baseURL:         '',
  withCredentials: true,   // sends httpOnly cookie on every request
  headers:         { 'Content-Type': 'application/json' },
});

// 5.5 — Auto-logout on 401, re-throw everything else.
// Skip /api/v1/me so App.jsx's catch block can still try the localStorage fallback
// before deciding the user is logged out.
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config?.url?.endsWith('/api/v1/me')) {
      localStorage.removeItem('mds_dashboard_session');
      window.dispatchEvent(new CustomEvent('mds:unauthorized'));
    }
    return Promise.reject(err);
  },
);

export const repliconApi = {
  // Validate existing session via cookie
  me: async () => {
    const response = await api.get('/api/v1/me');
    return response.data;
  },

  login: async (username, password) => {
    const response = await api.post('/api/v1/login', { username, password });
    return response.data;
  },

  logout: async () => {
    await api.post('/api/v1/logout');
  },

  // 6.1 — Streaming dashboard endpoint using ReadableStream
  getDashboardData: async (onChunk) => {
    const response = await fetch('/api/v1/dashboard', {
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
    });

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('mds:unauthorized'));
      throw new Error('Session expired. Please log in again.');
    }
    if (!response.ok) throw new Error('Dashboard fetch failed');

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    const result  = { cube: [], roster: [], drafts: [], timesheets: [], tsDetails: [], dictionaries: {} };
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        try {
          const msg = JSON.parse(line.slice(5).trim());
          if (msg.type === 'error') throw new Error(msg.message);
          if (msg.type === 'cube')        result.cube        = msg.data;
          if (msg.type === 'roster')      result.roster      = msg.data;
          if (msg.type === 'drafts')      result.drafts      = msg.data;
          if (msg.type === 'timesheets')  result.timesheets  = msg.data;
          if (msg.type === 'dictionaries') result.dictionaries = msg.data;
          if (onChunk) onChunk(msg.type);
        } catch (e) { /* ignore malformed lines */ }
      }
    }

    return result;
  },
};
