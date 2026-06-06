import 'dotenv/config';
import express       from 'express';
import path          from 'path';
import { fileURLToPath } from 'url';
import cors          from 'cors';
import cookieParser  from 'cookie-parser';

import { logger }            from './lib/helpers.js';
import { ensureDefaultUsers } from './lib/rbac.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// Security headers (HTTP-only server — no HSTS, no upgrade-insecure-requests)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options',   'nosniff');
  res.setHeader('X-Frame-Options',          'SAMEORIGIN');
  res.setHeader('Referrer-Policy',          'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection',         '1; mode=block');
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

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost,http://129.151.146.210').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

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

// Seed default users then start listening
ensureDefaultUsers()
  .catch(e => logger.error({ err: e }, 'ensureDefaultUsers failed'))
  .finally(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => logger.info({ port: PORT }, `Server running on port ${PORT}`));
  });
