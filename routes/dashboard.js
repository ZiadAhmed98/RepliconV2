import { Router }    from 'express';
import axios          from 'axios';
import { requireAuth }                               from '../lib/auth.js';
import { logger, parseCSVLine, parseNumber,
         parseDateToTimestamp }                      from '../lib/helpers.js';
import { wcfRequest }                               from '../lib/replicon.js';

const router = Router();

router.get('/api/v1/dashboard', requireAuth, async (req, res) => {
  const token   = (process.env.REPLICON_TOKEN   || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  const headers = { Authorization: `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
  const reportEndpoint = `https://ap1.replicon.com/${company}/services/ReportService1.svc/GenerateReport`;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send      = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  const sendError = (msg) => { res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`); res.end(); };

  try {
    const fetchListData = async (dictName, serviceName, columnUri) => {
      const url     = `https://ap1.replicon.com/${company}/services/${serviceName}.svc/GetData`;
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
      const url     = `https://ap1.replicon.com/${company}/services/${serviceName}.svc/${methodName}`;
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
      fetchPolicyData('Locations',     'LocationService1',          'GetPageOfLocationsInPolicyDataAccessScope',          'locationSearch'),
      fetchPolicyData('Departments',   'DepartmentGroupService1',   'GetPageOfDepartmentGroupsInPolicyDataAccessScope',   'departmentGroupSearch'),
      fetchPolicyData('EmployeeTypes', 'EmployeeTypeGroupService1', 'GetPageOfEmployeeTypeGroupsInPolicyDataAccessScope', 'employeeTypeGroupSearch'),
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

    const parseReport = async (reportUri, headerKeyword, buildRow) => {
      const payload = { reportUri: `urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:${reportUri}`, filterValues: [], outputFormatUri: 'urn:replicon:report-output-format-option:csv' };
      const res2    = await axios.post(reportEndpoint, payload, { headers });
      const csvStr  = res2.data.d?.payload || res2.data.payload || '';
      if (!csvStr) return [];
      const lines  = csvStr.split(/\r?\n/);
      const hIdx   = lines.findIndex(l => l.toLowerCase().includes(headerKeyword.toLowerCase()));
      if (hIdx === -1) return [];
      const cols   = parseCSVLine(lines[hIdx]);
      const getIdx = (s) => cols.findIndex(h => h.toLowerCase().includes(s.toLowerCase()));
      const rows   = [];
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
        const idxUri   = g('timesheet uri');
        const idxHours = Math.max(g('total hrs (in period)'), g('total hrs'));
        if (!c[idxUri] || !c[g('user name')] || !c[g('timesheet period')]) return null;
        return { period: c[g('timesheet period')], user: c[g('user name')], status: c[g('approval status')] || c[g('submission status')], uri: c[idxUri], hours: parseNumber(c[idxHours]) };
      }).catch(() => []),
    ]);

    send('roster',     roster);
    send('drafts',     drafts);
    send('cube',       cube);
    send('timesheets', timesheets);
    send('complete',   { dictionaries });
    res.end();

    logger.info({ user: req.user.name, cubeRows: cube.length, rosterRows: roster.length }, 'Dashboard fetch complete');
  } catch (err) {
    logger.error({ err, user: req.user?.name }, 'Dashboard fetch failed');
    sendError('Failed to fetch live data: ' + err.message);
  }
});

export default router;
