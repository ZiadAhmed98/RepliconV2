import express from 'express';
import { config, getHeaders } from '../config.js';
import { wcfRequest } from '../services/repliconApi.js';

const router = express.Router();

router.post('/new', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const payload = req.body;
    if (!config.token || !config.company) {
        res.write(JSON.stringify({ status: 'error', error: "Server configuration error. Tokens missing." }) + '\n');
        return res.end();
    }

    const headers = getHeaders();
    console.log(`\n========================================================`);
    console.log(`[WORKFLOW START] REAL-TIME SEQUENTIAL PROVISIONING`);
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
        let activeClientUri = payload.clientUri;

        if (payload.clientMode === 'new' && payload.clientName) {
            res.write(JSON.stringify({ step: 'client' }) + '\n');
            let clientDraftRes = await wcfRequest("Create Client Draft", `https://ap1.replicon.com/${config.company}/services/ClientService1.svc/CreateNewDraft`, {}, headers);
            let clientDraftUri = clientDraftRes.Value || clientDraftRes.d || clientDraftRes.uri;

            await wcfRequest("Update Client Name", `https://ap1.replicon.com/${config.company}/services/ClientService1.svc/UpdateName`, { clientUri: clientDraftUri, name: payload.clientName }, headers);

            if (payload.accountManagerUri) {
                await wcfRequest("Update Account Manager Custom Field", `https://ap1.replicon.com/${config.company}/services/CustomFieldService1.svc/UpdateDropdownValue`, {
                    objectUri: clientDraftUri, customFieldUri: "urn:replicon-tenant:676a13c33af94d2fbb078764ac976b6e:user-defined-field:fc1a8ce8-7e33-4683-bdd3-c08387b82b58", customFieldDropDownOptionUri: payload.accountManagerUri
                }, headers);
            }            
            let clientPubRes = await wcfRequest("Publish Client", `https://ap1.replicon.com/${config.company}/services/ClientService1.svc/PublishDraft`, { draftUri: clientDraftUri }, headers);
            activeClientUri = clientPubRes.Value || clientPubRes.d || clientPubRes.uri;
        }

        if (!activeClientUri) throw new Error("Pipeline aborted: Client URI is missing.");

        res.write(JSON.stringify({ step: 'project' }) + '\n');
        let projDraftRes = await wcfRequest("Create Project Draft", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/CreateNewDraft`, {}, headers);
        let projDraftUri = projDraftRes.Value || projDraftRes.d || projDraftRes.uri;

        await wcfRequest("Update Project Name", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateName`, { projectUri: projDraftUri, name: payload.projectName }, headers);
        await wcfRequest("Update Project Code", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateCode`, { projectUri: projDraftUri, code: payload.projectCode }, headers);
        await wcfRequest("Update Project Percentage", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdatePercentComplete`, { projectUri: projDraftUri, code: payload.percentCompleted }, headers);

        if (payload.startDate || payload.endDate) {
            await wcfRequest("Update Project Dates", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateTimeEntryDateRange`, {
                projectUri: projDraftUri, dateRange: { startDate: parseDateForReplicon(payload.startDate), endDate: parseDateForReplicon(payload.endDate) }
            }, headers);
        }

        if (payload.departmentUri) {
            await wcfRequest("Update Department", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateDepartmentGroup2`, {
                projectUri: projDraftUri, departmentGroup: { uri: payload.departmentUri, parent: null, name: null, parameterCorrelationId: null }
            }, headers);
        }

        if (payload.employeeTypeUri) {
            await wcfRequest("Update Employee Type", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateEmployeeTypeGroup2`, {
                projectUri: projDraftUri, employeeTypeGroup: { uri: payload.employeeTypeUri, parent: null, name: null, parameterCorrelationId: null }
            }, headers);
        }

        if (payload.locationUri) {
            await wcfRequest("Update Location", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateLocation`, {
                projectUri: projDraftUri, location: { uri: payload.locationUri, parentUri: null, name: null }
            }, headers);
        }

        await wcfRequest("Update Allow Time Entry", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateAllowTimeEntryAgainstTasksOnly`, {
            projectUri: projDraftUri, allowTimeEntryAgainstTasksOnly: payload.allowTimeEntry === 'Yes'
        }, headers);

        const safeClientUriString = typeof activeClientUri === 'object' ? activeClientUri.uri : activeClientUri;
        await wcfRequest("Update Project Clients", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateClients`, {
            projectUri: projDraftUri, clients: [{ client: { uri: safeClientUriString, name: null, code: null, parameterCorrelationId: null }, costAllocationPercentage: "100.0" }]
        }, headers);

        if (payload.programUri) {
            await wcfRequest("Update Project Program", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateProgram`, { projectUri: projDraftUri, programUri: payload.programUri }, headers);
        }

        if (payload.pmUri) {
            await wcfRequest("Update Project Leader", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateProjectLeader`, { projectUri: projDraftUri, userUri: payload.pmUri }, headers);
        }

        await wcfRequest("Update Project Status", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/UpdateStatus`, { projectUri: projDraftUri, projectStatusUri: getStatusUri(payload.status) }, headers);

        let projPubRes = await wcfRequest("Publish Project", `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/PublishDraft`, { draftUri: projDraftUri }, headers);
        let finalProjectUri = projPubRes.Value || projPubRes.d || projPubRes.uri;
        const safeProjectUriString = typeof finalProjectUri === 'object' ? finalProjectUri.uri : finalProjectUri;

        let successfulTasks = 0; let capturedTasks = []; let levelUriMap = {}; 
        if (safeProjectUriString && payload.tasks && payload.tasks.length > 0) {
            const totalTasks = payload.tasks.length;
            res.write(JSON.stringify({ step: 'tasks', current: 0, total: totalTasks }) + '\n');
            for (let i = 0; i < totalTasks; i++) {
                const t = payload.tasks[i]; const level = t.outlineLevel || 1;
                let parentUri = null; if (level > 1 && levelUriMap[level - 1]) parentUri = levelUriMap[level - 1];
                let targetBlock = { uri: null, name: t.name }; if (parentUri) targetBlock.parent = { uri: parentUri };

                const taskPayload = {
                    project: { uri: safeProjectUriString },
                    task: {
                        target: targetBlock, name: t.name, code: "", description: "",
                        timeEntryDateRange: { startDate: parseDateForReplicon(t.start), endDate: parseDateForReplicon(t.end) },
                        percentCompleted: 0, isTimeEntryAllowed: !t.isMilestone, isClosed: false,
                        estimatedHours: t.roundedHours > 0 ? { hours: t.roundedHours, minutes: 0, seconds: 0 } : null,
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
                    let taskRes = await wcfRequest(`Add Task ${i+1}/${totalTasks}`, `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/AddTask`, taskPayload, headers);
                    successfulTasks++;
                    let newTaskUri = taskRes.Value || taskRes.d || taskRes.uri;
                    while (newTaskUri && typeof newTaskUri === 'object') newTaskUri = newTaskUri.uri || newTaskUri.Value || newTaskUri.d;
                    if (newTaskUri) levelUriMap[level] = newTaskUri;
                    if (newTaskUri && t.assignedUsers && t.assignedUsers.length > 0) capturedTasks.push({ taskUri: newTaskUri, assignedUris: t.assignedUsers });
                    res.write(JSON.stringify({ step: 'tasks', current: i + 1, total: totalTasks }) + '\n');
                } catch (error) { console.error(`[XXX] TASK ${i+1} SKIPPED DUE TO ERROR`); }
            }
        }

        const uniqueUsers = new Set(); let totalResourceAssignments = 0;
        capturedTasks.forEach(ct => { ct.assignedUris.forEach(u => uniqueUsers.add(u)); totalResourceAssignments += ct.assignedUris.length; });
        res.write(JSON.stringify({ step: 'resources', current: 0, total: totalResourceAssignments }) + '\n');
        
        let completedAssignments = 0;
        for (const userUri of uniqueUsers) {
            try {
                await wcfRequest(`Assign User to Project`, `https://ap1.replicon.com/${config.company}/services/ProjectService1.svc/AssignResourceToProject`, {
                    projectUri: safeProjectUriString, resourceUri: userUri, resourceToReplaceUri: null
                }, headers);
            } catch (error) {}
        }

        for (let i = 0; i < capturedTasks.length; i++) {
            const ct = capturedTasks[i];
            try {
                await wcfRequest(`Assign Users to Task ${i+1}`, `https://ap1.replicon.com/${config.company}/services/TaskService1.svc/BulkUpdateResourceAssignments`, {
                    taskUri: ct.taskUri, resourceUris: ct.assignedUris, isAssigned: true
                }, headers);
                completedAssignments += ct.assignedUris.length;
                res.write(JSON.stringify({ step: 'resources', current: completedAssignments, total: totalResourceAssignments }) + '\n');
            } catch (error) { console.error(`[XXX] Failed to assign users to task ${ct.taskUri}`); }
        }

        res.write(JSON.stringify({ step: 'finalizing' }) + '\n');
        res.write(JSON.stringify({ status: 'success', message: `Successfully created project ${payload.projectCode}, injected ${successfulTasks} tasks, and completed team assignments!`, projectUri: safeProjectUriString }) + '\n');
        res.end();
    } catch (error) {
        console.error("❌ [SERVER] WCF Flow Failed:", error);
        res.write(JSON.stringify({ status: 'error', error: error.message || "An error occurred during project creation." }) + '\n');
        res.end();
    }
});

export default router;