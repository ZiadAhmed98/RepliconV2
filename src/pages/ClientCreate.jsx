import React, { useState, useMemo } from 'react';
import styles from './EditPages.module.css';

export default function ClientCreate({ dataMatrix }) {
  const [form, setForm] = useState({ name: '', code: '', description: '', contactName: '', contactEmail: '', phone: '', address: '', city: '' });
  const [managerUri, setManagerUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error,   setError]   = useState(null);

  const users = useMemo(() => {
    const raw = dataMatrix?.dictionaries?.users || dataMatrix?.users || [];
    return [...raw].sort((a,b)=>a.name.localeCompare(b.name));
  }, [dataMatrix]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isValid = form.name.trim() !== '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true); setSuccess(null); setError(null);
    try {
      const modifications = {
        nameToApply:        { value: form.name.trim() },
        ...(form.code        ? { codeToApply:        { value: form.code.trim()        } } : {}),
        ...(form.description ? { descriptionToApply: { value: form.description.trim() } } : {}),
        statusToApply: true,
        ...(managerUri ? { clientManagerToApply: { user: { uri: managerUri } } } : {}),
        ...(form.contactName || form.contactEmail || form.phone ? {
          clientContactToApply: { value: [form.contactName, form.contactEmail, form.phone].filter(Boolean).join(' | ') },
        } : {}),
        ...(form.address || form.city ? {
          clientAddressToApply: {
            ...(form.address ? { address: { value: form.address } } : {}),
            ...(form.city    ? { city:    { value: form.city    } } : {}),
          },
        } : {}),
      };
      const res = await fetch('/api/v1/clients/create', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), code: form.code.trim(), description: form.description.trim(), modifications }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setSuccess(`Client "${form.name}" created successfully.`);
      setForm({ name: '', code: '', description: '', contactName: '', contactEmail: '', phone: '', address: '', city: '' });
      setManagerUri('');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1><i className='bx bx-plus-circle' style={{ marginRight: 8 }} />Create Client</h1>
          <p>Add a new client to Replicon</p>
        </div>
      </div>

      {success && <div className={styles.successMsg}><i className='bx bx-check-circle' />{success}</div>}
      {error   && <div className={styles.errorMsg}><i className='bx bx-error-circle' />{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles.card}>
          <div className={styles.cardHeader}><h3><i className='bx bx-briefcase' />Client Information</h3></div>
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Client Name *</label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Acme Corporation" required />
              </div>
              <div className={styles.formGroup}>
                <label>Client Code</label>
                <input value={form.code} onChange={e=>set('code',e.target.value)} placeholder="e.g. ACME-001" />
              </div>
              <div className={`${styles.formGroup} ${styles.spanAll}`}>
                <label>Description</label>
                <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} placeholder="Brief description of this client…" style={{ resize: 'vertical' }} />
              </div>
              <div className={styles.formGroup}>
                <label>Client Manager</label>
                <select value={managerUri} onChange={e=>setManagerUri(e.target.value)}>
                  <option value="">— None —</option>
                  {users.map(u => <option key={u.uri} value={u.uri}>{u.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ marginTop: 16 }}>
          <div className={styles.cardHeader}><h3><i className='bx bx-user' />Contact & Address</h3></div>
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Contact Name</label>
                <input value={form.contactName} onChange={e=>set('contactName',e.target.value)} placeholder="Primary contact person" />
              </div>
              <div className={styles.formGroup}>
                <label>Contact Email</label>
                <input type="email" value={form.contactEmail} onChange={e=>set('contactEmail',e.target.value)} placeholder="contact@client.com" />
              </div>
              <div className={styles.formGroup}>
                <label>Phone</label>
                <input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+971 4 555 0000" />
              </div>
              <div className={styles.formGroup}>
                <label>City</label>
                <input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Dubai" />
              </div>
              <div className={`${styles.formGroup} ${styles.spanAll}`}>
                <label>Address</label>
                <input value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Street address" />
              </div>
            </div>
          </div>
          <div className={styles.submitBar}>
            <button type="button" className={styles.btnGhost} onClick={() => { setForm({ name:'',code:'',description:'',contactName:'',contactEmail:'',phone:'',address:'',city:'' }); setManagerUri(''); setSuccess(null); setError(null); }}>
              <i className='bx bx-reset' /> Clear
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={!isValid || saving}>
              {saving ? <><i className='bx bx-loader-alt bx-spin' /> Creating…</> : <><i className='bx bx-save' /> Create Client</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
