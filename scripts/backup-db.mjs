/**
 * scripts/backup-db.mjs — consistent, timestamped SQLite backup with retention.
 *
 * Uses better-sqlite3's online backup API, which is safe to run while the app
 * is live (it does not lock the DB for the whole copy).
 *
 * Usage:
 *   node scripts/backup-db.mjs
 *
 * Env:
 *   DB_PATH      absolute path to the DB   (default: ./data/mds.db)
 *   BACKUP_DIR   where backups are written (default: ./data/backups)
 *   BACKUP_KEEP  how many to retain        (default: 30)
 *
 * Recommended cron (server, daily at 02:30):
 *   30 2 * * * cd /var/www/replicon/test && /usr/bin/node scripts/backup-db.mjs >> data/backups/backup.log 2>&1
 *   # then sync offsite, e.g.:
 *   35 2 * * * rclone copy /var/www/replicon/test/data/backups remote:mds-backups
 */
import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.join(__dirname, '..');
const DB_PATH    = process.env.DB_PATH    || path.join(ROOT, 'data', 'mds.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'data', 'backups');
const KEEP       = Number(process.env.BACKUP_KEEP || 30);

mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest  = path.join(BACKUP_DIR, `mds-${stamp}.db`);

const db = new Database(DB_PATH, { readonly: true });
try {
  await db.backup(dest);
  console.log(`[backup] ${new Date().toISOString()} wrote ${dest}`);
} finally {
  db.close();
}

// Retention — keep the newest KEEP backups, delete the rest.
const files = readdirSync(BACKUP_DIR)
  .filter(f => f.startsWith('mds-') && f.endsWith('.db'))
  .map(f => ({ f, t: statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

for (const { f } of files.slice(KEEP)) {
  unlinkSync(path.join(BACKUP_DIR, f));
  console.log(`[backup] pruned ${f}`);
}
