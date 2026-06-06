import React, { useState, useRef } from 'react';

// ── shared styles ─────────────────────────────────────────────────────────────

const cardStyle = (color) => ({
  background: `${color}09`, border: `1px solid ${color}22`,
  borderRadius: '10px', padding: '14px 16px',
});

function StatCard({ icon, label, color, children }) {
  return (
    <div style={cardStyle(color)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <i className={`bx ${icon}`} style={{ color, fontSize: '15px' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function NumPair({ a, labelA, b, labelB }) {
  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>{a ?? 0}</div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)' }}>{labelA}</div>
      </div>
      {b !== undefined && (
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'rgba(255,255,255,0.25)' }}>{b ?? 0}</div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)' }}>{labelB}</div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Replicon API Migration ───────────────────────────────────────────────

const API_CARDS = [
  { key: 'clients',    label: 'Clients',    icon: 'bx-briefcase',   color: '#34d399' },
  { key: 'employees',  label: 'Employees',  icon: 'bx-group',       color: '#60a5fa' },
  { key: 'projects',   label: 'Projects',   icon: 'bx-folder-open', color: '#818cf8' },
  { key: 'tasks',      label: 'Tasks',      icon: 'bx-task',        color: '#fbbf24' },
  { key: 'resources',  label: 'Assignments',icon: 'bx-user-check',  color: '#a78bfa' },
  { key: 'timesheets', label: 'Timesheets', icon: 'bx-time-five',   color: '#2dd4bf' },
];

function ApiMigration() {
  const [opts,   setOpts]   = useState({ createAccounts: true, importTimesheets: true });
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const toggle = key => setOpts(p => ({ ...p, [key]: !p[key] }));

  const run = async () => {
    setStatus('running'); setResult(null); setErrMsg('');
    try {
      const r = await fetch('/api/v1/admin/migrate-from-replicon', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      const data = await r.json();
      if (!r.ok) { setErrMsg(data.error || 'Migration failed'); setStatus('error'); if (data.clients) setResult(data); }
      else        { setResult(data); setStatus('done'); }
    } catch (e) { setErrMsg(e.message); setStatus('error'); }
  };

  const reset = () => { setStatus('idle'); setResult(null); setErrMsg(''); };

  return (
    <div>
      {/* Info box */}
      <div style={{ background: 'rgba(250,191,36,0.06)', border: '1px solid rgba(250,191,36,0.2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <i className='bx bx-info-circle' style={{ color: '#fbbf24', fontSize: '19px', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Pulls live from Replicon API:</strong>
          {' '}clients, employees, projects, team assignments, and historical timesheets.
          <br />Migration is <strong style={{ color: '#4ade80' }}>idempotent</strong> — existing records are skipped.
        </div>
      </div>

      {/* Options */}
      {status === 'idle' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 22px', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>Options</p>
          {[
            { key: 'createAccounts',   label: 'Create login accounts', desc: 'Default password: Welcome1!' },
            { key: 'importTimesheets', label: 'Import historical timesheets', desc: 'Requires accounts enabled.', disabled: !opts.createAccounts },
          ].map(opt => (
            <label key={opt.key} style={{ display: 'flex', gap: '12px', marginBottom: '16px', cursor: opt.disabled ? 'not-allowed' : 'pointer', opacity: opt.disabled ? 0.4 : 1 }}>
              <input type="checkbox" checked={opt.disabled ? false : opts[opt.key]} disabled={opt.disabled}
                onChange={() => !opt.disabled && toggle(opt.key)}
                style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#2dd4bf', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>{opt.label}</div>
                <div style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.38)' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {status === 'idle' && (
        <button onClick={run} style={{ background: '#2dd4bf', color: '#0f172a', border: 'none', borderRadius: '10px', padding: '12px 26px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className='bx bx-cloud-download' style={{ fontSize: '17px' }} />
          Start Migration
        </button>
      )}

      {status === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '12px' }}>
          <i className='bx bx-loader-alt' style={{ fontSize: '30px', color: '#2dd4bf', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>Migration in progress…</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>Can take up to 60 seconds.</div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>Migration failed</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{errMsg}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: status === 'error' ? 0 : '24px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {status === 'done' ? 'Migration complete' : 'Partial results'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '18px' }}>
            {API_CARDS.map(c => (
              <StatCard key={c.key} icon={c.icon} label={c.label} color={c.color}>
                <NumPair a={result[c.key]?.imported} labelA="imported" b={result[c.key]?.skipped} labelB="existed" />
              </StatCard>
            ))}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, color: '#f87171' }}>{result.errors.length} warning(s)</p>
              {result.errors.map((e, i) => <div key={i} style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.38)', marginBottom: '3px' }}>{e}</div>)}
            </div>
          )}
          {status === 'done' && opts.createAccounts && (result.employees?.imported ?? 0) > 0 && (
            <div style={{ background: 'rgba(250,191,36,0.06)', border: '1px solid rgba(250,191,36,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              <i className='bx bx-key' style={{ color: '#fbbf24', marginRight: '8px', verticalAlign: 'middle', fontSize: '15px' }} />
              {result.employees.imported} new accounts created — default password{' '}
              <strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>Welcome1!</strong>
            </div>
          )}
          <button onClick={reset} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 20px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
            {status === 'done' ? 'Run again' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: CSV Supplement Import ────────────────────────────────────────────────

function FileDropZone({ label, hint, value, onChange }) {
  const ref = useRef();
  const name = value?.name ?? null;

  const readFile = file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => onChange({ name: file.name, text: e.target.result });
    reader.readAsText(file);
  };

  return (
    <div
      onClick={() => ref.current.click()}
      onDrop={e => { e.preventDefault(); readFile(e.dataTransfer.files[0]); }}
      onDragOver={e => e.preventDefault()}
      style={{
        border: `1.5px dashed ${name ? 'rgba(45,212,191,0.45)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '12px',
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        background: name ? 'rgba(45,212,191,0.04)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <input ref={ref} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => readFile(e.target.files[0])} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <i className={`bx ${name ? 'bx-check-circle' : 'bx-upload'}`}
          style={{ fontSize: '22px', color: name ? '#2dd4bf' : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: name ? '#2dd4bf' : 'var(--text-main)', marginBottom: '3px' }}>
            {name ?? label}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.32)' }}>
            {name ? 'Click to replace' : hint}
          </div>
        </div>
        {name && (
          <button
            onClick={e => { e.stopPropagation(); onChange(null); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
          >
            <i className='bx bx-x' />
          </button>
        )}
      </div>
    </div>
  );
}

const CSV_RESULT_CARDS = [
  { label: 'Employees',        icon: 'bx-group',       color: '#60a5fa', key: 'employees',
    render: v => <NumPair a={v?.imported} labelA="new" b={v?.updated} labelB="updated" /> },
  { label: 'Client AMs',       icon: 'bx-briefcase',   color: '#34d399', key: 'clients',
    render: v => <NumPair a={v?.updated} labelA="linked" /> },
  { label: 'Projects',         icon: 'bx-folder-open', color: '#818cf8', key: 'projects',
    render: v => <NumPair a={v?.imported} labelA="new" b={v?.updated} labelB="updated" /> },
  { label: 'Tasks',            icon: 'bx-task',        color: '#fbbf24', key: 'tasks',
    render: v => <NumPair a={v?.imported} labelA="created" /> },
  { label: 'Project Links',    icon: 'bx-user-check',  color: '#a78bfa', key: 'resources',
    render: v => <NumPair a={v?.projectLinks} labelA="proj" b={v?.taskLinks} labelB="task" /> },
];

function CsvImport() {
  const [files,  setFiles]  = useState({ users: null, ams: null, tasks: null });
  const [opts,   setOpts]   = useState({ createAccounts: true });
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const setFile = key => val => setFiles(p => ({ ...p, [key]: val }));
  const hasAny  = files.users || files.ams || files.tasks;

  const run = async () => {
    setStatus('running'); setResult(null); setErrMsg('');
    try {
      const r = await fetch('/api/v1/admin/import-csv', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usersCSV:          files.users?.text   ?? null,
          accountManagersCSV: files.ams?.text   ?? null,
          projectTasksCSV:   files.tasks?.text   ?? null,
          createAccounts:    opts.createAccounts,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setErrMsg(data.error || 'Import failed'); setStatus('error'); if (data.employees) setResult(data); }
      else        { setResult(data); setStatus('done'); }
    } catch (e) { setErrMsg(e.message); setStatus('error'); }
  };

  const reset = () => { setStatus('idle'); setResult(null); setErrMsg(''); };

  return (
    <div>
      {/* Explainer */}
      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <i className='bx bx-info-circle' style={{ color: '#60a5fa', fontSize: '19px', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Upload Replicon exports</strong> to enrich your PSA data with real task names, project dates,
          account manager links, employee emails, hourly rates, departments, and supervisor chains.
          Upload any combination — all 3 files are optional.
        </div>
      </div>

      {/* File pickers */}
      {status === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '0.77rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              File 1 — Employee Roster
            </p>
            <FileDropZone
              label="Drop User Details CSV here"
              hint="Contains: name, email, login, role, supervisor, hourly rate, department…"
              value={files.users}
              onChange={setFile('users')}
            />
          </div>

          <div>
            <p style={{ margin: '0 0 8px', fontSize: '0.77rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              File 2 — Project / Task Assignments
            </p>
            <FileDropZone
              label="Drop Project Tasks CSV here"
              hint="Contains: project name, task name, user assignments, project start/end dates…"
              value={files.tasks}
              onChange={setFile('tasks')}
            />
          </div>

          <div>
            <p style={{ margin: '0 0 8px', fontSize: '0.77rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              File 3 — Client Account Managers
            </p>
            <FileDropZone
              label="Drop Account Managers CSV here"
              hint="Contains: client name → account manager name…"
              value={files.ams}
              onChange={setFile('ams')}
            />
          </div>

          {/* Option */}
          <label style={{ display: 'flex', gap: '12px', marginTop: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={opts.createAccounts}
              onChange={() => setOpts(p => ({ ...p, createAccounts: !p.createAccounts }))}
              style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#2dd4bf', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>
                Create login accounts for new employees
              </div>
              <div style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.38)' }}>
                Uses Replicon login name as username, default password Welcome1!
              </div>
            </div>
          </label>
        </div>
      )}

      {/* CTA */}
      {status === 'idle' && (
        <button
          onClick={run}
          disabled={!hasAny}
          style={{
            background: hasAny ? '#60a5fa' : 'rgba(255,255,255,0.08)',
            color: hasAny ? '#0f172a' : 'rgba(255,255,255,0.3)',
            border: 'none', borderRadius: '10px',
            padding: '12px 26px', fontSize: '0.88rem', fontWeight: 700,
            cursor: hasAny ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <i className='bx bx-import' style={{ fontSize: '17px' }} />
          {hasAny ? 'Import CSV Data' : 'Upload at least one file'}
        </button>
      )}

      {/* Running */}
      {status === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '12px' }}>
          <i className='bx bx-loader-alt' style={{ fontSize: '30px', color: '#60a5fa', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>Importing…</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>Processing your CSV files and linking data.</div>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>Import failed</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{errMsg}</div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: status === 'error' ? 0 : '24px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {status === 'done' ? 'Import complete' : 'Partial results'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px', marginBottom: '18px' }}>
            {CSV_RESULT_CARDS.map(c => (
              <StatCard key={c.key} icon={c.icon} label={c.label} color={c.color}>
                {c.render(result[c.key])}
              </StatCard>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, color: '#f87171' }}>{result.errors.length} warning(s)</p>
              {result.errors.map((e, i) => <div key={i} style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.38)', marginBottom: '3px' }}>{e}</div>)}
            </div>
          )}

          {status === 'done' && opts.createAccounts && (result.employees?.imported ?? 0) > 0 && (
            <div style={{ background: 'rgba(250,191,36,0.06)', border: '1px solid rgba(250,191,36,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              <i className='bx bx-key' style={{ color: '#fbbf24', marginRight: '8px', verticalAlign: 'middle', fontSize: '15px' }} />
              {result.employees.imported} new accounts created — default password{' '}
              <strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>Welcome1!</strong>
            </div>
          )}

          <button onClick={reset} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 20px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
            {status === 'done' ? 'Import more' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'csv', label: 'CSV Import', icon: 'bx-import', desc: 'Upload Replicon export files' },
  { id: 'api', label: 'API Migration', icon: 'bx-cloud-download', desc: 'Pull live from Replicon API' },
];

export default function Migration() {
  const [tab, setTab] = useState('csv');

  return (
    <div style={{ padding: '28px 36px', maxWidth: '860px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className='bx bx-transfer' style={{ fontSize: '22px', color: '#2dd4bf' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Data Import &amp; Migration
          </h1>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Bring your Replicon data into PSA
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? 'rgba(255,255,255,0.06)' : 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? '#2dd4bf' : 'transparent'}`,
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              color: tab === t.id ? 'var(--text-main)' : 'rgba(255,255,255,0.4)',
              fontSize: '0.85rem', fontWeight: tab === t.id ? 700 : 500,
              transition: 'all 0.15s',
            }}
          >
            <i className={`bx ${t.icon}`} style={{ fontSize: '16px' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'csv' ? <CsvImport /> : <ApiMigration />}
    </div>
  );
}
