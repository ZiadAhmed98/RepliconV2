import { Router }    from 'express';
import axios          from 'axios';
import crypto         from 'crypto';
import { requireAuth }                      from '../lib/auth.js';
import { logger, auditLog, readJSON,
         writeJSON, getMondayOf, calcHours,
         TIMESHEETS_FILE }                  from '../lib/helpers.js';
import db                                   from '../lib/db.js';

const router = Router();

// ── Graph token cache ─────────────────────────────────────────────────────────
let _graphToken       = null;
let _graphTokenExpiry = 0;

async function getGraphToken() {
  if (_graphToken && Date.now() < _graphTokenExpiry - 60000) return _graphToken;
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) return null;
  try {
    const res = await axios.post(
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({ grant_type: 'client_credentials', client_id: AZURE_CLIENT_ID, client_secret: AZURE_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    _graphToken       = res.data.access_token;
    _graphTokenExpiry = Date.now() + (res.data.expires_in * 1000);
    return _graphToken;
  } catch (err) {
    logger.error({ err: err.message }, 'Graph token acquisition failed');
    return null;
  }
}

async function graphGet(urlPath) {
  const token = await getGraphToken();
  if (!token) throw Object.assign(new Error('GRAPH_NOT_CONFIGURED'), { status: 503 });
  const res = await axios.get(`https://graph.microsoft.com/v1.0${urlPath}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/api/v1/graph/config', requireAuth, (req, res) => {
  const configured = !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
  const row     = db.prepare('SELECT msEmail FROM users WHERE id=?').get(req.user.id);
  const msEmail = row?.msEmail || null;
  res.json({ configured, msEmail, ready: configured && !!msEmail });
});

router.get('/api/v1/graph/calendar', requireAuth, async (req, res) => {
  try {
    const row     = db.prepare('SELECT msEmail FROM users WHERE id=?').get(req.user.id);
    const msEmail = row?.msEmail;
    if (!msEmail) return res.status(400).json({ error: 'No Microsoft email linked to your account. Ask your admin to add msEmail in Settings.' });

    const monday = getMondayOf(req.query.weekStart ? new Date(req.query.weekStart) : new Date());
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
    const start  = monday.toISOString();
    const end    = sunday.toISOString();

    const data = await graphGet(
      `/users/${encodeURIComponent(msEmail)}/calendarView` +
      `?startDateTime=${start}&endDateTime=${end}` +
      `&$select=id,subject,start,end,isOnlineMeeting,onlineMeetingProvider,attendees,bodyPreview,isCancelled` +
      `&$orderby=start/dateTime&$top=100`
    );

    const events = (data.value || []).filter(e => !e.isCancelled).map(e => ({
      id:        e.id,
      title:     e.subject || '(No title)',
      start:     e.start?.dateTime,
      end:       e.end?.dateTime,
      timezone:  e.start?.timeZone || 'UTC',
      isOnline:  !!e.isOnlineMeeting,
      provider:  e.onlineMeetingProvider,
      attendees: (e.attendees || []).map(a => a.emailAddress?.address).filter(Boolean),
      preview:   (e.bodyPreview || '').slice(0, 200),
      hours:     calcHours(e.start?.dateTime, e.end?.dateTime),
      source:    e.isOnlineMeeting ? 'teams' : 'calendar',
    }));

    res.json({ events, weekStart: monday.toISOString().split('T')[0] });
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: 'Microsoft Graph not configured. Add AZURE_* vars to .env' });
    logger.error({ err: err.message }, 'Graph calendar fetch failed');
    res.status(500).json({ error: 'Failed to fetch calendar: ' + err.message });
  }
});

router.get('/api/v1/timesheets/week', requireAuth, (req, res) => {
  const monday  = getMondayOf(req.query.weekStart ? new Date(req.query.weekStart) : new Date());
  const weekKey = monday.toISOString().split('T')[0];
  const data    = readJSON(TIMESHEETS_FILE, { entries: {}, submissions: {} });
  res.json({
    entries:   data.entries?.[req.user.id]?.[weekKey] || [],
    weekStart: weekKey,
    submitted: data.submissions?.[req.user.id]?.[weekKey] || null,
  });
});

router.post('/api/v1/timesheets/entry', requireAuth, (req, res) => {
  const { weekStart: rawWeekStart, entry } = req.body;
  if (!rawWeekStart || !entry) return res.status(400).json({ error: 'weekStart and entry required' });
  const monday    = getMondayOf(new Date(rawWeekStart + 'T12:00:00Z'));
  const weekStart = monday.toISOString().split('T')[0];
  const data      = readJSON(TIMESHEETS_FILE, { entries: {}, submissions: {} });
  if (!data.entries)                              data.entries = {};
  if (!data.entries[req.user.id])                data.entries[req.user.id] = {};
  if (!data.entries[req.user.id][weekStart])     data.entries[req.user.id][weekStart] = [];

  const list     = data.entries[req.user.id][weekStart];
  const existIdx = list.findIndex(e => e.id === entry.id);

  if (existIdx >= 0) {
    list[existIdx] = { ...list[existIdx], ...entry, updatedAt: new Date().toISOString() };
  } else {
    list.push({
      id:           entry.id || crypto.randomUUID(),
      date:         entry.date,
      title:        entry.title,
      source:       entry.source || 'manual',
      hours:        entry.hours || 0,
      startTime:    entry.startTime || null,
      endTime:      entry.endTime || null,
      project:      entry.project || null,
      client:       entry.client || null,
      category:     entry.category || 'other',
      notes:        entry.notes || '',
      status:       entry.status || 'pending',
      aiConfidence: entry.aiConfidence || null,
      aiReason:     entry.aiReason || null,
      calEventId:   entry.calEventId || null,
      createdAt:    new Date().toISOString(),
    });
  }

  writeJSON(TIMESHEETS_FILE, data);
  auditLog(req.user.id, 'TIMESHEET_ENTRY', { weekStart, entryId: entry.id });
  res.json({ ok: true, entry: list.find(e => e.id === entry.id) || entry });
});

router.delete('/api/v1/timesheets/entry/:id', requireAuth, (req, res) => {
  const { weekStart } = req.query;
  if (!weekStart) return res.status(400).json({ error: 'weekStart required' });
  const data = readJSON(TIMESHEETS_FILE, { entries: {}, submissions: {} });
  const list = data.entries?.[req.user.id]?.[weekStart];
  if (!list) return res.status(404).json({ error: 'No entries for that week' });
  const before = list.length;
  data.entries[req.user.id][weekStart] = list.filter(e => e.id !== req.params.id);
  if (data.entries[req.user.id][weekStart].length === before) return res.status(404).json({ error: 'Entry not found' });
  writeJSON(TIMESHEETS_FILE, data);
  res.json({ ok: true });
});

router.post('/api/v1/timesheets/submit', requireAuth, (req, res) => {
  const { weekStart } = req.body;
  if (!weekStart) return res.status(400).json({ error: 'weekStart required' });
  const data      = readJSON(TIMESHEETS_FILE, { entries: {}, submissions: {} });
  const entries   = data.entries?.[req.user.id]?.[weekStart] || [];
  const confirmed = entries.filter(e => e.status === 'confirmed');
  if (confirmed.length === 0) return res.status(400).json({ error: 'No confirmed entries to submit' });
  const totalHours = confirmed.reduce((s, e) => s + (e.hours || 0), 0);
  if (!data.submissions) data.submissions = {};
  if (!data.submissions[req.user.id]) data.submissions[req.user.id] = {};
  data.submissions[req.user.id][weekStart] = {
    submittedAt: new Date().toISOString(),
    totalHours:  Math.round(totalHours * 4) / 4,
    entryCount:  confirmed.length,
  };
  writeJSON(TIMESHEETS_FILE, data);
  auditLog(req.user.id, 'TIMESHEET_SUBMIT', { weekStart, totalHours, entryCount: confirmed.length });
  res.json({ ok: true, totalHours, entryCount: confirmed.length });
});

router.post('/api/v1/timesheets/import-ics', requireAuth, (req, res) => {
  try {
    const { icsText } = req.body;
    if (!icsText) return res.status(400).json({ error: 'icsText required' });

    const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');

    const parseICSDate = (raw) => {
      if (!raw) return null;
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.length < 8) return null;
      const y = digits.slice(0,4), mo = digits.slice(4,6), d = digits.slice(6,8);
      const h = digits.slice(8,10)||'00', mi = digits.slice(10,12)||'00';
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:00`);
    };

    const cutoffPast   = new Date(); cutoffPast.setDate(cutoffPast.getDate() - 90);
    const cutoffFuture = new Date(); cutoffFuture.setDate(cutoffFuture.getDate() + 60);

    const events  = [];
    const vevents = unfolded.split('BEGIN:VEVENT').slice(1);

    for (const block of vevents) {
      const get = (key) => {
        const m = block.match(new RegExp(`${key}(?:;[^:]*)?:([^\r\n]+)`));
        return m ? m[1].trim() : null;
      };
      const title   = get('SUMMARY');
      const startDt = parseICSDate(get('DTSTART'));
      const endDt   = parseICSDate(get('DTEND'));
      const uid     = get('UID');
      const desc    = get('DESCRIPTION') || '';
      const isOnline = (desc + block).toLowerCase().includes('teams') || block.toLowerCase().includes('onlinemeet');
      if (!title || !startDt) continue;
      if (startDt < cutoffPast || startDt > cutoffFuture) continue;
      events.push({
        id: uid || crypto.randomUUID(), title,
        start:     startDt.toISOString(),
        end:       endDt?.toISOString() || null,
        hours:     endDt ? calcHours(startDt.toISOString(), endDt.toISOString()) : 1,
        isOnline, source: isOnline ? 'teams' : 'calendar', attendees: [], preview: '',
      });
    }

    events.sort((a, b) => new Date(a.start) - new Date(b.start));
    logger.info({ total: vevents.length, imported: events.length }, 'ICS parsed');
    res.json({ events, total: vevents.length, source: 'ics' });
  } catch (err) {
    logger.error({ err: err.message }, 'ICS parse error');
    res.status(500).json({ error: 'Failed to parse ICS file: ' + err.message });
  }
});

router.post('/api/v1/ai/categorize', requireAuth, async (req, res) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured' });

  const { title, hours, attendees = [], source, projectList = [] } = req.body;
  const prompt = `You are a timesheet assistant for a professional services company called MDS (Midis Digital Services).

Classify this calendar activity into the most appropriate project and category.

Activity:
- Title: "${title}"
- Duration: ${hours}h
- Source: ${source} (calendar event or teams meeting)
- Attendees: ${attendees.slice(0, 10).join(', ') || 'none listed'}

Known projects: ${projectList.slice(0, 40).join(', ') || 'not provided'}

Rules:
- Words like "standup", "sync", "check-in", "1:1" → category: meeting
- Words like "training", "learning", "workshop" → category: training
- Words like "admin", "review", "planning" alone → category: admin
- Match project name from the known list if title mentions it
- If no project match, project = null

Respond ONLY with this exact JSON (no markdown, no explanation):
{"project":null,"client":null,"category":"meeting","confidence":0.7,"reason":"Short explanation"}`;

  try {
    const aiRes = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: prompt }] },
      { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } }
    );
    const raw  = aiRes.data.content[0]?.text || '{}';
    const json = raw.match(/\{[\s\S]*?\}/)?.[0];
    res.json(json ? JSON.parse(json) : { project: null, client: null, category: 'other', confidence: 0, reason: '' });
  } catch (err) {
    logger.error({ err: err.message }, 'AI categorize error');
    res.status(500).json({ error: 'AI categorization failed' });
  }
});

export default router;
