import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

const ACCENT = '#818cf8';

// ── Small local field helpers (kept in-file so the shared kit is untouched) ──
function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? ACCENT : 'rgba(255,255,255,0.14)', position: 'relative', transition: 'background 0.18s', padding: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
    </button>
  );
}

function ToggleRow({ label, hint, on, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{label}</div>
        {hint && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: 1.45 }}>{hint}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

const BILLING_TYPES = [
  ['time_material', 'Time & Material'],
  ['adoption_tm',   'Adoption / PS (T&M streams)'],
  ['fixed_bid',     'Fixed Bid'],
  ['sla_retainer',  'SLA / Retainer'],
  ['staff_aug',     'Staff Augmentation'],
  ['non_billable',  'Non-Billable'],
];
const STATUSES = [
  ['tentative', 'Tentative'], ['in_progress', 'In Progress'], ['completed', 'Completed'],
  ['deferred', 'Deferred'], ['cancelled', 'Cancelled'], ['archived', 'Archived'],
];

export default function ProjectSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('projects');
  const g = (k, d) => settings[k] ?? d;

  if (loading) return <SettingsLayout title="Project Settings" accent={ACCENT}><p style={S.muted}>Loading…</p></SettingsLayout>;

  // Live preview of an auto-generated code from the current numbering config.
  const prefix  = String(g('codePrefix', 'PRJ')).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PRJ';
  const pad     = Math.min(Math.max(Number(g('codePadding', 4)) || 4, 1), 8);
  const year    = new Date().getFullYear();
  const base    = g('codeScheme', 'prefix_year_seq') === 'prefix_seq' ? `${prefix}-` : `${prefix}-${year}-`;
  const preview = base + '1'.padStart(pad, '0');

  return (
    <SettingsLayout title="Project Settings" subtitle="Defaults, validation rules, numbering and health thresholds applied to every project" accent={ACCENT}>

      {/* ── Creation Defaults ─────────────────────────────────────────── */}
      <div style={S.card}>
        <p style={S.cardTitle}>Creation Defaults · pre-filled on every new project</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Default Status</label>
            <select style={S.select} value={g('defaultStatus', 'in_progress')} onChange={e => update('defaultStatus', e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Default Billing Model</label>
            <select style={S.select} value={g('defaultBillingType', 'time_material')} onChange={e => update('defaultBillingType', e.target.value)}>
              {BILLING_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Default Budget (hours)</label>
            <input style={S.input} type="number" min={0} step={5} value={g('defaultBudgetHours', 0)} onChange={e => update('defaultBudgetHours', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* ── Project Code / Numbering ──────────────────────────────────── */}
      <div style={S.card}>
        <p style={S.cardTitle}>Project Code &amp; Numbering</p>
        <ToggleRow label="Auto-generate project codes"
          hint="When a project is created without a code, the server assigns the next sequential number automatically."
          on={!!g('autoGenerateCode', false)} onChange={v => update('autoGenerateCode', v)} />
        <div style={{ ...S.grid2, marginTop: '16px', opacity: g('autoGenerateCode', false) ? 1 : 0.5, pointerEvents: g('autoGenerateCode', false) ? 'auto' : 'none' }}>
          <div>
            <label style={S.label}>Prefix</label>
            <input style={S.input} type="text" value={g('codePrefix', 'PRJ')} onChange={e => update('codePrefix', e.target.value.toUpperCase())} placeholder="PRJ" />
          </div>
          <div>
            <label style={S.label}>Scheme</label>
            <select style={S.select} value={g('codeScheme', 'prefix_year_seq')} onChange={e => update('codeScheme', e.target.value)}>
              <option value="prefix_year_seq">Prefix + Year + Sequence</option>
              <option value="prefix_seq">Prefix + Sequence</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Number Padding (digits)</label>
            <input style={S.input} type="number" min={1} max={8} value={g('codePadding', 4)} onChange={e => update('codePadding', Number(e.target.value))} />
          </div>
          <div>
            <label style={S.label}>Next code will look like</label>
            <div style={{ ...S.input, display: 'flex', alignItems: 'center', fontFamily: 'monospace', color: ACCENT, letterSpacing: '0.03em' }}>{preview}</div>
          </div>
        </div>
      </div>

      {/* ── Required Fields ───────────────────────────────────────────── */}
      <div style={S.card}>
        <p style={S.cardTitle}>Required Fields · enforced when creating a project</p>
        <ToggleRow label="Require a client"           hint="Projects cannot be created without an assigned client." on={!!g('requireClient', false)}          onChange={v => update('requireClient', v)} />
        <ToggleRow label="Require a project manager"  hint="A PM must be chosen before the project can be saved."     on={!!g('requireProjectManager', false)} onChange={v => update('requireProjectManager', v)} />
        <ToggleRow label="Require start &amp; end dates"  hint="Both dates are mandatory — enables timeline reporting." on={!!g('requireDates', false)}           onChange={v => update('requireDates', v)} />
        <ToggleRow label="Require a budget"           hint="Budget or quoted hours must be greater than zero."        on={!!g('requireBudget', false)}          onChange={v => update('requireBudget', v)} />
      </div>

      {/* ── Budget Health ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <p style={S.cardTitle}>Budget Health · drives burn-rate colours on project pages</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Warning threshold (% of budget)</label>
            <input style={S.input} type="number" min={10} max={200} step={5} value={g('budgetAlertPct', 80)} onChange={e => update('budgetAlertPct', Number(e.target.value))} />
            <div style={{ ...S.muted, marginTop: '5px' }}>Burn rate turns amber above this.</div>
          </div>
          <div>
            <label style={S.label}>Critical threshold (% of budget)</label>
            <input style={S.input} type="number" min={10} max={300} step={5} value={g('budgetCriticalPct', 100)} onChange={e => update('budgetCriticalPct', Number(e.target.value))} />
            <div style={{ ...S.muted, marginTop: '5px' }}>Burn rate turns red above this.</div>
          </div>
        </div>
      </div>

      {/* ── Team & Access ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <p style={S.cardTitle}>Team &amp; Access</p>
        <ToggleRow label="Auto-add the project manager to the team"
          hint="On creation, the assigned PM is also added as a project resource."
          on={!!g('autoAssignPmToTeam', false)} onChange={v => update('autoAssignPmToTeam', v)} />
        <ToggleRow label="Allow employees to request project access"
          hint="Shows a “Request access” action so staff can ask to join projects they’re not on."
          on={g('allowAccessRequests', true) !== false} onChange={v => update('allowAccessRequests', v)} />
      </div>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty || saving} style={{ ...S.saveBtn, opacity: (!dirty || saving) ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
