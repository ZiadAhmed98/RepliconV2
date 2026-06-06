import { Router }  from 'express';
import { z }       from 'zod';
import { requireAuth }                      from '../lib/auth.js';
import { logger, auditLog, newUUID }        from '../lib/helpers.js';
import { repliconHeaders, repliconBase,
         wcfRequest }                       from '../lib/replicon.js';

const router = Router();

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

router.post('/api/v1/projects', requireAuth, async (req, res) => {
  const parse = projectSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Validation failed', issues: parse.error.issues });
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

    await wcfRequest('Update Name',  `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateName`,    { projectUri: projDraftUri, name: payload.projectName }, headers);
    await wcfRequest('Update Code',  `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateCode`,    { projectUri: projDraftUri, code: payload.projectCode }, headers);
    await wcfRequest('Update Pct',   `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdatePercentComplete`, { projectUri: projDraftUri, code: payload.percentCompleted }, headers);

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

    let projPubRes      = await wcfRequest('Publish Project', `https://ap1.replicon.com/${company}/services/ProjectService1.svc/PublishDraft`, { draftUri: projDraftUri }, headers);
    let finalProjectUri = projPubRes.Value || projPubRes.d || projPubRes.uri;
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

router.get('/api/v1/projects/search', requireAuth, async (req, res) => {
  try {
    const data = await wcfRequest('Project Search',
      `${repliconBase()}/ProjectListService1.svc/GetData`,
      { page: 1, pagesize: 1000, columnUris: ['urn:replicon:project-list-column:project'], sort: [], filterExpression: null },
      repliconHeaders());
    const rows     = data.d?.rows || data.rows || [];
    const projects = rows.map(r => ({ uri: r.cells?.[0]?.uri, name: r.cells?.[0]?.textValue })).filter(p => p.uri && p.name);
    res.json({ projects });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/v1/projects/details', requireAuth, async (req, res) => {
  const { projectUri } = req.body || {};
  if (!projectUri) return res.status(400).json({ error: 'projectUri required' });
  try {
    const data   = await wcfRequest('Project Details', `${repliconBase()}/ProjectService1.svc/BulkGetProjectDetails3`, { projects: [{ uri: projectUri }] }, repliconHeaders());
    const detail = (data.d || data)[0] || null;
    res.json({ detail });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/v1/projects/edit', requireAuth, async (req, res) => {
  const { projectUri, modifications } = req.body || {};
  if (!projectUri || !modifications) return res.status(400).json({ error: 'projectUri + modifications required' });
  try {
    const result = await wcfRequest('Edit Project', `${repliconBase()}/ProjectService1.svc/CreateProjectOrApplyModifications`, { target: { uri: projectUri }, modifications, unitOfWorkId: newUUID() }, repliconHeaders());
    auditLog(req.user.name, 'PROJECT_EDITED', { projectUri });
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Project edit failed');
    res.status(500).json({ error: err.message });
  }
});

export default router;
