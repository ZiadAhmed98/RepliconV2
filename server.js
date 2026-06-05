import 'dotenv/config';
import express               from 'express';
import axios                 from 'axios';
import path                  from 'path';
import { fileURLToPath }     from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import cors                  from 'cors';
import cookieParser          from 'cookie-parser';
import rateLimit             from 'express-rate-limit';
import { z }                 from 'zod';
import crypto                from 'crypto';
import pino                  from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ============================================================================
// STRUCTURED LOGGER (6.3)
// ============================================================================
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // pino-pretty is not bundled in the Docker image — plain JSON logs only
});

// ============================================================================
// IN-MEMORY SESSION STORE (4.1 / 4.2)
// Swap for Redis in production via ioredis for persistence across restarts.
// ============================================================================
const sessions = new Map();

function createSession(user) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (Number(process.env.SESSION_MS) || 3600000);
  sessions.set(token, { user, expiresAt });
  return { token, expiresAt };
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
  return session;
}

// Periodic cleanup to avoid memory leaks
setInterval(() => {
  for (const [token, s] of sessions) { if (Date.now() > s.expiresAt) sessions.delete(token); }
}, 10 * 60 * 1000);

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = express();

// 4.4 Minimal security headers — set manually so helmet defaults can't interfere.
// This server runs HTTP only; HSTS and upgrade-insecure-requests must never be sent.
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
    // upgrade-insecure-requests is intentionally NOT included — HTTP server only
  );
  next();
});

// 4.8 CORS Lockdown
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost,http://129.151.146.210').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

// 4.2 Auth Middleware
function requireAuth(req, res, next) {
  const token   = req.cookies?.mds_session;
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  req.user = session.user;
  next();
}

// 4.9 Audit Logger
function auditLog(user, action, details = {}) {
  logger.info({ audit: true, user, action, ...details }, `AUDIT: ${user} → ${action}`);
}

// ============================================================================
// HELPER UTILITIES (unchanged from original)
// ============================================================================
function cleanStr(str) { return !str ? '' : str.replace(/[\r\n\t]/g, '').trim(); }
function parseCSVLine(line) {
  const result = []; let cur = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(cleanStr(cur)); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cleanStr(cur));
  return result;
}
function parseNumber(val) { return parseFloat(String(val).replace(/"/g, '').replace(/,/g, '')) || 0; }
function parseDateToTimestamp(dateStr) { const p = Date.parse((dateStr || '').replace(/"/g, '')); return isNaN(p) ? 0 : p; }

// ============================================================================
// WCF REQUEST WRAPPER (with pino logging)
// ============================================================================
async function wcfRequest(stepName, url, payload, headers) {
  logger.debug({ step: stepName, url }, 'WCF Request');
  try {
    const response = await axios.post(url, payload, { headers });
    logger.debug({ step: stepName }, 'WCF Success');
    return response.data;
  } catch (error) {
    logger.error({ step: stepName, status: error.response?.status, body: error.response?.data }, 'WCF Error');
    throw error;
  }
}

// ============================================================================
// 4.3 RATE LIMITER — login endpoint
// ============================================================================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// ============================================================================
// 6.4 HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    sessions: sessions.size,
  });
});

// ============================================================================
// AUTH: LOGIN — validated against .env only, no Replicon API call needed
// ============================================================================
const DISPLAY_NAMES = { ziad: 'Ziad Shafik', mod: 'Irfan Najmi', gm: 'Habib Matta' };

function handleLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const lowerUsername = String(username).toLowerCase().trim();
  const pwdMap = { ziad: process.env.AdminPWD, mod: process.env.ModPWD, gm: process.env.GMPWD };

  if (!pwdMap[lowerUsername] || pwdMap[lowerUsername] !== password) {
    logger.warn({ username: lowerUsername, ip: req.ip }, 'Failed login attempt');
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const displayName         = DISPLAY_NAMES[lowerUsername] || lowerUsername;
  const { token: sessionToken } = createSession({ name: displayName, role: lowerUsername });

  res.cookie('mds_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   Number(process.env.SESSION_MS) || 3600000,
  });

  auditLog(displayName, 'LOGIN', { ip: req.ip });
  logger.info({ user: displayName }, 'Login success');
  res.json({ success: true, displayName });
}

app.post('/api/v1/login', loginLimiter, handleLogin);
app.post('/api/login',    loginLimiter, handleLogin);

// Auth: Validate session (used by frontend on mount)
app.get('/api/v1/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Auth: Logout
app.post('/api/v1/logout', (req, res) => {
  const token = req.cookies?.mds_session;
  if (token) sessions.delete(token);
  res.clearCookie('mds_session');
  res.json({ success: true });
});

// ============================================================================
// DASHBOARD DATA (6.1 Streaming SSE — sends each source as it arrives)
// ============================================================================
app.get('/api/v1/dashboard', requireAuth, async (req, res) => {
  const token   = (process.env.REPLICON_TOKEN   || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
  const reportEndpoint = `https://ap1.replicon.com/${company}/services/ReportService1.svc/GenerateReport`;

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const sendError = (msg) => { res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`); res.end(); };

  try {
    // --- Dictionaries ---
    const fetchListData = async (dictName, serviceName, columnUri) => {
      const url = `https://ap1.replicon.com/${company}/services/${serviceName}.svc/GetData`;
      const payload = { page: 1, pagesize: 10000, columnUris: [columnUri], sort: [], filterExpression: null };
      try {
        const data = await wcfRequest(`Dict: ${dictName}`, url, payload, headers);
        const rows = data.d?.rows || data.rows || [];
        return rows.map(r => {
          const cell = r.cells?.[0];
          return cell?.textValue && cell?.uri ? { name: cell.textValue, uri: cell.uri } : null;
        }).filter(Boolean);
      } catch { return []; }
    };

    const fetchPolicyData = async (dictName, serviceName, methodName, searchKey) => {
      const url = `https://ap1.replicon.com/${company}/services/${serviceName}.svc/${methodName}`;
      const payload = { pageIndex: '1', pageSize: '1000', policyUri: 'urn:replicon:policy:project-management' };
      if (searchKey) {
        payload[searchKey] = searchKey === 'departmentGroupSearch' ? {
          statusOptionUri: 'urn:replicon:department-group-status-option:include-only-enabled-department-groups',
          hierarchyDataOptionUri: null, textSearch: null,
        } : null;
      }
      try {
        const data = await wcfRequest(`Policy: ${dictName}`, url, payload, headers);
        const items = data.d || data || [];
        const parsed = [];
        items.forEach(item => {
          let target = item;
          Object.values(item).forEach(val => { if (val?.displayText && val?.uri) target = val; });
          if (target?.displayText && target?.uri) parsed.push({ name: target.displayText, uri: target.uri });
        });
        if (dictName === 'Departments' && parsed.length > 0) parsed.shift();
        return parsed;
      } catch { return []; }
    };

    const dictionaries = {
      clients: [], programs: [], locations: [], departments: [], employeeTypes: [],
      users: [], projectManagers: [], accountManagers: [],
    };

    logger.info({ user: req.user.name }, 'Dashboard fetch started');

    [dictionaries.clients, dictionaries.programs] = await Promise.all([
      fetchListData('Clients',  'ClientListService1',  'urn:replicon:client-list-column:client'),
      fetchListData('Programs', 'ProgramListService1', 'urn:replicon:program-list-column:program'),
    ]);
    [dictionaries.locations, dictionaries.departments, dictionaries.employeeTypes] = await Promise.all([
      fetchPolicyData('Locations',      'LocationService1',         'GetPageOfLocationsInPolicyDataAccessScope',          'locationSearch'),
      fetchPolicyData('Departments',    'DepartmentGroupService1',  'GetPageOfDepartmentGroupsInPolicyDataAccessScope',   'departmentGroupSearch'),
      fetchPolicyData('EmployeeTypes',  'EmployeeTypeGroupService1','GetPageOfEmployeeTypeGroupsInPolicyDataAccessScope', 'employeeTypeGroupSearch'),
    ]);

    try {
      const amData = await wcfRequest('Account Managers', `https://ap1.replicon.com/${company}/services/CustomFieldService1.svc/GetEnabledCustomFieldDropDownOptions`, {
        customFieldUri: 'urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:fc1a8ce8-7e33-4683-bdd3-c08387b82b58',
      }, headers);
      dictionaries.accountManagers = (amData.d || amData || []).map(opt => ({ name: opt.displayText, uri: opt.uri }));
    } catch { dictionaries.accountManagers = []; }

    const allUsers = await fetchListData('Users', 'UserListService1', 'urn:replicon:user-list-column:user');
    dictionaries.users = allUsers;
    dictionaries.projectManagers = allUsers.filter(u => {
      const n = u.name.toLowerCase();
      return n.includes('ziad shafik') || n.includes('irfan najmi');
    });

    send('dictionaries', dictionaries);

    // --- Reports (streamed as each arrives) ---
    const parseReport = async (reportUri, headerKeyword, buildRow) => {
      const payload = { reportUri: `urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:${reportUri}`, filterValues: [], outputFormatUri: 'urn:replicon:report-output-format-option:csv' };
      const res2 = await axios.post(reportEndpoint, payload, { headers });
      const csvStr = res2.data.d?.payload || res2.data.payload || '';
      if (!csvStr) return [];
      const lines   = csvStr.split(/\r?\n/);
      const hIdx    = lines.findIndex(l => l.toLowerCase().includes(headerKeyword.toLowerCase()));
      if (hIdx === -1) return [];
      const cols    = parseCSVLine(lines[hIdx]);
      const getIdx  = (s) => cols.findIndex(h => h.toLowerCase().includes(s.toLowerCase()));
      const rows    = [];
      for (let j = hIdx + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (!line || line.startsWith('Full Summary')) continue;
        const row = buildRow(parseCSVLine(line), getIdx);
        if (row) rows.push(row);
      }
      return rows;
    };

    const [roster, drafts, cube, timesheets] = await Promise.all([
      parseReport('3f1148e3-624f-4666-ba25-6a0432a883ee', 'user name', (c, g) => ({
        name: c[g('user name')] || 'Unknown', start: parseDateToTimestamp(c[g('start date')]),
        end: parseDateToTimestamp(c[g('end date')]), status: c[g('status')] || 'Disabled',
      })).catch(() => []),

      parseReport('523be039-0435-402a-b1ba-fc7fc5810bb1', 'user name', (c, g) => {
        const idxName = g('user name'), idxDate = g('date'), idxHours = Math.max(g('actual work hours'), g('hours'));
        if (!c[idxName] || !c[idxDate]) return null;
        return { user: c[idxName], date: parseDateToTimestamp(c[idxDate]), act: parseNumber(c[idxHours]) };
      }).catch(() => []),

      parseReport('c4dc8459-d888-4db8-af86-051e965912b3', 'entry date', (c, g) => {
        const pName = c[g('project name')];
        if (!pName || pName === '' || pName.toLowerCase() === '< none >') return null;
        return {
          dateStr: c[g('entry date')], timestamp: parseDateToTimestamp(c[g('entry date')]),
          user: c[g('user name')], client: c[g('client name')], project: pName,
          program: c[g('program name')] || 'Unassigned', location: c[g('location')],
          status: g('project status') > -1 ? c[g('project status')] : 'Unknown',
          act: parseNumber(c[g('hours')]), est: parseNumber(c[g('estimated hrs')]), quoted: parseNumber(c[g('quoted hours')]),
        };
      }).catch(() => []),

      parseReport('759875bf-264a-4aef-8a44-26649c81ae65', 'timesheet uri', (c, g) => {
        const idxUri    = g('timesheet uri');
        const idxHours  = Math.max(g('total hrs (in period)'), g('total hrs'));
        if (!c[idxUri] || !c[g('user name')] || !c[g('timesheet period')]) return null;
        return { period: c[g('timesheet period')], user: c[g('user name')], status: c[g('approval status')] || c[g('submission status')], uri: c[idxUri], hours: parseNumber(c[idxHours]) };
      }).catch(() => []),
    ]);

    send('roster',      roster);
    send('drafts',      drafts);
    send('cube',        cube);
    send('timesheets',  timesheets);
    send('complete',    { dictionaries });
    res.end();

    logger.info({ user: req.user.name, cubeRows: cube.length, rosterRows: roster.length }, 'Dashboard fetch complete');
  } catch (err) {
    logger.error({ err, user: req.user?.name }, 'Dashboard fetch failed');
    sendError('Failed to fetch live data: ' + err.message);
  }
});

// /api/dashboard legacy — frontend now uses /api/v1/dashboard via streaming fetch

// ============================================================================
// 4.5 ZOD SCHEMA — Project creation validation
// ============================================================================
const projectSchema = z.object({
  projectName:      z.string().min(1).max(200),
  projectCode:      z.string().min(1).max(50),
  status:           z.string().optional(),
  percentCompleted: z.union([z.string(), z.number()]).optional(),
  startDate:        z.string().optional(),
  endDate:          z.string().optional(),
  clientMode:       z.enum(['existing', 'new']).optional(),
  clientName:       z.string().max(200).optional(),
  clientUri:        z.string().optional(),
  programUri:       z.string().optional(),
  pmUri:            z.string().optional(),
  departmentUri:    z.string().optional(),
  locationUri:      z.string().optional(),
  employeeTypeUri:  z.string().optional(),
  allowTimeEntry:   z.string().optional(),
  quotedHours:      z.union([z.string(), z.number()]).optional(),
  tasks:            z.array(z.object({
    name:          z.string().min(1).max(500),
    outlineLevel:  z.number().optional(),
    start:         z.string().optional(),
    end:           z.string().optional(),
    roundedHours:  z.number().optional(),
    isMilestone:   z.boolean().optional(),
    assignedUsers: z.array(z.string()).optional(),
  })).optional().default([]),
}).passthrough();

// ============================================================================
// STREAMING PROJECT CREATION
// ============================================================================
app.post('/api/v1/projects', requireAuth, async (req, res) => {
  const parse = projectSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parse.error.issues });
  }
  const payload = parse.data;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');

  const token   = (process.env.REPLICON_TOKEN   || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  if (!token || !company) {
    res.write(JSON.stringify({ status: 'error', error: 'Server configuration error.' }) + '\n');
    return res.end();
  }

  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };

  const parseDateForReplicon = (dateStr) => {
    if (!dateStr) return undefined;
    const parts = dateStr.split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
  };

  const getStatusUri = (s) => ({
    'Planning':    'urn:replicon:project-status-type:tentative',
    'In Progress': 'urn:replicon:project-status-type:in-progress',
    'Completed':   'urn:replicon:project-status-type:completed',
    'Archived':    'urn:replicon:project-status-type:archived',
  }[s] || 'urn:replicon:project-status:tentative');

  try {
    let activeClientUri = payload.clientUri;

    if (payload.clientMode === 'new' && payload.clientName) {
      res.write(JSON.stringify({ step: 'client' }) + '\n');
      let clientDraftRes = await wcfRequest('Create Client Draft', `https://ap1.replicon.com/${company}/services/ClientService1.svc/CreateNewDraft`, {}, headers);
      let clientDraftUri = clientDraftRes.Value || clientDraftRes.d || clientDraftRes.uri;
      await wcfRequest('Update Client Name', `https://ap1.replicon.com/${company}/services/ClientService1.svc/UpdateName`, { clientUri: clientDraftUri, name: payload.clientName }, headers);
      if (payload.accountManagerUri) {
        await wcfRequest('Update AM', `https://ap1.replicon.com/${company}/services/CustomFieldService1.svc/UpdateDropdownValue`, {
          objectUri: clientDraftUri,
          customFieldUri: 'urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:fc1a8ce8-7e33-4683-bdd3-c08387b82b58',
          customFieldDropDownOptionUri: payload.accountManagerUri,
        }, headers);
      }
      let clientPubRes = await wcfRequest('Publish Client', `https://ap1.replicon.com/${company}/services/ClientService1.svc/PublishDraft`, { draftUri: clientDraftUri }, headers);
      activeClientUri = clientPubRes.Value || clientPubRes.d || clientPubRes.uri;
    }

    if (!activeClientUri) throw new Error('Pipeline aborted: Client URI missing.');

    res.write(JSON.stringify({ step: 'project' }) + '\n');
    let projDraftRes = await wcfRequest('Create Project Draft', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/CreateNewDraft`, {}, headers);
    let projDraftUri = projDraftRes.Value || projDraftRes.d || projDraftRes.uri;

    await wcfRequest('Update Name',    `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateName`,    { projectUri: projDraftUri, name: payload.projectName }, headers);
    await wcfRequest('Update Code',    `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateCode`,    { projectUri: projDraftUri, code: payload.projectCode }, headers);
    await wcfRequest('Update Pct',     `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdatePercentComplete`, { projectUri: projDraftUri, code: payload.percentCompleted }, headers);

    if (payload.startDate || payload.endDate) {
      await wcfRequest('Update Dates', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateTimeEntryDateRange`, {
        projectUri: projDraftUri, dateRange: { startDate: parseDateForReplicon(payload.startDate), endDate: parseDateForReplicon(payload.endDate) },
      }, headers);
    }

    const nullObj = (uri) => ({ uri, parent: null, name: null, parameterCorrelationId: null });
    if (payload.departmentUri)   await wcfRequest('Update Dept',  `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateDepartmentGroup2`,  { projectUri: projDraftUri, departmentGroup:   nullObj(payload.departmentUri) },  headers);
    if (payload.employeeTypeUri) await wcfRequest('Update EType', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateEmployeeTypeGroup2`, { projectUri: projDraftUri, employeeTypeGroup: nullObj(payload.employeeTypeUri) }, headers);
    if (payload.locationUri)     await wcfRequest('Update Loc',   `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateLocation`,           { projectUri: projDraftUri, location: { uri: payload.locationUri, parentUri: null, name: null } }, headers);

    await wcfRequest('Allow Time Entry', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateAllowTimeEntryAgainstTasksOnly`, { projectUri: projDraftUri, allowTimeEntryAgainstTasksOnly: payload.allowTimeEntry === 'Yes' }, headers);

    const safeClientUri = typeof activeClientUri === 'object' ? activeClientUri.uri : activeClientUri;
    await wcfRequest('Update Clients', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateClients`, {
      projectUri: projDraftUri,
      clients: [{ client: { uri: safeClientUri, name: null, code: null, parameterCorrelationId: null }, costAllocationPercentage: '100.0' }],
    }, headers);

    if (payload.programUri) await wcfRequest('Update Program', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateProgram`,       { projectUri: projDraftUri, programUri: payload.programUri }, headers);
    if (payload.pmUri)      await wcfRequest('Update PM',      `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateProjectLeader`, { projectUri: projDraftUri, userUri: payload.pmUri }, headers);

    await wcfRequest('Update Status', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateStatus`, { projectUri: projDraftUri, projectStatusUri: getStatusUri(payload.status) }, headers);

    let projPubRes       = await wcfRequest('Publish Project', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/PublishDraft`, { draftUri: projDraftUri }, headers);
    let finalProjectUri  = projPubRes.Value || projPubRes.d || projPubRes.uri;
    const safeProjectUri = typeof finalProjectUri === 'object' ? finalProjectUri.uri : finalProjectUri;

    const tasks = payload.tasks || [];
    let successfulTasks = 0; let capturedTasks = []; let levelUriMap = {};

    if (safeProjectUri && tasks.length > 0) {
      res.write(JSON.stringify({ step: 'tasks', current: 0, total: tasks.length }) + '\n');
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]; const level = t.outlineLevel || 1;
        let parentUri = (level > 1 && levelUriMap[level - 1]) ? levelUriMap[level - 1] : null;
        const targetBlock = { uri: null, name: t.name, ...(parentUri ? { parent: { uri: parentUri } } : {}) };
        const taskPayload = {
          project: { uri: safeProjectUri },
          task: {
            target: targetBlock, name: t.name, code: '', description: '',
            timeEntryDateRange: { startDate: parseDateForReplicon(t.start), endDate: parseDateForReplicon(t.end) },
            percentCompleted: 0, isTimeEntryAllowed: !t.isMilestone, isClosed: false,
            estimatedHours: t.roundedHours > 0 ? { hours: t.roundedHours, minutes: 0, seconds: 0 } : null,
            customFieldValues: [
              { customField: { uri: 'urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:ff2f15e9-8238-4691-89ee-53d780cd899a' }, number: 0 },
              { customField: { uri: 'urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:45c59ea2-2ceb-496a-8544-c836cbcac626' }, number: null },
              { customField: { uri: 'urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:ad68d557-6779-4adc-8925-a25c403f8504' }, text: 'Unlimited' },
            ],
            estimatedCost: { amount: 0, currency: { uri: 'urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:currency:8' } },
            timeAndExpenseEntryTypeUri: 'urn:replicon:time-and-expense-entry-type:billable-and-non-billable',
          },
          unitOfWorkId: `batch_${Date.now()}_${i}`,
        };
        try {
          let taskRes = await wcfRequest(`Add Task ${i + 1}/${tasks.length}`, `https://ap1.replicon.com/${company}/services/ProjectService1.svc/AddTask`, taskPayload, headers);
          successfulTasks++;
          let newTaskUri = taskRes.Value || taskRes.d || taskRes.uri;
          while (newTaskUri && typeof newTaskUri === 'object') newTaskUri = newTaskUri.uri || newTaskUri.Value || newTaskUri.d;
          if (newTaskUri) levelUriMap[level] = newTaskUri;
          if (newTaskUri && t.assignedUsers?.length) capturedTasks.push({ taskUri: newTaskUri, assignedUris: t.assignedUsers });
          res.write(JSON.stringify({ step: 'tasks', current: i + 1, total: tasks.length }) + '\n');
        } catch { logger.warn(`Task ${i + 1} skipped due to error`); }
      }
    }

    const uniqueUsers = new Set(); let totalAssign = 0;
    capturedTasks.forEach(ct => { ct.assignedUris.forEach(u => uniqueUsers.add(u)); totalAssign += ct.assignedUris.length; });
    res.write(JSON.stringify({ step: 'resources', current: 0, total: totalAssign }) + '\n');

    for (const userUri of uniqueUsers) {
      try { await wcfRequest('Assign to Project', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/AssignResourceToProject`, { projectUri: safeProjectUri, resourceUri: userUri, resourceToReplaceUri: null }, headers); } catch { }
    }

    let completedAssign = 0;
    for (let i = 0; i < capturedTasks.length; i++) {
      const ct = capturedTasks[i];
      try {
        await wcfRequest(`Assign Users Task ${i + 1}`, `https://ap1.replicon.com/${company}/services/TaskService1.svc/BulkUpdateResourceAssignments`, { taskUri: ct.taskUri, resourceUris: ct.assignedUris, isAssigned: true }, headers);
        completedAssign += ct.assignedUris.length;
        res.write(JSON.stringify({ step: 'resources', current: completedAssign, total: totalAssign }) + '\n');
      } catch { logger.warn(`Task assignment failed for ${ct.taskUri}`); }
    }

    res.write(JSON.stringify({ step: 'finalizing' }) + '\n');
    auditLog(req.user.name, 'PROJECT_CREATED', { project: payload.projectName, code: payload.projectCode, tasks: successfulTasks });
    res.write(JSON.stringify({ status: 'success', message: `Project ${payload.projectCode} created with ${successfulTasks} tasks.`, projectUri: safeProjectUri }) + '\n');
    res.end();
  } catch (err) {
    logger.error({ err, user: req.user?.name }, 'Project creation failed');
    res.write(JSON.stringify({ status: 'error', error: err.message || 'Project creation failed.' }) + '\n');
    res.end();
  }
});

// Backward-compat alias — just note it; SmartInitiator.jsx now calls /api/v1/projects directly

// ============================================================================
// TIMESHEET ACTIONS (4.9 Audit Logging — was missing in original!)
// ============================================================================
app.post('/api/v1/timesheets/action', requireAuth, async (req, res) => {
  const { action, uris } = req.body || {};
  if (!action || !Array.isArray(uris) || uris.length === 0) {
    return res.status(400).json({ error: 'action and uris[] are required.' });
  }
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "reject".' });
  }

  const token   = (process.env.REPLICON_TOKEN   || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };

  const methodName = action === 'approve' ? 'ApproveTimesheets' : 'RejectTimesheets';

  try {
    await wcfRequest(
      `Timesheet ${action}`,
      `https://ap1.replicon.com/${company}/services/TimesheetService1.svc/${methodName}`,
      { timesheetUris: uris },
      headers,
    );
    auditLog(req.user.name, `TIMESHEETS_${action.toUpperCase()}`, { count: uris.length });
    logger.info({ user: req.user.name, action, count: uris.length }, 'Timesheet bulk action');
    res.json({ message: `Successfully ${action}d ${uris.length} timesheet(s).` });
  } catch (err) {
    logger.error({ err, action, user: req.user?.name }, 'Timesheet action failed');
    res.status(500).json({ error: err.message || 'Timesheet action failed.' });
  }
});

// Backward-compat alias for timesheets
app.post('/api/timesheets/action', async (req, res) => {
  const { action, uris } = req.body || {};
  if (!action || !Array.isArray(uris) || uris.length === 0) return res.status(400).json({ error: 'action and uris[] are required.' });
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be "approve" or "reject".' });
  const token = (process.env.REPLICON_TOKEN || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
  const method = action === 'approve' ? 'ApproveTimesheets' : 'RejectTimesheets';
  try {
    await wcfRequest(`Timesheet ${action} (compat)`, `https://ap1.replicon.com/${company}/services/TimesheetService1.svc/${method}`, { timesheetUris: uris }, headers);
    auditLog(req.user.name, `TIMESHEETS_${action.toUpperCase()}_COMPAT`, { count: uris.length });
    res.json({ message: `Successfully ${action}d ${uris.length} timesheet(s).` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// HELPERS — replicon headers + UUID
// ============================================================================
function repliconHeaders() {
  return { Authorization: `Bearer ${(process.env.REPLICON_TOKEN||'').trim()}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
}
function repliconBase() { return `https://ap1.replicon.com/${(process.env.REPLICON_COMPANY||'').trim()}/services`; }
function newUUID() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'); }

// ============================================================================
// PROJECTS — search, details, edit
// ============================================================================

// GET /api/v1/projects/search — returns [{uri, name}] for all non-archived projects
app.get('/api/v1/projects/search', requireAuth, async (req, res) => {
  try {
    const data = await wcfRequest('Project Search',
      `${repliconBase()}/ProjectListService1.svc/GetData`,
      { page: 1, pagesize: 1000, columnUris: ['urn:replicon:project-list-column:project'], sort: [], filterExpression: null },
      repliconHeaders());
    const rows = data.d?.rows || data.rows || [];
    const projects = rows.map(r => ({ uri: r.cells?.[0]?.uri, name: r.cells?.[0]?.textValue })).filter(p => p.uri && p.name);
    res.json({ projects });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/v1/projects/details — { projectUri } → full project details
app.post('/api/v1/projects/details', requireAuth, async (req, res) => {
  const { projectUri } = req.body || {};
  if (!projectUri) return res.status(400).json({ error: 'projectUri required' });
  try {
    const data = await wcfRequest('Project Details',
      `${repliconBase()}/ProjectService1.svc/BulkGetProjectDetails3`,
      { projects: [{ uri: projectUri }] }, repliconHeaders());
    const detail = (data.d || data)[0] || null;
    res.json({ detail });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/v1/projects/edit — edit existing project
app.post('/api/v1/projects/edit', requireAuth, async (req, res) => {
  const { projectUri, modifications } = req.body || {};
  if (!projectUri || !modifications) return res.status(400).json({ error: 'projectUri + modifications required' });
  try {
    const result = await wcfRequest('Edit Project',
      `${repliconBase()}/ProjectService1.svc/CreateProjectOrApplyModifications`,
      { target: { uri: projectUri }, modifications, unitOfWorkId: newUUID() },
      repliconHeaders());
    auditLog(req.user.name, 'PROJECT_EDITED', { projectUri });
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Project edit failed');
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CLIENTS — search, details, create, edit
// ============================================================================

// GET /api/v1/clients/search — returns [{uri, name}] for all clients
app.get('/api/v1/clients/search', requireAuth, async (req, res) => {
  try {
    const data = await wcfRequest('Client Search',
      `${repliconBase()}/ClientListService1.svc/GetData`,
      { page: 1, pagesize: 1000, columnUris: ['urn:replicon:client-list-column:client'], sort: [], filterExpression: null },
      repliconHeaders());
    const rows = data.d?.rows || data.rows || [];
    const clients = rows.map(r => ({ uri: r.cells?.[0]?.uri, name: r.cells?.[0]?.textValue })).filter(c => c.uri && c.name);
    res.json({ clients });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/v1/clients/details — { clientUri } → full client details
app.post('/api/v1/clients/details', requireAuth, async (req, res) => {
  const { clientUri } = req.body || {};
  if (!clientUri) return res.status(400).json({ error: 'clientUri required' });
  try {
    const data = await wcfRequest('Client Details',
      `${repliconBase()}/ClientService1.svc/BulkGetClientDetails`,
      { clientUris: [clientUri] }, repliconHeaders());
    const detail = (data.d || data)[0] || null;
    res.json({ detail });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/v1/clients/create — create new client
app.post('/api/v1/clients/create', requireAuth, async (req, res) => {
  const { name, code, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Client name required' });
  try {
    const modifications = {
      nameToApply:        { value: name },
      ...(code        ? { codeToApply:        { value: code }        } : {}),
      ...(description ? { descriptionToApply: { value: description } } : {}),
      statusToApply: true,
    };
    const result = await wcfRequest('Create Client',
      `${repliconBase()}/ClientService1.svc/CreateClientOrApplyModifications`,
      { modifications, clientModificationOptionUri: 'urn:replicon:client-modification-option:save', unitOfWorkId: newUUID() },
      repliconHeaders());
    auditLog(req.user.name, 'CLIENT_CREATED', { name });
    res.json({ success: true, clientUri: result?.d?.uri || result?.d || result });
  } catch (err) {
    logger.error({ err }, 'Client create failed');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/clients/edit — edit existing client
app.post('/api/v1/clients/edit', requireAuth, async (req, res) => {
  const { clientUri, modifications } = req.body || {};
  if (!clientUri || !modifications) return res.status(400).json({ error: 'clientUri + modifications required' });
  try {
    const result = await wcfRequest('Edit Client',
      `${repliconBase()}/ClientService1.svc/CreateClientOrApplyModifications`,
      { target: { uri: clientUri }, modifications, clientModificationOptionUri: 'urn:replicon:client-modification-option:save', unitOfWorkId: newUUID() },
      repliconHeaders());
    auditLog(req.user.name, 'CLIENT_EDITED', { clientUri });
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Client edit failed');
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// AI CHAT — streaming conversational assistant with full workforce context
// ============================================================================
app.post('/api/v1/chat', requireAuth, async (req, res) => {
  const { message, history = [], context } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return res.status(503).json({ error: 'AI not configured. Add ANTHROPIC_API_KEY to .env.' });

  const dataCtx = context || readJSON(SUMMARY_FILE, {});
  const today   = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const company = (process.env.REPLICON_COMPANY || 'the company');

  const systemPrompt = `You are an AI workforce management assistant for ${company}, a professional services firm using Replicon for time tracking and project management.
Today is ${today}.

You have COMPLETE access to live workforce data. Answer ANY question the user asks — treat this exactly like Claude.ai but with full knowledge of the company's people, projects, clients, budgets, and compliance.

THINGS YOU CAN DO:
- Employee lookup: "Where is [name]?", "What is [name] working on?", "How many hours has [name] logged?"
- Availability: "Who has capacity for new work?", "Who is free next week?", "Who is underutilized?"
- Project status: "Tell me about project X", "What's the burn rate on Y?", "Which projects are over budget?"
- Forecasting: "When will project X run out of budget?", "At current burn, when does Y complete?" — show your math
- Compliance: "Who hasn't submitted timesheets?", "Who is missing daily/weekly entries?"
- Assignment recommendations: "Who should I assign to a new project?" — explain your reasoning with actual utilization %
- Client analysis: "What work are we doing for client X?", "Which clients generate the most revenue hours?"
- Risk identification: "Which projects are at risk?", "What should I watch out for?"
- Team health: "Give me a team summary", "How is overall utilization?", "Who is overloaded?"
- General conversation: comparisons, trends, what-ifs, follow-up questions — anything

HOW TO RESPOND:
- ALWAYS use real names, exact numbers, and project names from the data — never invent figures
- For forecasts: show the calculation (e.g. "burning 12h/week with 200h remaining = ~17 weeks to budget exhaustion")
- For recommendations: explain reasoning ("Sarah has 38% utilization vs expected ~100%, giving her clear capacity")
- Use **bold** for key names/numbers, bullet points for lists, headings for multi-section answers
- If data is insufficient to answer fully, say what you DO know and what additional data would help
- Match the user's tone — brief question = brief answer, detailed question = detailed answer
- Respond in the same language the user writes in

LIVE WORKFORCE DATA (as of ${today}):
${JSON.stringify(dataCtx, null, 2)}`;

  const messages = [
    ...history.filter(m => m.content).slice(-20).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Stream SSE to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-sonnet-4-6', max_tokens: 4096, stream: true, system: systemPrompt, messages },
      {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        responseType: 'stream',
        timeout: 90000,
      }
    );

    let buf = '';
    upstream.data.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          }
        } catch {}
      }
    });

    upstream.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
      logger.info({ user: req.user.name, msgLen: message.length }, 'Chat stream completed');
    });

    upstream.data.on('error', (err) => {
      logger.error({ err: err.message }, 'Chat stream error');
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

  } catch (err) {
    logger.error({ err: err.message }, 'Chat API failed');
    const errMsg = err.response?.data?.error?.message || err.message;
    res.write(`data: ${JSON.stringify({ error: 'Claude request failed: ' + errMsg })}\n\n`);
    res.end();
  }
});

// ============================================================================
// AI INSIGHTS — persistent feedback, open-ended Claude, auto-generation
// ============================================================================

// ── File storage setup ──────────────────────────────────────────────────────
const DATA_DIR        = path.join(__dirname, 'data');
const FEEDBACK_FILE   = path.join(DATA_DIR, 'insights-feedback.json');
const CACHE_FILE      = path.join(DATA_DIR, 'insights-cache.json');
const SUMMARY_FILE    = path.join(DATA_DIR, 'insights-summary.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try { if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')); } catch { }
  return fallback;
}
function writeJSON(file, data) {
  try { writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) { logger.warn({ err: e.message }, 'writeJSON failed: ' + file); }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function buildFbCounts(feedback) {
  const counts = {};
  feedback.forEach(f => {
    counts[f.type] = counts[f.type] || { pos: 0, neg: 0 };
    f.helpful ? counts[f.type].pos++ : counts[f.type].neg++;
  });
  return counts;
}

async function callClaude(summary, feedback, apiKey) {
  const fbCounts    = buildFbCounts(feedback);
  const topPositive = Object.entries(fbCounts).filter(([,v])=>v.pos>v.neg).sort((a,b)=>b[1].pos-a[1].pos).slice(0,5).map(([t])=>t);
  const topNegative = Object.entries(fbCounts).filter(([,v])=>v.neg>v.pos).map(([t])=>t);

  const feedbackNote = topPositive.length
    ? `\nUser ratings history — surface MORE insights like: [${topPositive.join(', ')}]. Surface FEWER like: [${topNegative.join(', ')}].`
    : '';

  const prompt = `You are a workforce analytics AI for a professional services company using Replicon timesheet data.
Analyze the data summary below and return between 6 and 12 actionable insights — as many as the data genuinely supports.
Do NOT pad with trivial observations; only include insights that are specific, actionable, and non-obvious.
${feedbackNote}

Each insight object must follow this exact shape:
{
  "type": "<snake_case_identifier>",
  "title": "<short title, max 8 words>",
  "body": "<2 sentences max: what the data shows and what action to take>",
  "severity": "info" | "warning" | "critical" | "positive",
  "metric": { "label": "<metric name>", "value": "<formatted value>" },
  "chartSuggestion": "radialBar" | "donut" | "bar" | "line" | "pie" | "timeline"
}

Data Summary:
${JSON.stringify(summary, null, 2)}

Return ONLY a valid JSON array. No markdown, no explanation, no wrapping object.`;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    { model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] },
    { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: 30000 }
  );
  const text  = response.data?.content?.[0]?.text || '[]';
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  return JSON.parse(start > -1 ? text.slice(start, end + 1) : '[]');
}

// ── Auto-generation loop (every hour) ────────────────────────────────────────
async function autoGenerateInsights() {
  const apiKey   = (process.env.ANTHROPIC_API_KEY || '').trim();
  const summary  = readJSON(SUMMARY_FILE, null);
  if (!summary) return; // no data summary cached yet — wait for first login
  const feedback = readJSON(FEEDBACK_FILE, []);
  let insights, source;
  try {
    if (apiKey) {
      insights = await callClaude(summary, feedback, apiKey);
      source   = 'claude-auto';
    } else {
      insights = generateAlgorithmicInsights(summary, buildFbCounts(feedback));
      source   = 'algorithmic-auto';
    }
    writeJSON(CACHE_FILE, { insights, source, generatedAt: Date.now() });
    logger.info({ count: insights.length, source }, 'Auto-generated insights cached');
  } catch (e) {
    logger.warn({ err: e.message }, 'Auto-generate insights failed');
  }
}

// First run 60 s after startup (data summary may not exist yet), then every hour
setTimeout(autoGenerateInsights, 60_000);
setInterval(autoGenerateInsights, 60 * 60 * 1000);

// ── Endpoints ────────────────────────────────────────────────────────────────

// Frontend pushes data summary here whenever it loads fresh dashboard data
app.post('/api/v1/insights/cache-summary', requireAuth, (req, res) => {
  const { summary } = req.body || {};
  if (!summary) return res.status(400).json({ error: 'summary required' });
  writeJSON(SUMMARY_FILE, summary);
  res.json({ success: true });
});

// Return the last auto-generated (or manually generated) cached insights
app.get('/api/v1/insights/cached', requireAuth, (req, res) => {
  const cache = readJSON(CACHE_FILE, null);
  res.json(cache || { insights: [], source: null, generatedAt: null });
});

// Store feedback persistently
app.post('/api/v1/insights/feedback', requireAuth, (req, res) => {
  const { type, helpful } = req.body || {};
  if (!type || helpful === undefined) return res.status(400).json({ error: 'type + helpful required' });
  const feedback = readJSON(FEEDBACK_FILE, []);
  feedback.push({ type, helpful: !!helpful, ts: Date.now(), user: req.user.name });
  if (feedback.length > 1000) feedback.splice(0, feedback.length - 1000);
  writeJSON(FEEDBACK_FILE, feedback);
  res.json({ success: true });
});

// On-demand generation (manual "Generate Insights" click)
app.post('/api/v1/insights/generate', requireAuth, async (req, res) => {
  const { summary } = req.body || {};
  if (!summary) return res.status(400).json({ error: 'summary required' });

  // Always keep the summary cache fresh
  writeJSON(SUMMARY_FILE, summary);

  const apiKey   = (process.env.ANTHROPIC_API_KEY || '').trim();
  const feedback = readJSON(FEEDBACK_FILE, []);
  const fbCounts = buildFbCounts(feedback);

  if (!apiKey) {
    const insights = generateAlgorithmicInsights(summary, fbCounts);
    writeJSON(CACHE_FILE, { insights, source: 'algorithmic', generatedAt: Date.now() });
    return res.json({ insights, source: 'algorithmic', feedbackCount: feedback.length });
  }

  try {
    const insights = await callClaude(summary, feedback, apiKey);
    writeJSON(CACHE_FILE, { insights, source: 'claude', generatedAt: Date.now() });
    res.json({ insights, source: 'claude', feedbackCount: feedback.length });
  } catch (err) {
    logger.warn({ err: err.message }, 'Claude insights failed — falling back to algorithmic');
    const insights = generateAlgorithmicInsights(summary, fbCounts);
    writeJSON(CACHE_FILE, { insights, source: 'algorithmic', generatedAt: Date.now() });
    res.json({ insights, source: 'algorithmic', feedbackCount: feedback.length });
  }
});

function generateAlgorithmicInsights(s, fbCounts) {
  const insights = [];
  const boost = (type) => (fbCounts[type]?.pos || 0) - (fbCounts[type]?.neg || 0);

  const utilizationRate = s.totalCapacityHrs > 0 ? Math.round((s.actualHrs / s.totalCapacityHrs) * 100) : 0;
  insights.push({
    type: 'utilization',
    title: 'Team Utilization Rate',
    body: `Your team is operating at ${utilizationRate}% capacity this month. ${utilizationRate > 85 ? 'Risk of burnout — consider rebalancing workloads.' : utilizationRate < 60 ? 'Significant idle capacity — review project pipeline.' : 'Utilization is in the healthy 60–85% range.'}`,
    severity: utilizationRate > 90 ? 'critical' : utilizationRate < 60 ? 'warning' : 'positive',
    metric: { label: 'Utilization', value: `${utilizationRate}%` },
    chartSuggestion: 'radialBar',
    _boost: boost('utilization'),
  });

  if (s.billableHrs != null) {
    const billRatio = s.actualHrs > 0 ? Math.round((s.billableHrs / s.actualHrs) * 100) : 0;
    insights.push({
      type: 'billable_ratio',
      title: 'Billable vs Non-Billable Split',
      body: `${billRatio}% of logged hours are billable. ${billRatio < 70 ? 'Internal overhead is high — investigate internal project allocation.' : 'Billable ratio is strong.'}`,
      severity: billRatio < 70 ? 'warning' : 'positive',
      metric: { label: 'Billable %', value: `${billRatio}%` },
      chartSuggestion: 'donut',
      _boost: boost('billable_ratio'),
    });
  }

  if (s.atRiskProjects?.length > 0) {
    const worst = s.atRiskProjects[0];
    insights.push({
      type: 'budget_risk',
      title: 'Budget Overrun Alert',
      body: `${s.atRiskProjects.length} project(s) exceed their hour budget. "${worst.name}" is at ${worst.burn}% burn — immediate review recommended.`,
      severity: 'critical',
      metric: { label: 'Over-budget', value: `${s.atRiskProjects.length} projects` },
      chartSuggestion: 'bar',
      _boost: boost('budget_risk'),
    });
  }

  if (s.complianceDailyDeficits != null) {
    insights.push({
      type: 'compliance',
      title: 'Timesheet Compliance',
      body: `${s.complianceDailyDeficits} daily deficits detected. ${s.complianceDailyDeficits > 5 ? 'Compliance is a concern — send reminders to affected engineers.' : 'Compliance is tracking well.'}`,
      severity: s.complianceDailyDeficits > 5 ? 'warning' : 'positive',
      metric: { label: 'Daily deficits', value: String(s.complianceDailyDeficits) },
      chartSuggestion: 'line',
      _boost: boost('compliance'),
    });
  }

  if (s.topClients?.length > 0) {
    const top = s.topClients[0];
    const concentration = s.actualHrs > 0 ? Math.round((top.val / s.actualHrs) * 100) : 0;
    insights.push({
      type: 'client_concentration',
      title: 'Client Revenue Concentration',
      body: `"${top.name}" represents ${concentration}% of total hours. ${concentration > 40 ? 'High dependency on a single client — diversification risk.' : 'Client portfolio is well-diversified.'}`,
      severity: concentration > 40 ? 'warning' : 'info',
      metric: { label: 'Top client share', value: `${concentration}%` },
      chartSuggestion: 'pie',
      _boost: boost('client_concentration'),
    });
  }

  if (s.rolloffs?.length > 0) {
    const soonest = s.rolloffs[0];
    const daysLeft = Math.round((soonest.end - Date.now()) / 86400000);
    insights.push({
      type: 'rolloffs',
      title: 'Upcoming Resource Roll-offs',
      body: `${s.rolloffs.length} project(s) have engineers rolling off soon. "${soonest.name}" ends in ~${daysLeft} days — plan redeployment now.`,
      severity: daysLeft < 14 ? 'critical' : 'warning',
      metric: { label: 'Upcoming roll-offs', value: `${s.rolloffs.length}` },
      chartSuggestion: 'timeline',
      _boost: boost('rolloffs'),
    });
  }

  // Sort by feedback boost, then severity weight — no hard cap
  const sevW = { critical: 3, warning: 2, info: 1, positive: 0 };
  return insights.sort((a, b) => (b._boost || 0) - (a._boost || 0) || (sevW[b.severity] || 0) - (sevW[a.severity] || 0))
    .map(({ _boost, ...i }) => i);
}

// ============================================================================
// STATIC + SPA FALLBACK
// ============================================================================
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => logger.info({ port: PORT }, `Server running on port ${PORT}`));
