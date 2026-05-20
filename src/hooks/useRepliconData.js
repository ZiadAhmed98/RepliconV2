import { useState, useEffect, useCallback } from 'react';
import { repliconApi } from '../api/replicon';

var DB_NAME = 'MDS_Premium_DB_v2';
var STORE_NAME = 'dashboard_cache';
var EXCLUDED_USERS = ["Habib Matta", "Ziad Shafik", "Irfan Najmi", "Admin", "Admin "];

function initDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject("IndexedDB unsupported");
        var request = indexedDB.open(DB_NAME, 1);
        request.onerror = (e) => reject(e.target.error);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onupgradeneeded = (e) => {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
    });
}

async function saveCache(data) {
    try {
        var db = await initDB();
        return new Promise((res) => {
            var tx = db.transaction([STORE_NAME], "readwrite");
            tx.objectStore(STORE_NAME).put(data, 'cached_matrix');
            tx.oncomplete = () => res(true);
        });
    } catch (e) { return false; }
}

async function loadCache() {
    try {
        var db = await initDB();
        return new Promise((res) => {
            var tx = db.transaction([STORE_NAME], "readonly");
            var req = tx.objectStore(STORE_NAME).get('cached_matrix');
            req.onsuccess = (e) => res(e.target.result || null);
            req.onerror = () => res(null);
        });
    } catch (e) { return null; }
}

// Add this right below the loadCache() function in useRepliconData.js
async function clearCache() {
    try {
        var db = await initDB();
        return new Promise((res) => {
            var tx = db.transaction([STORE_NAME], "readwrite");
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => res(true);
        });
    } catch (e) { return false; }
}

export function useRepliconData() {
    var [loading, setLoading] = useState(true);
    var [statusText, setStatusText] = useState('Initializing Core Engine...');
    var [sessionUser, setSessionUser] = useState(null);
    var [dataMatrix, setDataMatrix] = useState({
        factTable: [],
        dimensionTable: {},
        roster: [],
        drafts: [],
        timesheets: [],
        topClients: [],
        compliance: { dailyDeficits: 0, weeklyDeficits: 0, dailyList: [], weeklyList: [], sparkline: [] }
    });

    var getMonday = (d) => {
        d = new Date(d);
        var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff)).setHours(0,0,0,0);
    };

    var getWorkingDays = (startDate, endDate) => {
        var days = 0, cur = new Date(startDate); cur.setHours(0,0,0,0);
        var end = new Date(endDate); end.setHours(0,0,0,0);
        while (cur <= end) {
            if (cur.getDay() !== 0 && cur.getDay() !== 6) days++;
            cur.setDate(cur.getDate() + 1);
        }
        return Math.max(1, days);
    };

    var processStarSchema = useCallback((rawData) => {
        var dimensionTable = {};
        var factTable = [];
        var allTimeClientsMap = {};
        var userMaxTimesheetMap = {};

        var cleanRoster = (rawData.roster || []).filter(emp => !EXCLUDED_USERS.includes(emp.name.trim()));
        var cleanDrafts = (rawData.drafts || []).filter(d => !EXCLUDED_USERS.includes(d.user.trim()));
        var cleanTimesheets = (rawData.timesheets || []).filter(t => !EXCLUDED_USERS.includes(t.user.trim()));

        (rawData.cube || []).forEach(row => {
            var cleanUser = row.user ? row.user.trim() : "Unknown";
            if (EXCLUDED_USERS.includes(cleanUser)) return;

            factTable.push({
                date: row.timestamp,
                dateStr: row.dateStr,
                user: cleanUser,
                project: row.project,
                client: row.client,
                program: row.program,
                location: row.location,
                act: Math.round(row.act)
            });

            var progLower = (row.program || "").toLowerCase();
            var clientLower = (row.client || "").toLowerCase();
            if (!progLower.includes("internal") && !clientLower.includes("internal") && row.client && row.client !== "Unknown" && row.act > 0) {
                allTimeClientsMap[row.client] = (allTimeClientsMap[row.client] || 0) + row.act;
            }

            userMaxTimesheetMap[cleanUser] = Math.max(userMaxTimesheetMap[cleanUser] || 0, row.timestamp);

            if (!dimensionTable[row.project]) {
                dimensionTable[row.project] = {
                    client: row.client,
                    program: row.program,
                    location: row.location,
                    start: row.timestamp,
                    end: 0,
                    status: row.status,
                    est: 0,
                    quoted: 0
                };
            }
            dimensionTable[row.project].est = Math.max(dimensionTable[row.project].est, Math.round(row.est));
            dimensionTable[row.project].quoted = Math.max(dimensionTable[row.project].quoted, Math.round(row.quoted));
            dimensionTable[row.project].end = Math.max(dimensionTable[row.project].end, row.timestamp);
        });

        var topClients = Object.keys(allTimeClientsMap).map(c => ({
            name: c,
            val: Math.round(allTimeClientsMap[c])
        })).sort((a, b) => b.val - a.val).slice(0, 10);

        cleanRoster.forEach(emp => {
            if (emp.status === "Disabled" && emp.end === 0) emp.end = userMaxTimesheetMap[emp.name] || new Date().getTime();
            if (emp.status === "Enabled" && emp.end === 0) emp.end = Infinity;
        });

        // Compliance Calculation Engine Block
        var now = new Date();
        var checkDate = new Date(); checkDate.setHours(0,0,0,0);
        do { checkDate.setDate(checkDate.getDate() - 1); } while (checkDate.getDay() === 0 || checkDate.getDay() === 6);
        
        var lastWorkingDayTs = checkDate.getTime();
        var lastWeekStart = getMonday(now) - (7 * 86400000);
        var lastWeekEnd = getMonday(now) - 1;
        var dailyHoursMap = {};
        var lastWeekHoursMap = {};

        factTable.forEach(row => {
            if (row.date >= lastWeekStart && row.date <= lastWeekEnd) {
                lastWeekHoursMap[row.user] = (lastWeekHoursMap[row.user] || 0) + row.act;
            }
        });

        cleanDrafts.forEach(row => {
            var d1 = new Date(row.date);
            var d2 = new Date(lastWorkingDayTs);
            var isSameDay = d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
            if (isSameDay) dailyHoursMap[row.user] = (dailyHoursMap[row.user] || 0) + row.act;
        });

        var dailyList = []; var weeklyList = [];
        var dailyDeficitCount = 0; var weeklyDeficitCount = 0;

        cleanRoster.forEach(emp => {
            if (emp.status === "Enabled" && emp.start <= now.getTime()) {
                var loggedDaily = Math.round(dailyHoursMap[emp.name] || 0);
                var loggedWeekly = Math.round(lastWeekHoursMap[emp.name] || 0);
                if (loggedDaily === 0) dailyDeficitCount++;
                if (loggedWeekly === 0) weeklyDeficitCount++;
                dailyList.push({ name: emp.name, logged: loggedDaily, isCompliant: loggedDaily > 0 });
                weeklyList.push({ name: emp.name, logged: loggedWeekly, isCompliant: loggedWeekly > 0 });
            }
        });

        var sparkline = [];
        for (var i = 8; i >= 1; i--) {
            var wStart = getMonday(now) - (i * 7 * 86400000);
            var wEnd = wStart + (6 * 86400000) + 86399999;
            var activeInWeek = cleanRoster.filter(e => e.start <= wEnd && e.end >= wStart);
            var loggedInWeek = new Set();
            factTable.forEach(row => {
                if (row.date >= wStart && row.date <= wEnd && row.act > 0) loggedInWeek.add(row.user);
            });
            sparkline.push(Math.max(0, activeInWeek.length - loggedInWeek.size));
        }

        setDataMatrix({
            factTable,
            dimensionTable,
            roster: cleanRoster,
            drafts: cleanDrafts,
            timesheets: cleanTimesheets,
            topClients,
            compliance: { dailyDeficits: dailyDeficitCount, weeklyDeficits: weeklyDeficitCount, dailyList, weeklyList, sparkline }
        });
    }, []);

    var syncMatrixData = useCallback(async (force = false) => {
        setLoading(true);
        console.log("--------- FRONTEND DEBUG START ---------");
        
        try {
            if (force) {
                console.log("[DEBUG] Force Sync requested. Wiping local IndexedDB cache...");
                setStatusText('Clearing local cache...');
                await clearCache(); // Wipe the slate clean
            } else {
                console.log("[DEBUG] Normal load. Checking cache...");
            }

            var cached = force ? null : await loadCache();

            if (cached) {
                console.log("[DEBUG] Loaded existing data from local cache.");
                setStatusText('Compiling UI from Cache...');
                processStarSchema(cached);
            } else {
                console.log("[DEBUG] No cache found (or force wiped). Asking Server for live data...");
                setStatusText('Downloading Live Replicon Data...');
                
                // Add a random string to the URL to absolutely guarantee the browser doesn't cache the network request
                var result = await repliconApi.getDashboardData(`?nocache=${new Date().getTime()}`);
                
                console.log(`[DEBUG] Received Live Data from Server!`);
                console.log(`[DEBUG] Roster count: ${result.roster?.length}`);
                console.log(`[DEBUG] Drafts count (Deficits): ${result.drafts?.length}`);
                
                setStatusText('Saving to Local Database...');
                await saveCache(result);
                
                setStatusText('Crunching Matrix...');
                processStarSchema(result);
            }
        } catch (err) {
            console.error("[DEBUG] Frontend Sync Error:", err);
            setStatusText('Sync drop detected. Check gateway endpoint connection.');
        } finally {
            setLoading(false);
            console.log("--------- FRONTEND DEBUG END ---------");
        }
    }, [processStarSchema]);

    var logoutSession = useCallback(async () => {
        localStorage.removeItem('mds_dashboard_session');
        await clearCache();
        setSessionUser(null);
    }, []);

    useEffect(() => {
        var sessionData = localStorage.getItem('mds_dashboard_session');
        if (sessionData) {
            var session = JSON.parse(sessionData);
            if (new Date().getTime() < session.expiresAt) {
                setSessionUser(session.user);
                syncMatrixData();
            } else {
                logoutSession();
            }
        } else {
            setLoading(false);
        }
    }, [syncMatrixData, logoutSession]);

    return { loading, statusText, sessionUser, dataMatrix, syncMatrixData, logoutSession, setSessionUser };
}