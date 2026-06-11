import { useState, useEffect, useCallback } from 'react';

export function useSettings(group) {
  const [settings, setSettings]   = useState({});
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [error,    setError]      = useState(null);
  const [dirty,    setDirty]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = group
        ? `/api/v1/admin/settings?group=${encodeURIComponent(group)}`
        : '/api/v1/admin/settings';
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { settings: s } = await r.json();
      setSettings(s || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/v1/admin/settings', {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ group, updates: settings }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [group, settings]);

  return { settings, loading, saving, error, dirty, update, save, reload: load };
}

export function useCrud(resource) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/admin/${resource}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const key  = Object.keys(data)[0];
      setItems(data[key] || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (body) => {
    const r = await fetch(`/api/v1/admin/${resource}`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await load();
  }, [resource, load]);

  const update = useCallback(async (id, body) => {
    const r = await fetch(`/api/v1/admin/${resource}/${id}`, {
      method:      'PUT',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await load();
  }, [resource, load]);

  const remove = useCallback(async (id) => {
    const r = await fetch(`/api/v1/admin/${resource}/${id}`, {
      method:      'DELETE',
      credentials: 'include',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await load();
  }, [resource, load]);

  return { items, loading, error, reload: load, create, update, remove };
}
