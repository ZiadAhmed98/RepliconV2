import { Router }                    from 'express';
import crypto                        from 'crypto';
import multer                        from 'multer';
import { parse }                     from 'csv-parse/sync';
import db                            from '../lib/db.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/v1/programs
router.get('/api/v1/programs', requireAuth, (req, res) => {
  const programs = db.prepare(`
    SELECT p.id, p.name, p.description, p.createdAt, p.updatedAt,
           COUNT(pr.id) AS projectCount
    FROM programs p
    LEFT JOIN projects pr ON pr.programId = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
  `).all();

  const getProjects = db.prepare(`
    SELECT pr.id, pr.name, pr.status, pr.startDate, pr.endDate,
           c.name AS clientName, pr.clientId
    FROM projects pr
    LEFT JOIN clients c ON c.id = pr.clientId
    WHERE pr.programId = ?
    ORDER BY pr.name ASC
  `);

  for (const prog of programs) {
    prog.projects = getProjects.all(prog.id);
  }

  res.json({ programs });
});

// POST /api/v1/programs
router.post('/api/v1/programs', requireAdmin, (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const now = new Date().toISOString();
  const id  = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO programs (id,name,description,createdAt,updatedAt) VALUES (?,?,?,?,?)')
      .run(id, name.trim(), description?.trim() || null, now, now);
    res.json({ program: { id, name: name.trim(), description: description?.trim() || null, projectCount: 0, projects: [], createdAt: now, updatedAt: now } });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Program name already exists' });
    throw e;
  }
});

// PUT /api/v1/programs/:id
router.put('/api/v1/programs/:id', requireAdmin, (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const now = new Date().toISOString();
  try {
    const r = db.prepare('UPDATE programs SET name=?,description=?,updatedAt=? WHERE id=?')
      .run(name.trim(), description?.trim() || null, now, req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Program name already exists' });
    throw e;
  }
});

// DELETE /api/v1/programs/:id
router.delete('/api/v1/programs/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE projects SET programId=NULL WHERE programId=?').run(req.params.id);
  db.prepare('DELETE FROM programs WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/v1/programs/import-csv — parse Replicon export CSV, link projects → programs
router.post('/api/v1/programs/import-csv', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let rows;
  try {
    rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    return res.status(400).json({ error: 'Invalid CSV' });
  }

  const now = new Date().toISOString();
  let programsCreated = 0;
  let projectsLinked  = 0;

  // 1. Ensure all programs exist
  const uniquePrograms = [...new Set(rows.map(r => r['Program Name']).filter(Boolean))];
  db.transaction(() => {
    for (const pname of uniquePrograms) {
      const exists = db.prepare('SELECT id FROM programs WHERE LOWER(name)=LOWER(?)').get(pname);
      if (!exists) {
        db.prepare('INSERT INTO programs (id,name,createdAt,updatedAt) VALUES (?,?,?,?)').run(crypto.randomUUID(), pname, now, now);
        programsCreated++;
      }
    }
  })();

  // 2. Link each unique (project, client) combination to its program
  const seen = new Set();
  db.transaction(() => {
    for (const row of rows) {
      const pname = row['Program Name']?.trim();
      const projName = row['Project Name']?.trim();
      const clientName = row['Client Name']?.trim();
      const key = `${pname}|${projName}|${clientName}`;
      if (!pname || !projName || seen.has(key)) continue;
      seen.add(key);

      const program = db.prepare('SELECT id FROM programs WHERE LOWER(name)=LOWER(?)').get(pname);
      if (!program) continue;

      // Try exact match with client first
      let project = db.prepare(`
        SELECT pr.id FROM projects pr
        LEFT JOIN clients c ON c.id = pr.clientId
        WHERE LOWER(pr.name)=LOWER(?) AND LOWER(COALESCE(c.name,''))=LOWER(?)
      `).get(projName, clientName || '');

      // Fall back to name-only match
      if (!project) {
        project = db.prepare('SELECT id FROM projects WHERE LOWER(name)=LOWER(?)').get(projName);
      }

      if (project) {
        const r = db.prepare('UPDATE projects SET programId=?,programName=?,updatedAt=? WHERE id=?')
          .run(program.id, pname, now, project.id);
        if (r.changes > 0) projectsLinked++;
      }
    }
  })();

  res.json({ ok: true, programsCreated, projectsLinked });
});

export default router;
