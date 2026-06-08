import { Router }    from 'express';
import { requireAuth }                 from '../lib/auth.js';
import { logger, auditLog, newUUID }   from '../lib/helpers.js';
import { repliconHeaders, repliconBase, wcfRequest } from '../lib/replicon.js';

const router = Router();

router.post('/api/v1/timesheets/action', requireAuth, async (req, res) => {
  const { action, uris } = req.body || {};
  if (!action || !Array.isArray(uris) || uris.length === 0) return res.status(400).json({ error: 'action and uris[] are required.' });
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be "approve" or "reject".' });

  const token   = (process.env.REPLICON_TOKEN   || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
  const methodName = action === 'approve' ? 'ApproveTimesheets' : 'RejectTimesheets';

  try {
    await wcfRequest(`Timesheet ${action}`, `https://ap1.replicon.com/${company}/services/TimesheetService1.svc/${methodName}`, { timesheetUris: uris }, headers);
    auditLog(req.user.name, `TIMESHEETS_${action.toUpperCase()}`, { count: uris.length });
    res.json({ message: `Successfully ${action}d ${uris.length} timesheet(s).` });
  } catch (err) {
    logger.error({ err, action, user: req.user?.name }, 'Timesheet action failed');
    res.status(500).json({ error: err.message || 'Timesheet action failed.' });
  }
});

router.post('/api/timesheets/action', requireAuth, async (req, res) => {
  const { action, uris } = req.body || {};
  if (!action || !Array.isArray(uris) || uris.length === 0) return res.status(400).json({ error: 'action and uris[] are required.' });
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be "approve" or "reject".' });
  const token = (process.env.REPLICON_TOKEN || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
  const method  = action === 'approve' ? 'ApproveTimesheets' : 'RejectTimesheets';
  try {
    await wcfRequest(`Timesheet ${action} (compat)`, `https://ap1.replicon.com/${company}/services/TimesheetService1.svc/${method}`, { timesheetUris: uris }, headers);
    res.json({ message: `Successfully ${action}d ${uris.length} timesheet(s).` });
  } catch (err) {
    logger.error({ err, action, user: req.user?.name }, 'Timesheet action (compat) failed');
    res.status(500).json({ error: err?.message || 'Timesheet action failed.' });
  }
});

router.get('/api/v1/clients/search', requireAuth, async (req, res) => {
  try {
    const data = await wcfRequest('Client Search', `${repliconBase()}/ClientListService1.svc/GetData`, { page: 1, pagesize: 1000, columnUris: ['urn:replicon:client-list-column:client'], sort: [], filterExpression: null }, repliconHeaders());
    const rows    = data.d?.rows || data.rows || [];
    const clients = rows.map(r => ({ uri: r.cells?.[0]?.uri, name: r.cells?.[0]?.textValue })).filter(c => c.uri && c.name);
    res.json({ clients });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/v1/clients/details', requireAuth, async (req, res) => {
  const { clientUri } = req.body || {};
  if (!clientUri) return res.status(400).json({ error: 'clientUri required' });
  try {
    const data   = await wcfRequest('Client Details', `${repliconBase()}/ClientService1.svc/BulkGetClientDetails`, { clientUris: [clientUri] }, repliconHeaders());
    const detail = (data.d || data)[0] || null;
    res.json({ detail });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/v1/clients/create', requireAuth, async (req, res) => {
  const { name, code, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Client name required' });
  try {
    const modifications = {
      nameToApply: { value: name },
      ...(code        ? { codeToApply:        { value: code }        } : {}),
      ...(description ? { descriptionToApply: { value: description } } : {}),
      statusToApply: true,
    };
    const result = await wcfRequest('Create Client', `${repliconBase()}/ClientService1.svc/CreateClientOrApplyModifications`, { modifications, clientModificationOptionUri: 'urn:replicon:client-modification-option:save', unitOfWorkId: newUUID() }, repliconHeaders());
    auditLog(req.user.name, 'CLIENT_CREATED', { name });
    res.json({ success: true, clientUri: result?.d?.uri || result?.d || result });
  } catch (err) {
    logger.error({ err }, 'Client create failed');
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/v1/clients/edit', requireAuth, async (req, res) => {
  const { clientUri, modifications } = req.body || {};
  if (!clientUri || !modifications) return res.status(400).json({ error: 'clientUri + modifications required' });
  try {
    const result = await wcfRequest('Edit Client', `${repliconBase()}/ClientService1.svc/CreateClientOrApplyModifications`, { target: { uri: clientUri }, modifications, clientModificationOptionUri: 'urn:replicon:client-modification-option:save', unitOfWorkId: newUUID() }, repliconHeaders());
    auditLog(req.user.name, 'CLIENT_EDITED', { clientUri });
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Client edit failed');
    res.status(500).json({ error: err.message });
  }
});

export default router;
