import express from 'express';
import axios from 'axios';
import Papa from 'papaparse';
import { config, getHeaders } from '../config.js';
import { wcfRequest } from '../services/repliconApi.js';

const router = express.Router();

function parseNumber(val) { return parseFloat(String(val).replace(/"/g, '').replace(/,/g, '')) || 0; }
function parseDateToTimestamp(dateStr) { const p = Date.parse((dateStr || "").replace(/"/g, '')); return isNaN(p) ? 0 : p; }

const getReportEndpoint = () => `https://ap1.replicon.com/${config.company}/services/ReportService1.svc/GenerateReport`;

// Route: /api/dashboard/dictionaries
router.get('/dictionaries', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const headers = getHeaders();
    let dictionaries = { departments: [], locations: [], programs: [], clients: [], users: [], projectManagers: [], employeeTypes: [], accountManagers: [] };

    const fetchListData = async (dictName, serviceName, columnUri) => {
        const url = `https://ap1.replicon.com/${config.company}/services/${serviceName}.svc/GetData`;
        const payload = { page: 1, pagesize: 10000, columnUris: [columnUri], sort: [], filterExpression: null };
        try {
            const data = await wcfRequest(`Fetch List: ${dictName}`, url, payload, headers);
            let rows = data.d?.rows || data.rows || [];
            return rows.map(r => {
                const cell = r.cells?.[0];
                if (cell && cell.textValue && cell.uri) return { name: cell.textValue, uri: cell.uri };
                return null;
            }).filter(x => x !== null);
        } catch (err) { return []; }
    };

    const fetchPolicyData = async (dictName, serviceName, methodName, searchKey) => {
        const url = `https://ap1.replicon.com/${config.company}/services/${serviceName}.svc/${methodName}`;
        const payload = { pageIndex: "1", pageSize: "1000", policyUri: "urn:replicon:policy:project-management" };
        if (searchKey) {
            payload[searchKey] = searchKey === 'departmentGroupSearch' ? {
                statusOptionUri: "urn:replicon:department-group-status-option:include-only-enabled-department-groups",
                hierarchyDataOptionUri: null, textSearch: null
            } : null;
        }
        try {
            const data = await wcfRequest(`Fetch Policy List: ${dictName}`, url, payload, headers);
            let items = data.d || data || [];
            let parsed = [];
            items.forEach(item => {
                let target = item;
                Object.values(item).forEach(val => {
                    if (val && typeof val === 'object' && val.displayText && val.uri) target = val;
                });
                if (target && target.displayText && target.uri) parsed.push({ name: target.displayText, uri: target.uri });
            });
            if (dictName === 'Departments' && parsed.length > 0) parsed.shift(); 
            return parsed;
        } catch(err) { return []; }
    };

    try {
        const [clients, programs, locations, departments, employeeTypes] = await Promise.all([
            fetchListData('Clients', 'ClientListService1', 'urn:replicon:client-list-column:client'),
            fetchListData('Programs', 'ProgramListService1', 'urn:replicon:program-list-column:program'),
            fetchPolicyData('Locations', 'LocationService1', 'GetPageOfLocationsInPolicyDataAccessScope', 'locationSearch'),
            fetchPolicyData('Departments', 'DepartmentGroupService1', 'GetPageOfDepartmentGroupsInPolicyDataAccessScope', 'departmentGroupSearch'),
            fetchPolicyData('EmployeeTypes', 'EmployeeTypeGroupService1', 'GetPageOfEmployeeTypeGroupsInPolicyDataAccessScope', 'employeeTypeGroupSearch')
        ]);
        
        dictionaries.clients = clients; dictionaries.programs = programs; dictionaries.locations = locations;
        dictionaries.departments = departments; dictionaries.employeeTypes = employeeTypes;

        try {
            const amData = await wcfRequest('Fetch Account Managers', `https://ap1.replicon.com/${config.company}/services/CustomFieldService1.svc/GetEnabledCustomFieldDropDownOptions`, {
                customFieldUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:fc1a8ce8-7e33-4683-bdd3-c08387b82b58"
            }, headers);
            let amList = amData.d || amData || [];
            dictionaries.accountManagers = amList.map(opt => ({ name: opt.displayText, uri: opt.uri }));
        } catch(err) { dictionaries.accountManagers = []; }

        const allUsers = await fetchListData('Users', 'UserListService1', 'urn:replicon:user-list-column:user'); 
        dictionaries.users = allUsers; 
        dictionaries.projectManagers = allUsers.filter(u => {
            const name = u.name.toLowerCase();
            return name.includes('ziad shafik') || name.includes('irfan najmi');
        });

        res.json({ dictionaries, accountManagers: dictionaries.accountManagers });
    } catch(err) { res.status(500).json({ error: "Failed to fetch dictionaries" }); }
});

router.get('/roster', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    try {
        const payload = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:3f1148e3-624f-4666-ba25-6a0432a883ee", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
        let response = await axios.post(getReportEndpoint(), payload, { headers: getHeaders() });
        let csvStr = response.data.d?.payload || response.data.payload || "";
        
        const { data } = Papa.parse(csvStr, { header: true, skipEmptyLines: true });
        const rawRoster = data.filter(r => r['User Name'] && r['User Name'] !== 'Full Summary').map(r => ({
            name: r['User Name'] || "Unknown",
            start: parseDateToTimestamp(r['Start Date']),
            end: parseDateToTimestamp(r['End Date']),
            status: r['Status'] || "Disabled"
        }));
        res.json(rawRoster);
    } catch (e) { res.json([]); }
});

router.get('/drafts', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    try {
        const payload = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:523be039-0435-402a-b1ba-fc7fc5810bb1", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
        let response = await axios.post(getReportEndpoint(), payload, { headers: getHeaders() });
        let csvStr = response.data.d?.payload || response.data.payload || "";

        const { data } = Papa.parse(csvStr, { header: true, skipEmptyLines: true });
        const rawDrafts = data.filter(r => r['User Name'] && r['Date'] && r['User Name'] !== 'Full Summary').map(r => {
            const act = r['Actual Work Hours'] !== undefined ? r['Actual Work Hours'] : r['Hours'];
            return { user: r['User Name'], date: parseDateToTimestamp(r['Date']), act: parseNumber(act) };
        });
        res.json(rawDrafts);
    } catch (e) { res.json([]); }
});

router.get('/cube', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    try {
        const payload = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:c4dc8459-d888-4db8-af86-051e965912b3", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
        let response = await axios.post(getReportEndpoint(), payload, { headers: getHeaders() });
        let csvStr = response.data.d?.payload || response.data.payload || "";

        const { data } = Papa.parse(csvStr, { header: true, skipEmptyLines: true });
        const rawDataCube = data.filter(r => r['Entry Date'] && r['Project Name'] && r['Project Name'] !== '< None >' && r['Entry Date'] !== 'Full Summary').map(r => ({
            dateStr: r['Entry Date'], timestamp: parseDateToTimestamp(r['Entry Date']),
            user: r['User Name'], client: r['Client Name'], project: r['Project Name'],
            program: r['Program Name'] || "Unassigned", location: r['Location'],
            status: r['Project Status'] || "Unknown", act: parseNumber(r['Hours']),
            est: parseNumber(r['Estimated Hrs']), quoted: parseNumber(r['Quoted Hours'])
        }));
        res.json(rawDataCube);
    } catch (e) { res.json([]); }
});

router.get('/timesheets', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    try {
        const payload = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:759875bf-264a-4aef-8a44-26649c81ae65", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
        let response = await axios.post(getReportEndpoint(), payload, { headers: getHeaders() });
        let csvStr = response.data.d?.payload || response.data.payload || "";

        const { data } = Papa.parse(csvStr, { header: true, skipEmptyLines: true });
        const rawTimesheets = data.filter(r => r['Timesheet URI'] && r['User Name'] && r['Timesheet Period'] && r['Timesheet URI'] !== 'Full Summary').map(r => {
            const hours = r['Total Hrs (In Period)'] !== undefined ? r['Total Hrs (In Period)'] : r['Total Hrs'];
            return {
                period: r['Timesheet Period'], user: r['User Name'],
                status: r['Approval Status'] || r['Submission Status'], uri: r['Timesheet URI'],
                hours: parseNumber(hours)
            };
        });
        res.json(rawTimesheets);
    } catch (e) { res.json([]); }
});

export default router;