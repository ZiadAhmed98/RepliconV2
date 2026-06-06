import React, { useState } from 'react';

const RESULT_CARDS = [
  { key: 'clients',    label: 'Clients',          icon: 'bx-briefcase',  color: '#34d399' },
  { key: 'employees',  label: 'Employees',         icon: 'bx-group',      color: '#60a5fa' },
  { key: 'projects',   label: 'Projects',          icon: 'bx-folder-open',color: '#818cf8' },
  { key: 'tasks',      label: 'Tasks (General)',   icon: 'bx-task',       color: '#fbbf24' },
  { key: 'resources',  label: 'Team Assignments',  icon: 'bx-user-check', color: '#a78bfa' },
  { key: 'timesheets', label: 'Timesheets',        icon: 'bx-time-five',  color: '#2dd4bf' },
];

export default function Migration() {
  const [opts, setOpts] = useState({ createAccounts: true, importTimesheets: true });
  const [status, setStatus]   = useState('idle');  // idle | running | done | error
  const [result, setResult]   = useState(null);
  const [errMsg, setErrMsg]   = useState('');

  const toggle = key => setOpts(p => ({ ...p, [key]: !p[key] }));

  const run = async () => {
    setStatus('running');
    setResult(null);
    setErrMsg('');
    try {
      const r = await fetch('/api/v1/admin/migrate-from-replicon', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(opts),
      });
      const data = await r.json();
      if (!r.ok) {
        setErrMsg(data.error || 'Migration failed');
        setStatus('error');
        if (data.clients) setResult(data);
      } else {
        setResult(data);
        setStatus('done');
      }
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: '28px 36px', maxWidth: '860px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className='bx bx-cloud-download' style={{ fontSize: '22px', color: '#2dd4bf' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Replicon Migration
          </h1>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Import all existing Replicon data into your PSA system
          </p>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: 'rgba(250,191,36,0.06)', border: '1px solid rgba(250,191,36,0.2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <i className='bx bx-info-circle' style={{ color: '#fbbf24', fontSize: '19px', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>What gets imported:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            <li>All <strong style={{ color: 'rgba(255,255,255,0.75)' }}>clients</strong> from Replicon</li>
            <li>All <strong style={{ color: 'rgba(255,255,255,0.75)' }}>employees</strong> (everyone in the roster + everyone who ever logged hours)</li>
            <li>All <strong style={{ color: 'rgba(255,255,255,0.75)' }}>projects</strong> with client links, budget hours, and quoted hours</li>
            <li>A <strong style={{ color: 'rgba(255,255,255,0.75)' }}>"General" task</strong> per project as a catch-all for historical hours</li>
            <li>Team <strong style={{ color: 'rgba(255,255,255,0.75)' }}>assignments</strong> — who worked on each project</li>
            {opts.importTimesheets && (
              <li>Full <strong style={{ color: 'rgba(255,255,255,0.75)' }}>timesheet history</strong> — every hour logged, reconstructed into weekly timesheets</li>
            )}
          </ul>
          <p style={{ margin: '10px 0 0' }}>
            Migration is <strong style={{ color: '#4ade80' }}>idempotent</strong> — already-imported records are skipped, so it's safe to run again.
          </p>
        </div>
      </div>

      {/* Options (only in idle state) */}
      {status === 'idle' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 22px', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>Options</p>

          {[
            {
              key:   'createAccounts',
              label: 'Create login accounts for imported employees',
              desc:  'Each employee gets a login account (username = firstname.lastname, default password "Welcome1!"). You can update passwords in User Management.',
            },
            {
              key:      'importTimesheets',
              label:    'Import historical timesheet data',
              desc:     'All hours logged in Replicon will be reconstructed as weekly approved timesheets. Requires accounts to be enabled.',
              disabled: !opts.createAccounts,
            },
          ].map(opt => (
            <label
              key={opt.key}
              style={{ display: 'flex', gap: '12px', marginBottom: '16px', cursor: opt.disabled ? 'not-allowed' : 'pointer', opacity: opt.disabled ? 0.4 : 1 }}
            >
              <input
                type="checkbox"
                checked={opt.disabled ? false : opts[opt.key]}
                disabled={opt.disabled}
                onChange={() => !opt.disabled && toggle(opt.key)}
                style={{ marginTop: '2px', width: '16px', height: '16px', cursor: opt.disabled ? 'not-allowed' : 'pointer', accentColor: '#2dd4bf', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>{opt.label}</div>
                <div style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Start button */}
      {status === 'idle' && (
        <button
          onClick={run}
          style={{
            background: '#2dd4bf', color: '#0f172a', border: 'none', borderRadius: '10px',
            padding: '12px 26px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <i className='bx bx-cloud-download' style={{ fontSize: '17px' }} />
          Start Migration
        </button>
      )}

      {/* Running */}
      {status === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '12px' }}>
          <i className='bx bx-loader-alt' style={{ fontSize: '30px', color: '#2dd4bf', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>Migration in progress…</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Fetching all data from Replicon and importing into PSA. This can take up to 60 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>Migration failed</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{errMsg}</div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: status === 'error' ? 0 : '24px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {status === 'done' ? 'Migration complete' : 'Partial results'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px', marginBottom: '18px' }}>
            {RESULT_CARDS.map(card => (
              <div key={card.key} style={{ background: `${card.color}09`, border: `1px solid ${card.color}22`, borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                  <i className={`bx ${card.icon}`} style={{ color: card.color, fontSize: '15px' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {card.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {result[card.key]?.imported ?? 0}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)' }}>imported</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'rgba(255,255,255,0.25)' }}>
                      {result[card.key]?.skipped ?? 0}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)' }}>existed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Errors / warnings */}
          {result.errors?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, color: '#f87171' }}>
                {result.errors.length} warning{result.errors.length !== 1 ? 's' : ''}
              </p>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.38)', marginBottom: '3px' }}>{e}</div>
              ))}
            </div>
          )}

          {/* Default password notice */}
          {status === 'done' && opts.createAccounts && (result.employees?.imported ?? 0) > 0 && (
            <div style={{ background: 'rgba(250,191,36,0.06)', border: '1px solid rgba(250,191,36,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              <i className='bx bx-key' style={{ color: '#fbbf24', marginRight: '8px', verticalAlign: 'middle', fontSize: '15px' }} />
              All <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{result.employees.imported}</strong> new employee accounts were created with the default password{' '}
              <strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>Welcome1!</strong> — let them know to update it after first login.
            </div>
          )}

          {status === 'done' && (
            <button
              onClick={() => { setStatus('idle'); setResult(null); setErrMsg(''); }}
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 20px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Run again (pick up new data)
            </button>
          )}

          {status === 'error' && (
            <button
              onClick={() => { setStatus('idle'); setResult(null); setErrMsg(''); }}
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 20px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
