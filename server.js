import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
    origin: ['http://129.151.146.210/', 'http://localhost'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json()); 

// ===========================================================================
// EXTREME LOGGING ENGINE FOR REPLICON WCF DEBUGGING
// ===========================================================================
async function wcfRequest(stepName, url, payload, headers) {
    console.log(`\n========================================================`);
    console.log(`[>> REPLICON API REQUEST >>] ${stepName}`);
    console.log(`URL: ${url}`);
    console.log(`PAYLOAD:\n${JSON.stringify(payload, null, 2)}`);
    console.log(`--------------------------------------------------------`);
    try {
        const response = await axios.post(url, payload, { headers });
        console.log(`[<< REPLICON API SUCCESS <<] ${stepName} - 200 OK`);
        console.log(`========================================================\n`);
        return response.data;
    } catch (error) {
        console.error(`\n❌ [XX REPLICON API ERROR XX] ${stepName} FAILED!`);
        console.error(`URL: ${url}`);
        if (error.response) {
            console.error(`STATUS: ${error.response.status} ${error.response.statusText}`);
            console.error(`ERROR RESPONSE JSON:\n${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`ERROR MESSAGE: ${error.message}`);
        }
        console.error(`========================================================\n`);
        throw error;
    }
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const lowerUsername = username.toLowerCase();
    const token = (process.env.REPLICON_TOKEN || "").trim();
    const company = (process.env.REPLICON_COMPANY || "").trim();

    if (!token || !company) return res.status(500).json({ error: "Server config error." });

    const ALLOWED_USERS = { "ziad": process.env.AdminPWD, "mod": process.env.ModPWD, "gm": process.env.GMPWD };
    const REPLICON_LOGINS = { "ziad": "z.shafik", "mod": "i.najmi", "gm": "H.matta" };

    if (!ALLOWED_USERS[lowerUsername] || ALLOWED_USERS[lowerUsername] !== password) {
        return res.status(401).json({ error: "Invalid dashboard credentials." });
    }

    try {
        const data = await wcfRequest(
            "User Login",
            `https://ap1.replicon.com/${company}/services/UserService1.svc/GetUser2`,
            { user: { loginName: REPLICON_LOGINS[lowerUsername] } }, 
            { 'Authorization': `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' }
        );
        res.json({ success: true, displayName: data.d.displayName, uri: data.d.uri });
    } catch (error) { res.status(400).json({ error: "Replicon rejected the user request." }); }
});

function cleanStr(str) { return !str ? "" : str.replace(/[\r\n\t]/g, '').trim(); }
function parseCSVLine(line) {
    const result = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"' && line[i+1] === '"') { cur += '"'; i++; } 
        else if (line[i] === '"') { inQuotes = !inQuotes; } 
        else if (line[i] === ',' && !inQuotes) { result.push(cleanStr(cur)); cur = ''; } 
        else { cur += line[i]; }
    }
    result.push(cleanStr(cur));
    return result;
}
function parseNumber(val) { return parseFloat(String(val).replace(/"/g, '').replace(/,/g, '')) || 0; }
function parseDateToTimestamp(dateStr) { const p = Date.parse((dateStr || "").replace(/"/g, '')); return isNaN(p) ? 0 : p; }

app.get('/api/dashboard', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const token = (process.env.REPLICON_TOKEN || "").trim();
    const company = (process.env.REPLICON_COMPANY || "").trim();
    const headers = { 'Authorization': `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };
    const reportEndpoint = `https://ap1.replicon.com/${company}/services/ReportService1.svc/GenerateReport`;

    try {
        let rawDataCube = []; let rawRoster = []; let rawDrafts = []; let rawTimesheets = []; let rawTsDetails = []; let rawAccountManagers = []; 
        let dictionaries = { departments: [], locations: [], programs: [], clients: [], users: [], projectManagers: [], employeeTypes: [] };

        console.log(`\n[DEBUG] --- BOOTSTRAPPING SYSTEM DICTIONARY URIs VIA GETDATA ---`);
        
        const fetchListData = async (dictName, serviceName, columnUri) => {
            const url = `https://ap1.replicon.com/${company}/services/${serviceName}.svc/GetData`;
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

        // =========================================================================
        // NEW: POLICY DATA ACCESS ENDPOINT PARSER (For Depts, Locations, EmpTypes)
        // =========================================================================
        const fetchPolicyData = async (dictName, serviceName, methodName, searchKey) => {
            const url = `https://ap1.replicon.com/${company}/services/${serviceName}.svc/${methodName}`;
            const payload = {
                pageIndex: "1",
                pageSize: "1000",
                policyUri: "urn:replicon:policy:project-management"
            };
            
            if (searchKey) {
                payload[searchKey] = searchKey === 'departmentGroupSearch' ? {
                    statusOptionUri: "urn:replicon:department-group-status-option:include-only-enabled-department-groups",
                    hierarchyDataOptionUri: null,
                    textSearch: null
                } : null;
            }

            try {
                const data = await wcfRequest(`Fetch Policy List: ${dictName}`, url, payload, headers);
                let items = data.d || data || [];
                let parsed = [];
                
                items.forEach(item => {
                    let target = item;
                    // Dynamically dig out the nested object containing displayText (e.g., item.location)
                    Object.values(item).forEach(val => {
                        if (val && typeof val === 'object' && val.displayText && val.uri) {
                            target = val;
                        }
                    });
                    
                    if (target && target.displayText && target.uri) {
                        parsed.push({ name: target.displayText, uri: target.uri });
                    }
                });

                // Per Requirements: Exclude Row 0 (Company/LiveRoute) from Departments
                if (dictName === 'Departments' && parsed.length > 0) {
                    parsed.shift(); 
                }

                return parsed;
            } catch(err) {
                return [];
            }
        };

        dictionaries.clients = await fetchListData('Clients', 'ClientListService1', 'urn:replicon:client-list-column:client');
        dictionaries.programs = await fetchListData('Programs', 'ProgramListService1', 'urn:replicon:program-list-column:program');
        
        // Use New Policy Scope Functions
        dictionaries.locations = await fetchPolicyData('Locations', 'LocationService1', 'GetPageOfLocationsInPolicyDataAccessScope', 'locationSearch');
        dictionaries.departments = await fetchPolicyData('Departments', 'DepartmentGroupService1', 'GetPageOfDepartmentGroupsInPolicyDataAccessScope', 'departmentGroupSearch');
        dictionaries.employeeTypes = await fetchPolicyData('EmployeeTypes', 'EmployeeTypeGroupService1', 'GetPageOfEmployeeTypeGroupsInPolicyDataAccessScope', 'employeeTypeGroupSearch');
        
        const allUsers = await fetchListData('Users', 'UserListService1', 'urn:replicon:user-list-column:user'); 
        dictionaries.users = allUsers; 
        dictionaries.projectManagers = allUsers.filter(u => {
            const name = u.name.toLowerCase();
            return name.includes('ziad shafik') || name.includes('irfan najmi');
        });

        // Reports Fetching
        try {
            const payloadRoster = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:3f1148e3-624f-4666-ba25-6a0432a883ee", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
            let resRoster = await axios.post(reportEndpoint, payloadRoster, { headers });
            let csvRoster = resRoster.data.d?.payload || resRoster.data.payload || "";
            if (csvRoster) {
                let lines = csvRoster.split(/\r?\n/);
                let headerIdx = lines.findIndex(line => line.toLowerCase().includes('user name'));
                if (headerIdx !== -1) {
                    let headerCols = parseCSVLine(lines[headerIdx]);
                    const getIdx = (str) => headerCols.findIndex(h => h.toLowerCase().includes(str.toLowerCase()));
                    const idxName = getIdx('User Name'), idxStart = getIdx('Start Date'), idxEnd = getIdx('End Date'), idxStatus = getIdx('Status');
                    for (let j = headerIdx + 1; j < lines.length; j++) {
                        const line = lines[j].trim();
                        if (!line || line.startsWith('Full Summary')) continue;
                        const cols = parseCSVLine(line);
                        rawRoster.push({ name: cols[idxName] || "Unknown", start: parseDateToTimestamp(cols[idxStart]), end: parseDateToTimestamp(cols[idxEnd]), status: cols[idxStatus] || "Disabled" });
                    }
                }
            }
        } catch(e) {}

        try {
            const payloadDrafts = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:523be039-0435-402a-b1ba-fc7fc5810bb1", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
            let resDrafts = await axios.post(reportEndpoint, payloadDrafts, { headers });
            let csvDrafts = resDrafts.data.d?.payload || resDrafts.data.payload || "";
            if (csvDrafts) {
                let lines = csvDrafts.split(/\r?\n/);
                let headerIdx = lines.findIndex(line => line.toLowerCase().includes('user name') && line.toLowerCase().includes('date'));
                if (headerIdx !== -1) {
                    let headerCols = parseCSVLine(lines[headerIdx]);
                    const getIdx = (str) => headerCols.findIndex(h => h.toLowerCase().includes(str.toLowerCase()));
                    const idxName = getIdx('User Name'), idxDate = getIdx('Date'), idxHours = Math.max(getIdx('Actual Work Hours'), getIdx('Hours'));
                    for (let j = headerIdx + 1; j < lines.length; j++) {
                        const line = lines[j].trim();
                        if (!line || line.startsWith('Full Summary')) continue;
                        const cols = parseCSVLine(line);
                        if (cols[idxName] && cols[idxDate]) {
                            rawDrafts.push({ user: cols[idxName], date: parseDateToTimestamp(cols[idxDate]), act: parseNumber(cols[idxHours]) });
                        }
                    }
                } 
            }
        } catch(e) {}

        try {
            const payloadCube = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:c4dc8459-d888-4db8-af86-051e965912b3", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
            let resReport = await axios.post(reportEndpoint, payloadCube, { headers });
            let csvStr = resReport.data.d?.payload || resReport.data.payload || "";
            if (csvStr) {
                let lines = csvStr.split(/\r?\n/);
                let headerIdx = lines.findIndex(line => line.toLowerCase().includes('entry date'));
                if (headerIdx !== -1) {
                    let headerCols = parseCSVLine(lines[headerIdx]);
                    const getIdx = (str) => headerCols.findIndex(h => h.toLowerCase().includes(str.toLowerCase()));
                    const idxDate = getIdx('Entry Date'), idxUser = getIdx('User Name'), idxClient = getIdx('Client Name'), idxProject = getIdx('Project Name'), idxProgram = getIdx('Program Name'), idxLoc = getIdx('Location'), idxHours = getIdx('Hours'), idxEst = getIdx('Estimated Hrs'), idxQuoted = getIdx('Quoted Hours'), idxStatus = getIdx('Project Status');

                    for (let j = headerIdx + 1; j < lines.length; j++) {
                        const line = lines[j].trim();
                        if (!line || line.startsWith('Full Summary')) continue;
                        const cols = parseCSVLine(line);
                        const pName = cols[idxProject], pStatus = idxStatus > -1 ? cols[idxStatus] : "Unknown";
                        if (!pName || pName === "" || pName.toLowerCase() === "< none >") continue;

                        rawDataCube.push({
                            dateStr: cols[idxDate], timestamp: parseDateToTimestamp(cols[idxDate]), user: cols[idxUser], client: cols[idxClient], project: pName, program: cols[idxProgram] || "Unassigned", location: cols[idxLoc], status: pStatus, act: parseNumber(cols[idxHours]), est: parseNumber(cols[idxEst]), quoted: parseNumber(cols[idxQuoted])
                        });
                    }
                }
            }
        } catch (e) { console.error("Cube Fetch Error"); }

        try {
            const payloadTs = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:759875bf-264a-4aef-8a44-26649c81ae65", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
            let resTs = await axios.post(reportEndpoint, payloadTs, { headers });
            let csvTs = resTs.data.d?.payload || resTs.data.payload || "";
            if (csvTs) {
                let lines = csvTs.split(/\r?\n/);
                let headerIdx = lines.findIndex(line => line.toLowerCase().includes('timesheet uri'));
                if (headerIdx !== -1) {
                    let headerCols = parseCSVLine(lines[headerIdx]);
                    const getIdx = (str) => headerCols.findIndex(h => h.toLowerCase().includes(str.toLowerCase()));
                    const idxPeriod = getIdx('Timesheet Period'), idxUser = getIdx('User Name'), idxAppStatus = getIdx('Approval Status'), idxSubStatus = getIdx('Submission Status'), idxUri = getIdx('Timesheet URI'), idxHours = Math.max(getIdx('Total Hrs (In Period)'), getIdx('Total Hrs'));

                    for (let j = headerIdx + 1; j < lines.length; j++) {
                        const line = lines[j].trim();
                        if (!line || line.startsWith('Full Summary')) continue;
                        const cols = parseCSVLine(line);
                        if (cols[idxUri] && cols[idxUser] && cols[idxPeriod]) {
                            rawTimesheets.push({ period: cols[idxPeriod], user: cols[idxUser], status: cols[idxAppStatus] || cols[idxSubStatus], uri: cols[idxUri], hours: parseNumber(cols[idxHours]) });
                        }
                    }
                }
            }
        } catch(e) {}

        res.json({ 
            cube: rawDataCube, roster: rawRoster, drafts: rawDrafts, timesheets: rawTimesheets, tsDetails: rawTsDetails, accountManagers: rawAccountManagers,
            dictionaries: dictionaries 
        });

    } catch (error) { res.status(500).json({ error: "Failed to fetch live data." }); }
});

// ============================================================================
// PROJECT CREATION WORKFLOW (STRICT SEQUENCE USING REPLICON DRAFT PATTERN)
// ============================================================================
app.post('/api/projects/new', async (req, res) => {
    const payload = req.body;
    const token = (process.env.REPLICON_TOKEN || "").trim();
    const company = (process.env.REPLICON_COMPANY || "").trim();

    if (!token || !company) return res.status(500).json({ error: "Server configuration error. Tokens missing." });

    const headers = { 'Authorization': `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' };

    console.log(`\n========================================================`);
    console.log(`[WORKFLOW START] SEQUENTIAL PROJECT PROVISIONING`);
    console.log(`========================================================`);

    const parseDateForReplicon = (dateStr) => {
        if (!dateStr) return undefined;
        const parts = dateStr.split('-');
        return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
    };

    const getStatusUri = (statusString) => {
        const map = {
            'Planning': 'urn:replicon:project-status-type:tentative',
            'In Progress': 'urn:replicon:project-status-type:in-progress',
            'Completed': 'urn:replicon:project-status-type:completed',
            'Archived': 'urn:replicon:project-status-type:archived'
        };
        return map[statusString] || 'urn:replicon:project-status:tentative';
    };

    try {
        // ------------------------------------------------------------------------
        // STEP 1: CREATE NEW CLIENT (Using Draft Sequence)
        // ------------------------------------------------------------------------
        let activeClientUri = payload.clientUri;

        if (payload.clientMode === 'new' && payload.clientName) {
            console.log(`\n[STEP 1] Creating New Client Draft: ${payload.clientName}`);
            
            let clientDraftRes = await wcfRequest("Create Client Draft", `https://ap1.replicon.com/${company}/services/ClientService1.svc/CreateNewDraft`, {}, headers);
            let clientDraftUri = clientDraftRes.Value || clientDraftRes.d || clientDraftRes.uri;

            await wcfRequest("Update Client Name", `https://ap1.replicon.com/${company}/services/ClientService1.svc/UpdateName`, { clientUri: clientDraftUri, name: payload.clientName }, headers);
            
            let clientPubRes = await wcfRequest("Publish Client", `https://ap1.replicon.com/${company}/services/ClientService1.svc/PublishDraft`, { draftUri: clientDraftUri }, headers);
            activeClientUri = clientPubRes.Value || clientPubRes.d || clientPubRes.uri;
        } else {
            console.log(`\n[STEP 1] SKIPPED: Using existing client URI (${activeClientUri})`);
        }

        if (!activeClientUri) throw new Error("Pipeline aborted: Client URI is missing.");

        // ------------------------------------------------------------------------
        // STEP 2: CREATE PROJECT SHELL (Using Draft Sequence)
        // ------------------------------------------------------------------------
        console.log(`\n[STEP 2] Creating Project Draft Sequence`);

        let projDraftRes = await wcfRequest("Create Project Draft", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/CreateNewDraft`, {}, headers);
        let projDraftUri = projDraftRes.Value || projDraftRes.d || projDraftRes.uri;

        await wcfRequest("Update Project Name", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateName`, { projectUri: projDraftUri, name: payload.projectName }, headers);
        await wcfRequest("Update Project Code", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateCode`, { projectUri: projDraftUri, code: payload.projectCode }, headers);
        await wcfRequest("Update Project Percentage", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdatePercentComplete`, { projectUri: projDraftUri, code: payload.percentCompleted }, headers);

        if (payload.startDate || payload.endDate) {
            await wcfRequest("Update Project Dates", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateTimeEntryDateRange`, {
                projectUri: projDraftUri,
                dateRange: {
                    startDate: parseDateForReplicon(payload.startDate),
                    endDate: parseDateForReplicon(payload.endDate)
                }
            }, headers);
        }

        // =========================================================================
        // NEW: INJECTING NEW FIELDS (Dept, Emp Type, Location, Time Entry Toggle)
        // =========================================================================
        if (payload.departmentUri) {
            await wcfRequest("Update Department", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateDepartmentGroup2`, {
                projectUri: projDraftUri,
                departmentGroup: { uri: payload.departmentUri, parent: null, name: null, parameterCorrelationId: null }
            }, headers);
        }

        if (payload.employeeTypeUri) {
            await wcfRequest("Update Employee Type", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateEmployeeTypeGroup2`, {
                projectUri: projDraftUri,
                employeeTypeGroup: { uri: payload.employeeTypeUri, parent: null, name: null, parameterCorrelationId: null }
            }, headers);
        }

        if (payload.locationUri) {
            await wcfRequest("Update Location", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateLocation`, {
                projectUri: projDraftUri,
                location: { uri: payload.locationUri, parentUri: null, name: null }
            }, headers);
        }

        await wcfRequest("Update Allow Time Entry", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateAllowTimeEntryAgainstTasksOnly`, {
            projectUri: projDraftUri,
            allowTimeEntryAgainstTasksOnly: payload.allowTimeEntry === 'Yes'
        }, headers);
        // =========================================================================

        const safeClientUriString = typeof activeClientUri === 'object' ? activeClientUri.uri : activeClientUri;

        await wcfRequest("Update Project Clients", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateClients`, {
            projectUri: projDraftUri,
            clients: [
                {
                    client: { 
                        uri: safeClientUriString,
                        name: null,
                        code: null,
                        parameterCorrelationId: null
                    },
                    costAllocationPercentage: "100.0"
                }
            ]
        }, headers);

        if (payload.programUri) {
            await wcfRequest("Update Project Program", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateProgram`, { projectUri: projDraftUri, programUri: payload.programUri }, headers);
        }

        if (payload.pmUri) {
            await wcfRequest("Update Project Leader", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateProjectLeader`, { projectUri: projDraftUri, userUri: payload.pmUri }, headers);
        }

        await wcfRequest("Update Project Status", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/UpdateStatus`, { projectUri: projDraftUri, projectStatusUri: getStatusUri(payload.status) }, headers);

        let projPubRes = await wcfRequest("Publish Project", `https://ap1.replicon.com/${company}/services/ProjectService1.svc/PublishDraft`, { draftUri: projDraftUri }, headers);
        let finalProjectUri = projPubRes.Value || projPubRes.d || projPubRes.uri;

        // Ensure flattened Project URI
        const safeProjectUriString = typeof finalProjectUri === 'object' ? finalProjectUri.uri : finalProjectUri;

        // ------------------------------------------------------------------------
        // STEP 3: ADD TASKS SEQUENTIALLY WITH NESTING, BALANCE, & CLEAN JSON TYPES
        // ------------------------------------------------------------------------
        console.log(`\n[STEP 3] Adding ${payload.tasks.length} Tasks`);
        let successfulTasks = 0;
        let capturedTasks = []; 
        let levelUriMap = {}; // Tracks the most recent task URI for each depth level

        if (safeProjectUriString && payload.tasks && payload.tasks.length > 0) {
            for (let i = 0; i < payload.tasks.length; i++) {
                const t = payload.tasks[i];
                const level = t.outlineLevel || 1;
                
                // ROUTING FIX: Top level tasks have NO parent. Nested tasks use the previous level's Task URI.
                let parentUri = null; 
                if (level > 1 && levelUriMap[level - 1]) {
                    parentUri = levelUriMap[level - 1];
                }

                // DYNAMIC TARGET BLOCK: Cleanly omits "parent" if it's a Level 1 task
                let targetBlock = {
                    uri: null, 
                    name: t.name
                };

                // Only inject the clean parent object if a parent actually exists (Level 2+)
                if (parentUri) {
                    targetBlock.parent = { uri: parentUri };
                }

                const taskPayload = {
                    project: { uri: safeProjectUriString },
                    task: {
                        target: targetBlock,
                        name: t.name,
                        code: "",
                        description: "",
                        timeEntryDateRange: {
                            startDate: parseDateForReplicon(t.start),
                            endDate: parseDateForReplicon(t.end)
                        },
                        // Real numbers and booleans, exactly matching the successful sniff!
                        percentCompleted: 0,
                        isTimeEntryAllowed: !t.isMilestone, 
                        isClosed: false,
                        estimatedHours: t.roundedHours > 0 ? {
                            hours: t.roundedHours,
                            minutes: 0,
                            seconds: 0
                        } : null,
                        customFieldValues: [
                            { customField: { uri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:ff2f15e9-8238-4691-89ee-53d780cd899a" }, number: 0 },
                            { customField: { uri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:45c59ea2-2ceb-496a-8544-c836cbcac626" }, number: null },
                            { customField: { uri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:ad68d557-6779-4adc-8925-a25c403f8504" }, text: "Unlimited" }
                        ],
                        estimatedCost: { amount: 0, currency: { uri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:currency:8" } },
                        timeAndExpenseEntryTypeUri: "urn:replicon:time-and-expense-entry-type:billable-and-non-billable"
                    },
                    unitOfWorkId: `batch_${Date.now()}_${i}`
                };

                try {
                    let taskRes = await wcfRequest(`Add Task ${i+1}/${payload.tasks.length} (Level ${level})`, `https://ap1.replicon.com/${company}/services/ProjectService1.svc/AddTask`, taskPayload, headers);
                    successfulTasks++;

                    let newTaskUri = taskRes.Value || taskRes.d || taskRes.uri;
                    while (newTaskUri && typeof newTaskUri === 'object') {
                        newTaskUri = newTaskUri.uri || newTaskUri.Value || newTaskUri.d;
                    }

                    // Store this task's URI as the current parent for its specific level
                    if (newTaskUri) {
                        levelUriMap[level] = newTaskUri;
                    }

                    if (newTaskUri && t.assignedUsers && t.assignedUsers.length > 0) {
                        capturedTasks.push({ taskUri: newTaskUri, assignedUris: t.assignedUsers });
                    }
                } catch (error) {
                    console.error(`[XXX] TASK ${i+1} SKIPPED DUE TO ERROR`);
                }
            }
        }

        // ------------------------------------------------------------------------
        // STEP 4: ASSIGN UNIQUE USERS TO PROJECT SHELL
        // ------------------------------------------------------------------------
        console.log(`\n[STEP 4] Assigning Unique Users to Project Shell`);
        const uniqueUsers = new Set();
        capturedTasks.forEach(ct => {
            ct.assignedUris.forEach(u => uniqueUsers.add(u));
        });

        for (const userUri of uniqueUsers) {
            try {
                await wcfRequest(`Assign User to Project`, `https://ap1.replicon.com/${company}/services/ProjectService1.svc/AssignResourceToProject`, {
                    projectUri: safeProjectUriString,
                    resourceUri: userUri,
                    resourceToReplaceUri: null
                }, headers);
            } catch (error) {
                console.error(`[XXX] Failed to assign user ${userUri} to project`);
            }
        }

        // ------------------------------------------------------------------------
        // STEP 5: BULK ASSIGN USERS TO SPECIFIC TASKS
        // ------------------------------------------------------------------------
        console.log(`\n[STEP 5] Bulk Assigning Users to Specific Tasks`);
        for (let i = 0; i < capturedTasks.length; i++) {
            const ct = capturedTasks[i];
            try {
                await wcfRequest(`Assign Users to Task ${i+1}`, `https://ap1.replicon.com/${company}/services/TaskService1.svc/BulkUpdateResourceAssignments`, {
                    taskUri: ct.taskUri,
                    resourceUris: ct.assignedUris,
                    isAssigned: true
                }, headers);
            } catch (error) {
                console.error(`[XXX] Failed to assign users to task ${ct.taskUri}`);
            }
        }

        console.log(`\n=============================================================`);
        console.log(`✅ [WORKFLOW COMPLETE] Provisioning finished!`);
        console.log(`=============================================================\n`);
        
        res.status(200).json({ 
            success: true, 
            message: `Successfully created project ${payload.projectCode}, injected ${successfulTasks} tasks, and completed team assignments!`,
            projectUri: safeProjectUriString
        });

    } catch (error) {
        console.error("❌ [SERVER] WCF Flow Failed:", error);
        res.status(500).json({ error: error.message || "An error occurred during project creation." });
    }
});

app.use(express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    }
}));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "API route not found" });
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));