import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import styles from './AIInsights.module.css';
import { baseChartOptions } from '../utils/chartTheme';
import { CHART_COLORS } from '../constants/index.js';

const SEV_META = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',    icon: 'bx-error-circle' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)',   icon: 'bx-error'        },
  positive: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.3)',   icon: 'bx-check-shield' },
  info:     { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    border: 'rgba(6,182,212,0.3)',    icon: 'bx-info-circle'  },
};

function MiniChart({ type, data }) {
  if (!data || !data.length) return null;
  const base = baseChartOptions({ chart: { background: 'transparent', toolbar: { show: false }, sparkline: { enabled: true } }, tooltip: { enabled: false } });
  if (type === 'radialBar') {
    return (
      <Chart type="radialBar" height={90} width={90}
        series={[data[0]?.value || 0]}
        options={{ ...base, plotOptions: { radialBar: { hollow: { size: '55%' }, dataLabels: { name: { show: false }, value: { fontSize: '14px', fontWeight: 700, color: '#a78bfa', offsetY: 5 } } } }, colors: ['#8b5cf6'] }} />
    );
  }
  if (type === 'donut') {
    return (
      <Chart type="donut" height={90} width={90}
        series={[data[0]?.value || 60, 100 - (data[0]?.value || 60)]}
        options={{ ...base, colors: ['#8b5cf6', 'rgba(255,255,255,0.05)'], legend: { show: false }, dataLabels: { enabled: false }, plotOptions: { pie: { donut: { size: '60%' } } } }} />
    );
  }
  if (type === 'bar' || type === 'line') {
    const series = [{ data: data.map(d => d.value) }];
    return (
      <Chart type={type} height={80} width="100%"
        series={series}
        options={{ ...base, xaxis: { categories: data.map(d => d.label), labels: { style: { fontSize: '9px', colors: '#71717a' } } }, colors: ['#8b5cf6'], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.8, opacityTo: 0.3 } }, stroke: { width: 2, curve: 'smooth' }, grid: { show: false } }} />
    );
  }
  return null;
}

export default function AIInsights({ dataMatrix }) {
  const [insights,    setInsights]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [source,      setSource]      = useState(null);
  const [fbCount,     setFbCount]     = useState(0);
  const [feedback,    setFeedback]    = useState({});   // { [type]: 'up'|'down' }
  const [lastUpdated, setLastUpdated] = useState(null);

  // Build summary payload from dataMatrix
  const summary = useMemo(() => {
    if (!dataMatrix) return null;
    const { factTable = [], dimensionTable = {}, compliance = {}, topClients = [], roster = [] } = dataMatrix;
    const now = new Date();
    const cmStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const pmStart = new Date(now.getFullYear(), now.getMonth()-1, 1).getTime();
    const pmEnd   = cmStart - 1;

    const cmFacts = factTable.filter(r => r.date >= cmStart);
    const pmFacts = factTable.filter(r => r.date >= pmStart && r.date <= pmEnd);
    const actualHrs   = Math.round(cmFacts.reduce((s,r)=>s+r.act,0));
    const billableHrs = Math.round(cmFacts.filter(r=>!(r.program||'').toLowerCase().includes('internal')).reduce((s,r)=>s+r.act,0));

    // Rough capacity: roster size × working days × 8
    const workDays = (() => { let d=0; const s=new Date(cmStart),e=new Date(); while(s<=e){if(s.getDay()!==0&&s.getDay()!==6)d++;s.setDate(s.getDate()+1);} return d; })();
    const totalCapacityHrs = roster.filter(r=>(r.status||'').toLowerCase()==='enabled').length * workDays * 8;

    const activeProjects = Object.keys(dimensionTable).filter(p => {
      const s = (dimensionTable[p].status||'').toLowerCase();
      return !s.includes('archived') && !s.includes('completed');
    });
    const overBudget = activeProjects.filter(p => {
      const d = dimensionTable[p];
      const act = factTable.filter(r=>r.project===p).reduce((s,r)=>s+r.act,0);
      return d.est > 0 && act > d.est;
    });
    const atRiskProjects = overBudget.map(p => {
      const d = dimensionTable[p];
      const act = factTable.filter(r=>r.project===p).reduce((s,r)=>s+r.act,0);
      return { name: p, burn: Math.round((act/d.est)*100) };
    }).sort((a,b)=>b.burn-a.burn).slice(0,5);

    const rolloffs = (dataMatrix.rolloffs || []);
    const cmPrevHrs = Math.round(pmFacts.reduce((s,r)=>s+r.act,0));

    return {
      actualHrs, billableHrs, totalCapacityHrs,
      activeProjectCount: activeProjects.length,
      atRiskProjects,
      complianceDailyDeficits: compliance.dailyDeficits || 0,
      complianceWeeklyDeficits: compliance.weeklyDeficits || 0,
      topClients: (topClients || []).slice(0,5).map(c=>({ name:c.name, val:Math.round(c.val) })),
      rosterSize: roster.length,
      rolloffs: rolloffs.slice(0,3).map(r=>({ name:r.name, end:r.end, engineers:r.engineers?.length||0 })),
      momHoursChange: cmPrevHrs > 0 ? Math.round(((actualHrs-cmPrevHrs)/cmPrevHrs)*100) : null,
    };
  }, [dataMatrix]);

  // On mount: load cached insights (auto-generated on server)
  useEffect(() => {
    fetch('/api/v1/insights/cached', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.insights?.length > 0) {
          setInsights(data.insights);
          setSource(data.source);
          setLastUpdated(
            data.generatedAt
              ? new Date(data.generatedAt).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
              : 'cached'
          );
        }
      })
      .catch(() => {});
  }, []);

  // Whenever data matrix loads, push the summary to the server so the
  // hourly auto-generate has fresh data to work with
  useEffect(() => {
    if (!summary) return;
    fetch('/api/v1/insights/cache-summary', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    }).catch(() => {});
  }, [summary]);

  const generate = useCallback(async () => {
    if (!summary) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/v1/insights/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      setInsights(data.insights || []);
      setSource(data.source);
      setFbCount(data.feedbackCount || 0);
      setLastUpdated(new Date().toLocaleTimeString());
      setFeedback({});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [summary]);

  const sendFeedback = useCallback(async (type, helpful) => {
    setFeedback(prev => ({ ...prev, [type]: helpful ? 'up' : 'down' }));
    try {
      await fetch('/api/v1/insights/feedback', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, helpful }),
      });
    } catch { /* ignore */ }
  }, []);

  // Build mini chart data for each insight
  const buildChartData = (insight) => {
    if (!dataMatrix) return [];
    if (insight.type === 'utilization') {
      const u = summary?.totalCapacityHrs > 0 ? Math.round((summary.actualHrs/summary.totalCapacityHrs)*100) : 0;
      return [{ value: u }];
    }
    if (insight.type === 'billable_ratio') {
      const b = summary?.actualHrs > 0 ? Math.round((summary.billableHrs/summary.actualHrs)*100) : 0;
      return [{ value: b }];
    }
    if (insight.type === 'budget_risk') {
      return (summary?.atRiskProjects || []).slice(0,5).map(p => ({ label: p.name.slice(0,10), value: p.burn }));
    }
    if (insight.type === 'compliance') {
      return (dataMatrix.compliance?.sparkline || []).map((v,i) => ({ label:`W-${8-i}`, value:v }));
    }
    if (insight.type === 'client_concentration') {
      return (summary?.topClients || []).slice(0,4).map(c => ({ label: c.name.slice(0,8), value: c.val }));
    }
    return [];
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <i className='bx bx-brain' /> AI Insights
          </h1>
          <p className={styles.subtitle}>
            AI-powered analytics that learn from your feedback.
            {fbCount > 0 && <span className={styles.learningBadge}><i className='bx bx-trending-up' /> Trained on {fbCount} ratings</span>}
          </p>
        </div>
        <div className={styles.headerRight}>
          {lastUpdated && <span className={styles.lastUpdated}><i className='bx bx-time-five' /> {lastUpdated}</span>}
          {source && (
            <span className={styles.sourceBadge}>
              <i className={`bx ${source.startsWith('claude') ? 'bx-chip' : 'bx-code-alt'}`} />
              {source.startsWith('claude') ? 'Claude AI' : 'Algorithmic'}
              {source.endsWith('-auto') && <span style={{marginLeft:4,opacity:0.7,fontSize:'10px'}}>· auto</span>}
            </span>
          )}
          <button className={styles.generateBtn} onClick={generate} disabled={loading || !summary}>
            {loading ? <><i className='bx bx-loader-alt bx-spin' /> Analyzing…</> : <><i className='bx bx-refresh' /> Generate Insights</>}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!loading && insights.length === 0 && !error && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><i className='bx bx-brain' /></div>
          <h3>No insights yet</h3>
          <p>Click "Generate Insights" to analyze your workforce data and surface actionable recommendations.</p>
          <button className={styles.generateBtn} onClick={generate} disabled={!summary}>
            <i className='bx bx-sparkles' /> Analyze Now
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={styles.errorBanner}>
          <i className='bx bx-error-circle' /> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className={styles.grid}>
          {[...Array(6)].map((_,i) => (
            <div key={i} className={styles.cardSkeleton}>
              <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: '6px' }} />
              <div className="skeleton" style={{ height: '60px', borderRadius: '8px', marginTop: '12px' }} />
              <div className="skeleton" style={{ height: '10px', width: '80%', borderRadius: '4px', marginTop: '12px' }} />
              <div className="skeleton" style={{ height: '10px', width: '50%', borderRadius: '4px', marginTop: '6px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Insights grid */}
      {!loading && insights.length > 0 && (
        <div className={styles.grid}>
          {insights.map((insight, i) => {
            const sev = SEV_META[insight.severity] || SEV_META.info;
            const chartData = buildChartData(insight);
            const myFeedback = feedback[insight.type];
            return (
              <div key={i} className={styles.card} style={{ '--sev-color': sev.color, '--sev-bg': sev.bg, '--sev-border': sev.border, animationDelay: `${i * 0.07}s` }}>
                {/* Card header */}
                <div className={styles.cardHeader}>
                  <div className={styles.sevBadge} style={{ background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}>
                    <i className={`bx ${sev.icon}`} />
                    {insight.severity}
                  </div>
                  <div className={styles.fbBtns}>
                    <button
                      className={`${styles.fbBtn} ${myFeedback === 'up' ? styles.fbActive : ''}`}
                      onClick={() => sendFeedback(insight.type, true)}
                      title="This was helpful"
                    ><i className='bx bx-like' /></button>
                    <button
                      className={`${styles.fbBtn} ${myFeedback === 'down' ? styles.fbActiveDown : ''}`}
                      onClick={() => sendFeedback(insight.type, false)}
                      title="Not relevant"
                    ><i className='bx bx-dislike' /></button>
                  </div>
                </div>

                {/* Title + body */}
                <h3 className={styles.cardTitle}>{insight.title}</h3>
                <p className={styles.cardBody}>{insight.body}</p>

                {/* Key metric */}
                {insight.metric && (
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>{insight.metric.label}</span>
                    <span className={styles.metricValue} style={{ color: sev.color }}>{insight.metric.value}</span>
                  </div>
                )}

                {/* Mini chart */}
                {chartData.length > 0 && (
                  <div className={styles.miniChart}>
                    <MiniChart type={insight.chartSuggestion} data={chartData} />
                  </div>
                )}

                {/* Feedback confirmation */}
                {myFeedback && (
                  <div className={styles.fbConfirm}>
                    <i className={`bx ${myFeedback === 'up' ? 'bx-check' : 'bx-x'}`} />
                    {myFeedback === 'up' ? 'Marked helpful — AI will show more like this' : 'Marked irrelevant — AI will de-prioritize this'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
