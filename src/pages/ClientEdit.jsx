import React, { useState, useMemo, useCallback } from 'react';
import styles from './EditPages.module.css';

export default function ClientEdit({ dataMatrix }) {
  const [clients,    setClients]    = useState([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedUri, setSelectedUri] = useState('');
  const [detail,     setDetail]     = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [form,       setForm]       = useState({});
  const [managerUri, setManagerUri] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [success,    setSuccess]    = useState(null);
  const [error,      setError]      = useState(null);

  const users = useMemo(() => {
    const raw = dataMatrix?.dictionaries?.users || dataMatrix?.users || [];
    return [...raw].sort((a,b)=>a.name.localeCompare(b.name));
  }, [dataMatrix]);

  // Load client list on first open
  const loadClients = useCallback(async () => {
    if (clientsLoaded) return;
    setLoadingList(true);
    try {
      const r = await fetch('/api/v1/clients/search', { credentials: 'include' });
      const d = await r.json();
      setClients(d.clients || []);
      setClientsLoaded(true);
    } catch (e) { setError('Failed to load clients: ' + e.message); }
    finally { setLoadingList(false); }
  }, [clientsLoaded]);

  const selectClient = useCallback(async (uri) => {
    setSelectedUri(uri); setDetail(null); setForm({}); setSuccess(null); setError(null);
    if (!uri) return;
    setLoadingDetail(true);
    try {
      const r = await fetch('/api/v1/clients/details', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUri: uri }),
      });
      const d = await r.json();
      const det = d.detail;
      setDetail(det);
      setForm({
        name:        det?.name || '',
        code:        det?.code || '',
        description: det?.description || '',
        contactName: det?.clientContact || '',
        address:     det?.clientAddress?.address || '',
        city:        det?.clientAddress?.city || '',
        phone:       det?.clientAddress?.phoneNumber || '',
        email:       det?.clientAddress?.email || '',
        website:     det?.clientAddress?.website || '',
      });
      setManagerUri(det?.clientManager?.uri || '');
    } catch (e) { setError('Failed to load client details: ' + e.message); }
    finally { setLoadingDetail(false); }
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUri) return;
    setSaving(true); setSuccess(null); setError(null);
    try {
      const modifications = {};
      if (form.name)        modifications.nameToApply        = { value: form.name };
      if (form.code)        modifications.codeToApply        = { value: form.code };
      if (form.description) modifications.descriptionToApply = { value: form.description };
      if (managerUri)       modifications.clientManagerToApply = { user: { uri: managerUri } };
      if (form.contactName) modifications.clientContactToApply = { value: form.contactName };
      const addrParts = {};
      if (form.address) addrParts.address     = { value: form.address };
      if (form.city)    addrParts.city         = { value: form.city };
      if (form.phone)   addrParts.phoneNumber  = { value: form.phone };
      if (form.email)   addrParts.email        = { value: form.email };
      if (form.website) addrParts.website      = { value: form.website };
      if (Object.keys(addrParts).length) modifications.clientAddressToApply = addrParts;

      const res = await fetch('/api/v1/clients/edit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUri: selectedUri, modifications }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Edit failed');
      setSuccess(`Client "${form.name}" updated successfully.`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1><i className='bx bx-edit' style={{ marginRight: 8 }} />Edit Client</h1>
          <p>Select a client to load and edit its details</p>
        </div>
      </div>

      {/* Client selector */}
      <div className={styles.selectorRibbon}>
        <label>Select Client</label>
        <select
          value={selectedUri}
          onFocus={loadClients}
          onChange={e => selectClient(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">— {loadingList ? 'Loading…' : 'Choose a client'} —</option>
          {clients.map(c => <option key={c.uri} value={c.uri}>{c.name}</option>)}
        </select>
        {loadingDetail && <span className={styles.loadingMsg}><i className='bx bx-loader-alt bx-spin' /> Loading…</span>}
      </div>

      {success && <div className={styles.successMsg}><i className='bx bx-check-circle' />{success}</div>}
      {error   && <div className={styles.errorMsg}><i className='bx bx-error-circle' />{error}</div>}

      {detail && (
        <form onSubmit={handleSubmit}>
          <div className={styles.card}>
            <div className={styles.cardHeader}><h3><i className='bx bx-briefcase' />Client Details</h3></div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Client Name *</label>
                  <input value={form.name} onChange={e=>set('name',e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Client Code</label>
                  <input value={form.code} onChange={e=>set('code',e.target.value)} />
                </div>
                <div className={`${styles.formGroup} ${styles.spanAll}`}>
                  <label>Description</label>
                  <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} style={{ resize: 'vertical' }} />
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
            <div className={styles.cardHeader}><h3><i className='bx bx-map' />Contact & Address</h3></div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Contact Name</label>
                  <input value={form.contactName} onChange={e=>set('contactName',e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input value={form.phone} onChange={e=>set('phone',e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Website</label>
                  <input value={form.website} onChange={e=>set('website',e.target.value)} placeholder="www.client.com" />
                </div>
                <div className={styles.formGroup}>
                  <label>Address</label>
                  <input value={form.address} onChange={e=>set('address',e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>City</label>
                  <input value={form.city} onChange={e=>set('city',e.target.value)} />
                </div>
              </div>
            </div>
            <div className={styles.submitBar}>
              <button type="button" className={styles.btnGhost} onClick={() => { setSelectedUri(''); setDetail(null); setSuccess(null); setError(null); }}>
                <i className='bx bx-x' /> Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving || !form.name?.trim()}>
                {saving ? <><i className='bx bx-loader-alt bx-spin' /> Saving…</> : <><i className='bx bx-save' /> Save Changes</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {!detail && !loadingDetail && !selectedUri && (
        <div className={styles.card} style={{ padding: '48px 24px', textAlign: 'center' }}>
          <i className='bx bx-briefcase' style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.1)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-4)', fontSize: '0.875rem' }}>Select a client above to load its details for editing.</p>
        </div>
      )}
    </div>
  );
}
