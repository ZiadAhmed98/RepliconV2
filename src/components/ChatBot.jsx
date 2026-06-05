import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './ChatBot.module.css';

const SUGGESTIONS = [
  'Give me a full team health summary',
  'Who has capacity for a new project?',
  'Which projects are at risk of going over budget?',
  'Forecast completion dates for active projects',
  "Who hasn't submitted timesheets this week?",
  'Which client generates the most hours?',
  'Who is underutilized right now?',
  'Who should I assign to a new engagement?',
];

// ── Markdown renderer ────────────────────────────────────────────────────────

function parseInline(text, keyPrefix = '') {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[0].startsWith('**'))     parts.push(<strong key={keyPrefix + idx++}>{match[2]}</strong>);
    else if (match[0].startsWith('*')) parts.push(<em      key={keyPrefix + idx++}>{match[3]}</em>);
    else                               parts.push(<code    key={keyPrefix + idx++} className={styles.inlineCode}>{match[4]}</code>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

function parseTableRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

function isSepRow(cells) {
  return cells.every(c => /^:?-+:?$/.test(c));
}

function renderMarkdown(text) {
  if (!text) return null;
  const lines      = text.split('\n');
  const elements   = [];
  let listItems    = [];
  let listType     = null;
  let tableLines   = [];
  let listKey      = 0;
  let elKey        = 0;

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    elements.push(
      <Tag key={`lst-${listKey++}`} className={styles.mdList}>
        {listItems.map((item, j) => (
          <li key={j} className={styles.mdLi}>{parseInline(item, `li${j}-`)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType  = null;
  };

  const flushTable = () => {
    if (!tableLines.length) return;
    const rows   = tableLines.map(parseTableRow);
    const sepIdx = rows.findIndex(isSepRow);
    const header = rows[0];
    const body   = sepIdx >= 0 ? rows.slice(sepIdx + 1) : rows.slice(1);
    elements.push(
      <div key={`tbl-${elKey++}`} className={styles.tableWrapper}>
        <table className={styles.mdTable}>
          <thead>
            <tr>
              {header.map((cell, j) => (
                <th key={j} className={styles.mdTh}>{parseInline(cell, `th${j}-`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.filter(r => !isSepRow(r)).map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? styles.mdTrEven : styles.mdTrOdd}>
                {row.map((cell, j) => (
                  <td key={j} className={styles.mdTd}>{parseInline(cell, `td${i}-${j}-`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|')) {
      flushList();
      tableLines.push(line);
      continue;
    }

    flushTable();

    if (/^#{1,3}\s/.test(line)) {
      flushList();
      elements.push(
        <div key={elKey++} className={styles.mdHeading}>
          {parseInline(line.replace(/^#+\s/, ''), `h${elKey}-`)}
        </div>
      );
    } else if (/^[-*+]\s/.test(line)) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(line.replace(/^[-*+]\s/, ''));
    } else if (/^\d+\.\s/.test(line)) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(line.replace(/^\d+\.\s+/, ''));
    } else if (/^-{3,}$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={elKey++} className={styles.mdHr} />);
    } else if (trimmed === '') {
      flushList();
      if (elements.length) elements.push(<div key={elKey++} className={styles.mdSpacer} />);
    } else {
      flushList();
      elements.push(
        <div key={elKey++} className={styles.mdLine}>
          {parseInline(line, `ln${elKey}-`)}
        </div>
      );
    }
  }

  flushList();
  flushTable();
  return elements;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className={styles.typingDots}>
      <span /><span /><span />
    </div>
  );
}

function Message({ msg, isStreaming, feedback, onFeedback }) {
  const isUser     = msg.role === 'user';
  const showDots   = !isUser && isStreaming && !msg.content;
  const isComplete = !isUser && !isStreaming && !!msg.content;

  return (
    <div className={`${styles.msgRow} ${isUser ? styles.msgRowUser : styles.msgRowAi}`}>
      {!isUser && <div className={styles.aiAvatar}><i className="bx bx-chip" /></div>}

      <div className={isUser ? null : styles.msgContent}>
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi}`}>
          {showDots
            ? <TypingDots />
            : isUser
              ? msg.content
              : renderMarkdown(msg.content)}
        </div>

        {isComplete && (
          <div className={styles.feedbackRow}>
            {!feedback && <span className={styles.feedbackLabel}>Helpful?</span>}
            <button
              className={`${styles.feedbackBtn} ${feedback === 'up' ? styles.feedbackUp : ''}`}
              onClick={() => onFeedback?.('up')}
              title="Good answer"
              disabled={!!feedback}
            >
              <i className="bx bx-like" />
            </button>
            <button
              className={`${styles.feedbackBtn} ${feedback === 'down' ? styles.feedbackDown : ''}`}
              onClick={() => onFeedback?.('down')}
              title="Needs improvement"
              disabled={!!feedback}
            >
              <i className="bx bx-dislike" />
            </button>
            {feedback && (
              <span className={styles.feedbackThanks}>
                {feedback === 'up' ? 'Thanks!' : 'Noted — will improve.'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatBot({ dataMatrix }) {
  const [open,        setOpen]        = useState(false);
  const [input,       setInput]       = useState('');
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // ── Build comprehensive context ────────────────────────────────────────────
  const context = useMemo(() => {
    if (!dataMatrix) return {};
    const { factTable = [], dimensionTable = {}, roster = [], compliance = {}, topClients = [] } = dataMatrix;

    const now   = Date.now();
    const ms30  = 30 * 86400000;
    const ms7   =  7 * 86400000;
    const EXPECTED_30D = 176;

    const hrs30 = {}, hrs7 = {}, empProjects = {};
    factTable.forEach(r => {
      if (r.act <= 0) return;
      if (r.date >= now - ms30) hrs30[r.user] = (hrs30[r.user] || 0) + r.act;
      if (r.date >= now - ms7)  hrs7[r.user]  = (hrs7[r.user]  || 0) + r.act;
      if (!empProjects[r.user]) empProjects[r.user] = new Set();
      empProjects[r.user].add(r.project);
    });

    const activeEmployees = roster
      .filter(e => e.status === 'Enabled')
      .map(e => {
        const h30 = Math.round(hrs30[e.name] || 0);
        return {
          name:            e.name,
          hoursLast30d:    h30,
          hoursLast7d:     Math.round(hrs7[e.name] || 0),
          utilizationPct:  Math.round((h30 / EXPECTED_30D) * 100),
          currentProjects: [...(empProjects[e.name] || [])],
          dailyCompliant:  (compliance.dailyList  || []).find(c => c.name === e.name)?.isCompliant ?? null,
          weeklyCompliant: (compliance.weeklyList || []).find(c => c.name === e.name)?.isCompliant ?? null,
        };
      })
      .sort((a, b) => b.hoursLast30d - a.hoursLast30d);

    const projects = Object.entries(dimensionTable).map(([name, d]) => {
      const allHrs    = factTable.filter(r => r.project === name).reduce((s, r) => s + r.act, 0);
      const recent30  = factTable.filter(r => r.project === name && r.date >= now - ms30).reduce((s, r) => s + r.act, 0);
      const burnPerDay = recent30 / 30;
      const remaining  = d.est - allHrs;
      return {
        name,
        client:                 d.client,
        status:                 d.status,
        estimatedHrs:           Math.round(d.est),
        actualHrs:              Math.round(allHrs),
        remainingHrs:           Math.round(remaining),
        burnPct:                d.est > 0 ? Math.round((allHrs / d.est) * 100) : 0,
        recentHrsLast30d:       Math.round(recent30),
        burnRateHrsPerDay:      Math.round(burnPerDay * 10) / 10,
        forecastDaysToComplete: burnPerDay > 0 && remaining > 0 ? Math.round(remaining / burnPerDay) : null,
        isOverBudget:           d.est > 0 && allHrs > d.est,
        isAtRisk:               d.est > 0 && allHrs / d.est > 0.8 && allHrs <= d.est,
      };
    })
    .filter(p => p.actualHrs > 0 || p.estimatedHrs > 0)
    .sort((a, b) => b.burnPct - a.burnPct);

    const nonCompliantDaily  = (compliance.dailyList  || []).filter(c => !c.isCompliant).map(c => c.name);
    const nonCompliantWeekly = (compliance.weeklyList || []).filter(c => !c.isCompliant).map(c => c.name);

    return {
      asOf: new Date().toISOString(),
      summary: {
        totalActiveEmployees: activeEmployees.length,
        totalProjects:        projects.length,
        activeProjects:       projects.filter(p => !['Completed','Archived','Cancelled'].includes(p.status)).length,
        overBudgetProjects:   projects.filter(p => p.isOverBudget).length,
        atRiskProjects:       projects.filter(p => p.isAtRisk).length,
        avgUtilizationPct:    Math.round(activeEmployees.reduce((s, e) => s + e.utilizationPct, 0) / (activeEmployees.length || 1)),
      },
      activeEmployees,
      inactiveEmployees: roster.filter(e => e.status === 'Disabled').map(e => ({ name: e.name })),
      projects,
      compliance: {
        dailyDeficits:    compliance.dailyDeficits,
        weeklyDeficits:   compliance.weeklyDeficits,
        nonCompliantDaily,
        nonCompliantWeekly,
      },
      topClients: (topClients || []).map(c => ({ name: c.name, totalHrs: Math.round(c.val) })),
    };
  }, [dataMatrix]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const sendFeedback = useCallback((msgIndex, rating) => {
    setFeedbackMap(prev => ({ ...prev, [msgIndex]: rating }));
    const aiMsg   = history[msgIndex];
    const userMsg = history[msgIndex - 1];
    fetch('/api/v1/chat/feedback', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, question: userMsg?.content || '', answer: aiMsg?.content || '' }),
    }).catch(() => {});
  }, [history]);

  // ── Send (streaming) ───────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const prevHistory = history;
    setInput('');
    setError(null);
    setHistory(h => [...h, { role: 'user', content: msg }, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      const response = await fetch('/api/v1/chat', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: prevHistory.filter(m => m.content), context }),
      });

      if (!response.ok || !response.body) {
        let errMsg = `Server error ${response.status}`;
        try { const d = await response.json(); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break outer;

          let parsed;
          try { parsed = JSON.parse(raw); } catch { continue; }

          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            setHistory(h => {
              const next = [...h];
              next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + parsed.text };
              return next;
            });
          }
        }
      }
    } catch (e) {
      setError(e.message);
      setHistory(h => {
        const next = [...h];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          next[next.length - 1] = { role: 'assistant', content: `Sorry — ${e.message}` };
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [input, history, context, loading]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => { setHistory([]); setError(null); setFeedbackMap({}); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Ask AI Assistant"
      >
        <i className={`bx ${open ? 'bx-x' : 'bx-chat'}`} />
        {!open && history.length === 0 && <span className={styles.fabPulse} />}
      </button>

      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><i className="bx bx-chip" /></div>
            <div>
              <div className={styles.headerTitle}>AI Assistant</div>
              <div className={styles.headerSub}>Claude · Live data · Ask anything</div>
            </div>
          </div>
          <div className={styles.headerActions}>
            {history.length > 0 && (
              <button className={styles.iconBtn} onClick={clearChat} title="Clear chat">
                <i className="bx bx-trash" />
              </button>
            )}
            <button className={styles.iconBtn} onClick={() => setOpen(false)} title="Close">
              <i className="bx bx-x" />
            </button>
          </div>
        </div>

        <div className={styles.messages}>
          {history.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><i className="bx bx-brain" /></div>
              <p>Ask me anything — people, projects, budgets, compliance, forecasts, recommendations. I have your live data.</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className={styles.suggestion} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {history.map((msg, i) => (
            <Message
              key={i}
              msg={msg}
              isStreaming={loading && i === history.length - 1}
              feedback={feedbackMap[i]}
              onFeedback={msg.role === 'assistant' ? (rating) => sendFeedback(i, rating) : null}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your workforce…"
            rows={1}
            disabled={loading}
          />
          <button
            className={styles.sendBtn}
            onClick={() => send()}
            disabled={!input.trim() || loading}
            title="Send (Enter)"
          >
            <i className={`bx ${loading ? 'bx-loader-alt bx-spin' : 'bx-send'}`} />
          </button>
        </div>
        <div className={styles.inputHint}>Enter to send · Shift+Enter for new line</div>
      </div>

      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}
    </>
  );
}
