import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

const ACCENT = '#60a5fa';

const APPROVER_TYPES = [
  ['pm',         'Project Manager'],
  ['supervisor', 'Supervisor'],
  ['admin',      'Administrator'],
];
const TYPE_LABEL = Object.fromEntries(APPROVER_TYPES);

export default function ApprovalWorkflow() {
  const { settings, loading, saving, dirty, update, save } = useSettings('approval');

  if (loading) return <SettingsLayout title="Approval Workflow" accent={ACCENT}><p style={S.muted}>Loading…</p></SettingsLayout>;

  const mode  = settings.mode ?? 'single';
  const steps = Array.isArray(settings.steps) ? settings.steps : [];
  const conditions = Array.isArray(settings.conditions) ? settings.conditions : [];

  const setSteps = (next) => update('steps', next);
  const addStep    = ()          => setSteps([...steps, { type: 'pm', label: 'Project Manager' }]);
  const removeStep = (i)         => setSteps(steps.filter((_, idx) => idx !== i));
  const patchStep  = (i, patch)  => setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const moveStep   = (i, dir)    => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  const setConds   = (next)      => update('conditions', next);
  const addCond    = ()          => setConds([...conditions, { when: 'hoursOver', value: 40, approver: 'supervisor' }]);
  const removeCond = (i)         => setConds(conditions.filter((_, idx) => idx !== i));
  const patchCond  = (i, patch)  => setConds(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <SettingsLayout title="Approval Workflow" subtitle="How submitted timesheets get approved" accent={ACCENT}>

      {/* Mode */}
      <div style={S.card}>
        <p style={S.cardTitle}>Approval Mode</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            ['single',      'Single approver',  'Any manager or admin approves the timesheet in one step.'],
            ['sequential',  'Sequential chain', 'The timesheet moves through the ordered steps below; each must approve before the next.'],
            ['conditional', 'Conditional',      'Approval is required only when a rule matches (e.g. above 40 hours or has overtime); otherwise auto-approved.'],
            ['auto',        'Auto-approve',     'Timesheets are approved automatically the moment they are submitted.'],
          ].map(([val, label, hint]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${mode === val ? ACCENT : 'rgba(255,255,255,0.1)'}`, background: mode === val ? `${ACCENT}12` : 'transparent' }}>
              <input type="radio" name="mode" checked={mode === val} onChange={() => update('mode', val)} style={{ marginTop: '2px', accentColor: ACCENT, width: '16px', height: '16px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px', lineHeight: 1.45 }}>{hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Chain builder — only relevant for sequential */}
      {mode === 'sequential' && (
        <div style={S.card}>
          <p style={S.cardTitle}>Approval Chain · {steps.length} step{steps.length !== 1 ? 's' : ''}</p>
          {steps.length === 0 && <p style={{ ...S.muted, marginBottom: '14px' }}>No steps yet. Add the approvers a timesheet must pass through, in order.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ width: '24px', height: '24px', flexShrink: 0, borderRadius: '50%', background: `${ACCENT}22`, color: ACCENT, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <select style={{ ...S.select, flex: '0 0 180px' }} value={step.type}
                  onChange={e => patchStep(i, { type: e.target.value, label: TYPE_LABEL[e.target.value] })}>
                  {APPROVER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input style={{ ...S.input, flex: 1 }} value={step.label ?? ''} placeholder="Step label (e.g. Finance sign-off)" onChange={e => patchStep(i, { label: e.target.value })} />
                <button style={S.iconBtn} title="Move up"   onClick={() => moveStep(i, -1)} disabled={i === 0}><i className="bx bx-chevron-up" /></button>
                <button style={S.iconBtn} title="Move down" onClick={() => moveStep(i, +1)} disabled={i === steps.length - 1}><i className="bx bx-chevron-down" /></button>
                <button style={{ ...S.iconBtn, color: '#f87171' }} title="Remove" onClick={() => removeStep(i)}><i className="bx bx-trash" /></button>
              </div>
            ))}
          </div>

          <button style={{ ...S.addBtn, marginTop: '14px', background: 'rgba(255,255,255,0.06)', color: ACCENT, border: `1px solid ${ACCENT}40` }} onClick={addStep}>
            <i className="bx bx-plus" /> Add step
          </button>

          <p style={{ ...S.muted, marginTop: '14px' }}>
            Admins can approve any step. Otherwise a step is only approvable by a user of the matching role.
          </p>
        </div>
      )}

      {/* Conditional approver rules */}
      {mode === 'conditional' && (
        <div style={S.card}>
          <p style={S.cardTitle}>Conditional Approver Rules · {conditions.length} rule{conditions.length !== 1 ? 's' : ''}</p>
          {conditions.length === 0 && <p style={{ ...S.muted, marginBottom: '14px' }}>No rules yet — with none, every timesheet auto-approves. Add a rule to require approval in specific cases.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Require</span>
                <select style={{ ...S.select, flex: '0 0 150px' }} value={c.approver ?? 'supervisor'} onChange={e => patchCond(i, { approver: e.target.value })}>
                  {APPROVER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>approval when</span>
                <select style={{ ...S.select, flex: '0 0 180px' }} value={c.when ?? 'hoursOver'} onChange={e => patchCond(i, { when: e.target.value })}>
                  <option value="hoursOver">weekly hours are above</option>
                  <option value="hasOvertime">the week has overtime</option>
                  <option value="always">always (every timesheet)</option>
                </select>
                {c.when === 'hoursOver' && (
                  <input style={{ ...S.input, flex: '0 0 90px' }} type="number" min={0} step={1} value={c.value ?? 40} onChange={e => patchCond(i, { value: Number(e.target.value) })} />
                )}
                <button style={{ ...S.iconBtn, color: '#f87171', marginLeft: 'auto' }} title="Remove" onClick={() => removeCond(i)}><i className="bx bx-trash" /></button>
              </div>
            ))}
          </div>

          <button style={{ ...S.addBtn, marginTop: '14px', background: 'rgba(255,255,255,0.06)', color: ACCENT, border: `1px solid ${ACCENT}40` }} onClick={addCond}>
            <i className="bx bx-plus" /> Add rule
          </button>

          <p style={{ ...S.muted, marginTop: '14px' }}>
            If no rule matches a submitted timesheet, it is approved automatically. Overtime is defined by the weekly threshold in <strong>Overtime Rules</strong>.
          </p>
        </div>
      )}

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty || saving} style={{ ...S.saveBtn, opacity: (!dirty || saving) ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
