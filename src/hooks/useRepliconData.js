import { useState, useEffect, useCallback, useRef } from 'react';
import { repliconApi } from '../api/replicon';
import { CACHE_STALE_AFTER_MS } from '../constants/index.js';

const DB_NAME   = 'MDS_Premium_DB_v3';
const STORE_NAME = 'dashboard_cache';

function initDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject('IndexedDB unsupported');
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror   = (e) => reject(e.target.error);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
  });
}

async function saveCache(data) {
  try {
    const db = await initDB();
    return new Promise((res) => {
      const tx  = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).put({ data, savedAt: Date.now() }, 'cached_matrix');
      tx.oncomplete = () => res(true);
    });
  } catch { return false; }
}

async function loadCache() {
  try {
    const db = await initDB();
    return new Promise((res) => {
      const tx  = db.transaction([STORE_NAME], 'readonly');
      const req = tx.objectStore(STORE_NAME).get('cached_matrix');
      req.onsuccess = (e) => {
        const row = e.target.result;
        if (!row) return res(null);
        const age = Date.now() - (row.savedAt || 0);
        if (age > CACHE_STALE_AFTER_MS) return res(null); // treat stale cache as miss
        res(row.data);
      };
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

async function clearCache() {
  try {
    const db = await initDB();
    return new Promise((res) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => res(true);
    });
  } catch { return false; }
}

// 7.3 — Web Worker for heavy star-schema processing
function createWorker() {
  try {
    return new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
  } catch { return null; }
}

const EMPTY_MATRIX = {
  factTable: [], dimensionTable: {}, roster: [], drafts: [], timesheets: [],
  topClients: [], compliance: { dailyDeficits: 0, weeklyDeficits: 0, dailyList: [], weeklyList: [], sparkline: [] },
  dictionaries: { departments: [], locations: [], programs: [], clients: [], users: [] },
  accountManagers: [],
};

export function useRepliconData(externalSessionUser) {
  const [loading,    setLoading]    = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');
  const [dataMatrix, setDataMatrix] = useState(EMPTY_MATRIX);
  const [lastSynced, setLastSynced] = useState(null);
  const workerRef = useRef(null);

  // Inline star-schema processor (fallback when Worker isn't available)
  const processInline = useCallback((rawData) => {
    const EXCLUDED = (import.meta.env.VITE_EXCLUDED_USERS || 'Habib Matta,Ziad Shafik,Irfan Najmi,Admin,Admin ')
      .split(',').map(s => s.trim()).filter(Boolean);
    const getMonday = (d) => { d = new Date(d); const day = d.getDay(); return new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))).setHours(0,0,0,0); };

    const dimensionTable = {}; const factTable = []; const allTimeClientsMap = {}; const userMaxTsMap = {};
    const cleanRoster = (rawData.roster||[]).filter(e => !EXCLUDED.includes((e.name||'').trim()));
    const cleanDrafts = (rawData.drafts||[]).filter(d => !EXCLUDED.includes((d.user||'').trim()));
    const cleanTs     = (rawData.timesheets||[]).filter(t => !EXCLUDED.includes((t.user||'').trim()));

    (rawData.cube||[]).forEach(row => {
      const u = (row.user||'').trim();
      if (EXCLUDED.includes(u)) return;
      factTable.push({ date: row.timestamp, dateStr: row.dateStr, user: u, project: row.project, client: row.client, program: row.program, location: row.location, act: Math.round(row.act) });
      const prog = (row.program||'').toLowerCase(), client = (row.client||'').toLowerCase();
      if (!prog.includes('internal') && !client.includes('internal') && row.client && row.client !== 'Unknown' && row.act > 0)
        allTimeClientsMap[row.client] = (allTimeClientsMap[row.client]||0) + row.act;
      userMaxTsMap[u] = Math.max(userMaxTsMap[u]||0, row.timestamp);
      if (!dimensionTable[row.project]) dimensionTable[row.project] = { client: row.client, program: row.program, location: row.location, start: row.timestamp, end: 0, status: row.status, est: 0, quoted: 0 };
      dimensionTable[row.project].est    = Math.max(dimensionTable[row.project].est,    Math.round(row.est));
      dimensionTable[row.project].quoted = Math.max(dimensionTable[row.project].quoted, Math.round(row.quoted));
      dimensionTable[row.project].end    = Math.max(dimensionTable[row.project].end,    row.timestamp);
    });

    const topClients = Object.keys(allTimeClientsMap).map(c => ({ name: c, val: Math.round(allTimeClientsMap[c]) })).sort((a,b)=>b.val-a.val).slice(0,10);
    cleanRoster.forEach(emp => {
      if (emp.status==='Disabled' && emp.end===0) emp.end = userMaxTsMap[emp.name] || Date.now();
      if (emp.status==='Enabled'  && emp.end===0) emp.end = Infinity;
    });

    const now = new Date(); const checkDate = new Date(); checkDate.setHours(0,0,0,0);
    do { checkDate.setDate(checkDate.getDate()-1); } while (checkDate.getDay()===0||checkDate.getDay()===6);
    const lwdTs = checkDate.getTime(); const lwStart = getMonday(now) - 7*86400000; const lwEnd = getMonday(now) - 1;
    const dailyMap = {}; const weeklyMap = {};
    factTable.forEach(r => { if (r.date>=lwStart && r.date<=lwEnd) weeklyMap[r.user] = (weeklyMap[r.user]||0)+r.act; });
    cleanDrafts.forEach(r => { const d1=new Date(r.date), d2=new Date(lwdTs); if(d1.getFullYear()===d2.getFullYear()&&d1.getMonth()===d2.getMonth()&&d1.getDate()===d2.getDate()) dailyMap[r.user]=(dailyMap[r.user]||0)+r.act; });
    const dailyList=[]; const weeklyList=[]; let dailyDef=0, weeklyDef=0;
    cleanRoster.forEach(emp => {
      if (emp.status==='Enabled' && emp.start<=now.getTime()) {
        const ld=Math.round(dailyMap[emp.name]||0), lw=Math.round(weeklyMap[emp.name]||0);
        if (!ld) dailyDef++; if (!lw) weeklyDef++;
        dailyList.push({ name:emp.name, logged:ld, isCompliant:ld>0 });
        weeklyList.push({ name:emp.name, logged:lw, isCompliant:lw>0 });
      }
    });
    const sparkline = [];
    for (let i=8;i>=1;i--) { const wS=getMonday(now)-i*7*86400000, wE=wS+6*86400000+86399999; const active=cleanRoster.filter(e=>e.start<=wE&&e.end>=wS); const logged=new Set(); factTable.forEach(r=>{if(r.date>=wS&&r.date<=wE&&r.act>0)logged.add(r.user);}); sparkline.push(Math.max(0,active.length-logged.size)); }

    return { factTable, dimensionTable, roster:cleanRoster, drafts:cleanDrafts, timesheets:cleanTs, topClients, compliance:{dailyDeficits:dailyDef,weeklyDeficits:weeklyDef,dailyList,weeklyList,sparkline}, dictionaries:rawData.dictionaries||{departments:[],locations:[],programs:[],clients:[],users:[]}, accountManagers:rawData.accountManagers||[] };
  }, []);

  const applyMatrix = useCallback((result) => {
    setDataMatrix(result);
    setLastSynced(Date.now());
  }, []);

  const processWithWorker = useCallback((rawData) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        try { resolve(processInline(rawData)); } catch (e) { reject(e); }
        return;
      }
      const worker = workerRef.current;
      worker.onmessage = (e) => { if (e.data.ok) resolve(e.data.data); else reject(new Error(e.data.error)); };
      worker.onerror   = (e) => reject(e);
      worker.postMessage(rawData);
    });
  }, [processInline]);

  const syncMatrixData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) { setStatusText('Clearing cache...'); await clearCache(); }
      const cached = force ? null : await loadCache();

      if (cached) {
        setStatusText('Loading from cache...');
        const result = await processWithWorker(cached);
        applyMatrix(result);
      } else {
        setStatusText('Connecting to Replicon...');
        const rawData = await repliconApi.getDashboardData((type) => {
          const labels = { dictionaries:'Dictionaries loaded', roster:'Roster loaded', drafts:'Drafts loaded', cube:'Cube processing...', timesheets:'Timesheets loaded' };
          if (labels[type]) setStatusText(labels[type]);
        });
        setStatusText('Saving to local database...');
        await saveCache(rawData);
        setStatusText('Building analytics matrix...');
        const result = await processWithWorker(rawData);
        applyMatrix(result);
      }
    } catch (err) {
      console.error('[useRepliconData] Sync error:', err);
      setStatusText('Sync failed. Check your connection.');
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [processWithWorker, applyMatrix]);

  // Init worker on mount
  useEffect(() => {
    workerRef.current = createWorker();
    return () => { workerRef.current?.terminate(); };
  }, []);

  // Listen for unauthorized events (from replicon.js interceptor)
  useEffect(() => {
    const handler = () => { setDataLoaded(false); setDataMatrix(EMPTY_MATRIX); };
    window.addEventListener('mds:unauthorized', handler);
    return () => window.removeEventListener('mds:unauthorized', handler);
  }, []);

  useEffect(() => {
    if (externalSessionUser && !dataLoaded) syncMatrixData();
    if (!externalSessionUser) { setDataLoaded(false); setDataMatrix(EMPTY_MATRIX); }
  }, [externalSessionUser, dataLoaded, syncMatrixData]);

  const isEffectivelyLoading = loading || (!!externalSessionUser && !dataLoaded);

  return { loading: isEffectivelyLoading, statusText, dataMatrix, syncMatrixData, lastSynced };
}
