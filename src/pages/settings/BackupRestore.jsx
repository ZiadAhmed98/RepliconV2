import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';

export default function BackupRestore() {
  const [downloading, setDownloading] = useState(false);
  const [status,      setStatus]      = useState(null);

  async function downloadBackup() {
    setDownloading(true);
    setStatus(null);
    try {
      const r = await fetch('/api/v1/admin/backup', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const cd   = r.headers.get('Content-Disposition') || '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] || 'mds-backup.db';
      const a    = document.createElement('a');
      a.href     = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', msg: `Downloaded ${name}` });
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <SettingsLayout title="Backup & Restore" subtitle="Download and restore the application database" accent="#94a3b8">
      <div className="space-y-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Database Backup</h2>
          <p className="text-slate-400 text-sm mb-4">Download a complete snapshot of the SQLite database. Store it securely off-server.</p>

          {status && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {status.msg}
            </div>
          )}

          <button onClick={downloadBackup} disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
            <i className={`bx ${downloading ? 'bx-loader-alt bx-spin' : 'bx-download'}`} />
            {downloading ? 'Preparing…' : 'Download Backup'}
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Restore</h2>
          <p className="text-slate-400 text-sm mb-4">Restoring from a backup requires server access. Follow these steps:</p>
          <ol className="space-y-2 text-slate-400 text-sm list-decimal list-inside">
            <li>Stop the application container: <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">docker compose down</code></li>
            <li>Replace the database file: <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">cp mds-backup.db data/mds.db</code></li>
            <li>Restart the container: <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">docker compose up -d</code></li>
          </ol>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Scheduled Backups</h2>
          <p className="text-slate-400 text-sm">Automated backups can be configured via a server-side cron job.</p>
          <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto">{`# Run daily at 2am and keep 7 days
0 2 * * * cp /app/data/mds.db /backups/mds-$(date +%Y%m%d).db && ls -t /backups/*.db | tail -n +8 | xargs rm -f`}</pre>
        </div>
      </div>
    </SettingsLayout>
  );
}
