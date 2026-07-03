import 'dotenv/config';
import express       from 'express';
import path          from 'path';
import { fileURLToPath } from 'url';
import cors          from 'cors';
import cookieParser  from 'cookie-parser';

import { logger }            from './lib/helpers.js';
import { ensureDefaultUsers } from './lib/rbac.js';
import { csrfProtection }     from './lib/csrf.js';

import authRouter        from './routes/auth.js';
import adminRouter       from './routes/admin.js';
import dashboardRouter   from './routes/dashboard.js';
import projectsRouter    from './routes/projects.js';
import clientsRouter     from './routes/clients.js';
import aiRouter          from './routes/ai.js';
import employeesRouter   from './routes/employees.js';
import psaClientsRouter  from './routes/psaClients.js';
import psaProjectsRouter from './routes/psaProjects.js';
import psaTasksRouter    from './routes/psaTasks.js';
import psaTimesheetsRouter from './routes/psaTimesheets.js';
import graphRouter       from './routes/graph.js';
import migrationRouter      from './routes/migration.js';
import csvImportRouter      from './routes/csvImport.js';
import accountManagersRouter from './routes/accountManagers.js';
import templatesRouter   from './routes/templates.js';
import homeRouter        from './routes/home.js';
import programsRouter    from './routes/programs.js';
import settingsRouter    from './routes/settings.js';
import supportRouter     from './routes/support.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

// Behind nginx/Docker: trust the first proxy hop so req.ip and req.secure
// reflect the real client — fixes rate-limiter keying and IP logging.
app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options',   'nosniff');
  res.setHeader('X-Frame-Options',          'DENY');
  res.setHeader('Referrer-Policy',          'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection',         '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy',        'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
    "font-src 'self' https://fonts.gstatic.com https://unpkg.com; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://ap1.replicon.com https://cdnjs.cloudflare.com; " +
    "worker-src 'self' blob:"
  );
  next();
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost,https://localhost,http://129.151.146.210,https://129.151.146.210').split(',').map(o => o.trim()).filter(Boolean);

// Allowed hostnames derived from the configured origins. We match the hostname
// EXACTLY but allow any port, because the same host is served on several ports
// (443 prod, 8081 test, 8082 dev). Exact-hostname matching still blocks
// suffix-bypass origins like http://129.151.146.210.evil.com.
const allowedHosts = new Set();
for (const o of allowedOrigins) { try { allowedHosts.add(new URL(o).hostname); } catch { /* ignore bad entry */ } }

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header (same-origin nav, curl, server-to-server) → allow.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    try {
      if (allowedHosts.has(new URL(origin).hostname)) return cb(null, true); // same host, any port
    } catch { /* malformed origin → falls through to reject */ }
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(csrfProtection);

// Routes
app.use(authRouter);
app.use(adminRouter);
app.use(dashboardRouter);
app.use(projectsRouter);
app.use(clientsRouter);
app.use(aiRouter);
app.use(employeesRouter);
app.use(psaClientsRouter);
app.use(psaProjectsRouter);
app.use(psaTasksRouter);
app.use(psaTimesheetsRouter);
app.use(graphRouter);
app.use(migrationRouter);
app.use(csvImportRouter);
app.use(accountManagersRouter);
app.use(templatesRouter);
app.use(homeRouter);
app.use(programsRouter);
app.use(settingsRouter);
app.use(supportRouter);

// Block old human-readable admin routes — return 403 before the SPA catch-all
// so typing these URLs directly never renders a page.
const BLOCKED_FRONT_PATHS = ['/settings', '/administration', '/audit-log', '/migration'];
app.use((req, res, next) => {
  const p = req.path.replace(/\/$/, '');
  if (BLOCKED_FRONT_PATHS.includes(p)) {
    return res.status(403).send('403 Forbidden');
  }
  next();
});

// Static files + SPA fallback
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css'))      res.setHeader('Content-Type', 'text/css');
    else if (filePath.endsWith('.js'))  res.setHeader('Content-Type', 'application/javascript');
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Global error handler — must have 4 args so Express treats it as error middleware.
// Catches body-parser SyntaxError, CORS rejections, and anything else that calls next(err).
// Never expose stack traces or internal paths to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  const safe   = status < 500 ? (err.message || 'Request error') : 'Internal server error';
  res.status(status).json({ error: safe });
});

// Seed default users then start listening
ensureDefaultUsers()
  .catch(e => logger.error({ err: e }, 'ensureDefaultUsers failed'))
  .finally(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => logger.info({ port: PORT }, `Server running on port ${PORT}`));
  });
