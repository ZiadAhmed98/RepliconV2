import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearch({ dataMatrix, isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) { setQuery(''); setFocused(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim() || !dataMatrix) return [];
    const q = query.toLowerCase();
    const items = [];

    Object.keys(dataMatrix.dimensionTable || {}).forEach(p => {
      if (p.toLowerCase().includes(q)) {
        items.push({ type: 'project', label: p, sub: dataMatrix.dimensionTable[p].client, icon: 'bx-folder', route: '/projects', param: `?project=${encodeURIComponent(p)}` });
      }
    });

    (dataMatrix.roster || []).forEach(e => {
      if (e.name.toLowerCase().includes(q)) {
        items.push({ type: 'employee', label: e.name, sub: e.status === 'Enabled' ? 'Active' : 'Disabled', icon: 'bx-user', route: '/employee', param: `?name=${encodeURIComponent(e.name)}` });
      }
    });

    (dataMatrix.topClients || []).forEach(c => {
      if (c.name.toLowerCase().includes(q)) {
        items.push({ type: 'client', label: c.name, sub: `${Math.round(c.val).toLocaleString()} total hrs`, icon: 'bx-briefcase', route: '/', param: `?client=${encodeURIComponent(c.name)}` });
      }
    });

    return items.slice(0, 8);
  }, [query, dataMatrix]);

  useEffect(() => { setFocused(0); }, [results]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') setFocused(f => Math.min(f + 1, results.length - 1));
      if (e.key === 'ArrowUp')   setFocused(f => Math.max(f - 1, 0));
      if (e.key === 'Enter' && results[focused]) { navigate(results[focused].route + results[focused].param); onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, results, focused]);

  if (!isOpen) return null;

  const TYPE_COLOR = { project: '#a855f7', employee: '#32ade6', client: '#30d158' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 8000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '580px', maxWidth: '90vw', background: 'rgba(20,20,24,0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', overflow: 'hidden' }}>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <i className='bx bx-search' style={{ fontSize: '1.3rem', color: '#8e8e93', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, employees, clients..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: '1rem', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '1.1rem', padding: 0 }}>
              <i className='bx bx-x' />
            </button>
          )}
          <kbd style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#8e8e93', fontSize: '0.72rem', fontFamily: 'monospace', flexShrink: 0 }}>Esc</kbd>
        </div>

        {/* Results */}
        {query && (
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {results.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8e8e93', fontSize: '0.88rem' }}>No results for "{query}"</div>
            ) : (
              results.map((r, i) => (
                <div
                  key={i}
                  onClick={() => { navigate(r.route + r.param); onClose(); }}
                  style={{
                    padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '14px',
                    cursor: 'pointer', background: focused === i ? 'rgba(168,85,247,0.08)' : 'transparent',
                    borderLeft: focused === i ? '3px solid #a855f7' : '3px solid transparent',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={() => setFocused(i)}
                >
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: `${TYPE_COLOR[r.type]}18`, border: `1px solid ${TYPE_COLOR[r.type]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`bx ${r.icon}`} style={{ color: TYPE_COLOR[r.type], fontSize: '1rem' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                    <div style={{ color: '#8e8e93', fontSize: '0.78rem', marginTop: '2px' }}>{r.sub}</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: TYPE_COLOR[r.type], background: `${TYPE_COLOR[r.type]}15`, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${TYPE_COLOR[r.type]}25`, textTransform: 'capitalize', flexShrink: 0 }}>{r.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        {!query && (
          <div style={{ padding: '16px 20px', display: 'flex', gap: '16px', color: '#8e8e93', fontSize: '0.78rem' }}>
            <span><kbd style={{ padding: '2px 6px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', fontFamily: 'monospace' }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ padding: '2px 6px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', fontFamily: 'monospace' }}>↵</kbd> open</span>
            <span><kbd style={{ padding: '2px 6px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', fontFamily: 'monospace' }}>Esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}
