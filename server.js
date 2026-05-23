import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// This is the permission slip allowing your frontend to connect
app.use(cors({
    origin: ['http://51.170.86.2', 'http://localhost'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json()); 

// ---------------------------------------------------------------------------
// 1. REPLICON API ENDPOINTS
// ---------------------------------------------------------------------------

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
        const response = await axios.post(
            `https://ap1.replicon.com/${company}/services/UserService1.svc/GetUser2`,
            { user: { loginName: REPLICON_LOGINS[lowerUsername] } }, 
            { headers: { 'Authorization': `Bearer ${token}`, 'X-Replicon-Security-Context': 'User', 'Content-Type': 'application/json' } }
        );
        res.json({ success: true, displayName: response.data.d.displayName, uri: response.data.d.uri });
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
        let rawDataCube = []; let rawRoster = []; let rawDrafts = []; let rawTimesheets = []; let rawTsDetails = [];
        let rawAccountManagers = []; // <-- NEW: Array for Account Managers

        // Fetch Roster
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
        } catch(e) { console.error("Roster Fetch Error"); }

        // Fetch Drafts
        try {
            console.log("--------- DEBUG: STARTING DRAFTS FETCH ---------");
            const payloadDrafts = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:523be039-0435-402a-b1ba-fc7fc5810bb1", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
            
            let resDrafts = await axios.post(reportEndpoint, payloadDrafts, { headers });
            let csvDrafts = resDrafts.data.d?.payload || resDrafts.data.payload || "";
            
            console.log(`[DEBUG] Replicon returned ${csvDrafts.length} bytes of Drafts CSV data.`);

            if (csvDrafts) {
                let lines = csvDrafts.split(/\r?\n/);
                let headerIdx = lines.findIndex(line => line.toLowerCase().includes('user name') && line.toLowerCase().includes('date'));
                
                if (headerIdx !== -1) {
                    let headerCols = parseCSVLine(lines[headerIdx]);
                    console.log(`[DEBUG] Found Headers:`, headerCols); 
                    
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
                    console.log(`[DEBUG] Successfully parsed ${rawDrafts.length} daily draft entries.`);
                } else {
                    console.log("[DEBUG] ERROR: Could not find 'User Name' and 'Date' headers in the CSV!");
                }
            }
        } catch(e) { 
            console.error("[DEBUG] FATAL ERROR fetching Drafts:", e.message); 
        }

        // Fetch Data Cube
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

        // Fetch Timesheets
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
        } catch(e) { console.error("Timesheet Fetch Error"); }

        // Fetch Account Managers
        try {
            const payloadAM = { reportUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:report:b53c2b12-15a2-4da8-b97e-babb796f8aa5", filterValues: [], outputFormatUri: "urn:replicon:report-output-format-option:csv" };
            let resAM = await axios.post(reportEndpoint, payloadAM, { headers });
            let csvAM = resAM.data.d?.payload || resAM.data.payload || "";
            if (csvAM) {
                let lines = csvAM.split(/\r?\n/);
                let headerIdx = lines.findIndex(line => line.toLowerCase().includes('manager'));
                
                if (headerIdx !== -1) {
                    // CRITICAL FIX: Clean the headers just like we did for the data cube
                    let headerCols = parseCSVLine(lines[headerIdx]).map(h => h.replace('payload=', '').trim());
                    const idxName = headerCols.findIndex(h => h.toLowerCase().includes('manager'));
                    
                    let debugAMCount = 0;
                    for (let j = headerIdx + 1; j < lines.length; j++) {
                        const line = lines[j].trim();
                        if (!line || line.startsWith('Full Summary')) continue;
                        const cols = parseCSVLine(line);
                        const amName = cols[idxName];
                        
                        if (amName && amName !== 'N/A' && !amName.includes('error') && amName.trim() !== '') {
                            rawAccountManagers.push(amName);
                            debugAMCount++;
                        }
                    }
                    rawAccountManagers = [...new Set(rawAccountManagers)].sort();
                    console.log(`[DEBUG] Extracted ${rawAccountManagers.length} unique Account Managers from ${debugAMCount} rows.`);
                }
            }
        } catch(e) { console.error("Account Managers Fetch Error", e.message); }

        // <-- NEW: Added accountManagers to the JSON response -->
        res.json({ 
            cube: rawDataCube, 
            roster: rawRoster, 
            drafts: rawDrafts, 
            timesheets: rawTimesheets, 
            tsDetails: rawTsDetails,
            accountManagers: rawAccountManagers 
        });

    } catch (error) { res.status(500).json({ error: "Failed to fetch live data." }); }
});

app.post('/api/projects/new', async (req, res) => {
    const payload = req.body;
    const token = (process.env.REPLICON_TOKEN || "").trim();
    const company = (process.env.REPLICON_COMPANY || "").trim();

    if (!token || !company) return res.status(500).json({ error: "Server configuration error. Replicon tokens missing." });

    const headers = {
        'Authorization': `Bearer ${token}`,
        'X-Replicon-Security-Context': 'User',
        'Content-Type': 'application/json'
    };

    console.log(`\n[DEBUG] --- EXECUTING PROJECT PROVISIONING FLOW ---`);

    // Format dates into Replicon's explicit { year, month, day } objects
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
    };

    // Build the tasks array matching TaskHierarchyParameter1 mapping schema specs
    const formattedTasks = payload.tasks.map(t => ({
        task: {
            name: t.name,
            code: null, // Left null or auto-assigned
            description: t.duration, // Reference imported MS Project hours duration tracking string
            isTimeEntryAllowed: !t.isMilestone, // Lock tracking control configuration dynamically
            percentCompleted: 0
        },
        childTasks: [] // Flattened setup flow schema hierarchy mapping architecture tracking
    }));

    // Construct the production payload matching the explicit standard PutProject specs discovered
    const projectPayload = {
        project: {
            target: null, // Null confirms explicit generation creation sequence flow
            projectInfo: {
                name: payload.projectName,
                code: payload.projectCode,
                description: payload.internalRemarks || null,
                timeEntryDateRange: {
                    startDate: parseDate(payload.startDate),
                    endDate: parseDate(payload.endDate)
                },
                projectStatusLabel: { name: payload.status },
                percentCompleted: parseInt(payload.percentCompleted || 0, 10),
                client: { name: payload.clientName },
                program: payload.programName ? { name: payload.programName } : null,
                projectLeader: { name: payload.projectManager },
                isTimeEntryAllowed: payload.allowTimeEntry === 'Yes',
                billingTypeUri: payload.billingType === 'Fixed Bid' ? 'urn:replicon:billing-type:fixed-bid' : 'urn:replicon:billing-type:time-and-materials'
            },
            tasks: formattedTasks
        }
    };

    console.log(`[DEBUG] Final PutProject Payload structural generation map string bundle:`, JSON.stringify(projectPayload, null, 2));

    try {
        const projectResponse = await axios.post(
            `https://ap1.replicon.com/${company}/services/ProjectService1.svc/PutProject`,
            projectPayload,
            { headers }
        );

        console.log(`[DEBUG] Replicon API Provisioning Success Response packet data verification payload:`, projectResponse.data);

        res.status(200).json({ 
            success: true, 
            message: `Successfully created project ${payload.projectCode} assigned to ${payload.clientName} with ${payload.tasks.length} structural task parameters mapped!` 
        });

    } catch (error) {
        const errorMessage = error.response?.data || error.message;
        console.error("❌ REPLICON PROVISIONING FLOW REJECTED PACKET:", JSON.stringify(errorMessage, null, 2));
        
        // Dynamic messaging block capturing systemic errors smoothly
        const friendlyError = error.response?.data?.error?.details?.displayText || "Check terminal tracing variables.";
        res.status(500).json({ error: `Replicon Verification Rejection: ${friendlyError}` });
    }
});

// ---------------------------------------------------------------------------
// 2. STATIC FILE SERVING FOR REACT 
// ---------------------------------------------------------------------------

// FORCE the MIME type headers to beat the Linux block
app.use(express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API route not found" });
    }
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.get('/api/health', (req, res) => res.send('Backend is alive!'));

console.log("--- CONFIG CHECK ---");
console.log("Token exists:", !!process.env.REPLICON_TOKEN);
console.log("Company exists:", !!process.env.REPLICON_COMPANY);
console.log("--------------------");
// We add '0.0.0.0' so the container accepts outside traffic
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

