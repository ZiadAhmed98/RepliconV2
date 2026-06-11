import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { S }          from '../../components/settings/styles';

export default function BackupRestore() {
  const [downloading, setDownloading] = useState(false);
  const [status,      setStatus]      = useState(null);

  async function downloadBackup() {
    setDownloading(true); setStatus(null);
    try {
      const r = await fetch('/api/v1/admin/backup', { credentials:'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const cd   = r.headers.get('Content-Disposition')||'';
      const name = cd.match(/filename="([^"]+)"/)?.[1]||'mds-backup.db';
      const a    = document.createElement('a'); a.href=url; a.download=name; a.click();
      URL.revokeObjectURL(url);
      setStatus({ ok:true, msg:`Downloaded ${name}` });
    } catch(e) { setStatus({ ok:false, msg:e.message }); }
    finally { setDownloading(false); }
  }

  return (
    <SettingsLayout title="Backup & Restore" subtitle="Download and restore the application database" accent="#94a3b8">

      <div style={S.card}>
        <p style={{ margin:'0 0 4px', fontSize:'14px', fontWeight:700, color:'#fff' }}>Database Backup</p>
        <p style={{ ...S.muted, marginBottom:'16px' }}>Download a complete snapshot of the SQLite database. Store it securely off-server.</p>

        {status && (
          <div style={{ marginBottom:'16px', padding:'10px 14px', borderRadius:'8px', fontSize:'13px',
            background: status.ok ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${status.ok ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
            color: status.ok ? '#34d399' : '#f87171' }}>
            {status.msg}
          </div>
        )}

        <button onClick={downloadBackup} disabled={downloading} style={{ ...S.saveBtn, opacity:downloading?0.6:1, gap:'8px' }}>
          <i className={`bx ${downloading?'bx-loader-alt bx-spin':'bx-download'}`} />
          {downloading?'Preparing…':'Download Backup'}
        </button>
      </div>

      <div style={S.card}>
        <p style={{ margin:'0 0 4px', fontSize:'14px', fontWeight:700, color:'#fff' }}>Restore</p>
        <p style={{ ...S.muted, marginBottom:'14px' }}>Restoring from a backup requires server access. Follow these steps:</p>
        <ol style={{ margin:0, paddingLeft:'20px', display:'flex', flexDirection:'column', gap:'8px' }}>
          {[
            ['docker compose down',              'Stop the application container'],
            ['cp mds-backup.db data/mds.db',     'Replace the database file'],
            ['docker compose up -d',             'Restart the container'],
          ].map(([cmd,desc],i)=>(
            <li key={i} style={{ fontSize:'13px', color:'rgba(255,255,255,0.55)' }}>
              {desc}:{' '}
              <code style={{ background:'rgba(255,255,255,0.06)', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.7)' }}>{cmd}</code>
            </li>
          ))}
        </ol>
      </div>

      <div style={S.card}>
        <p style={{ margin:'0 0 4px', fontSize:'14px', fontWeight:700, color:'#fff' }}>Scheduled Backups</p>
        <p style={{ ...S.muted, marginBottom:'12px' }}>Automated backups can be configured via a server-side cron job.</p>
        <pre style={{ margin:0, background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', padding:'12px', fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.55)', overflowX:'auto', lineHeight:1.6 }}>{`# Run daily at 2am and keep 7 days
0 2 * * * cp /app/data/mds.db /backups/mds-$(date +%Y%m%d).db && ls -t /backups/*.db | tail -n +8 | xargs rm -f`}</pre>
      </div>
    </SettingsLayout>
  );
}
