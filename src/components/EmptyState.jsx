import React from 'react';

const PRESETS = {
  noData:      { icon: 'bx-bar-chart-alt-2', title: 'No data available',        sub: 'Try adjusting your filters or syncing data.' },
  noPending:   { icon: 'bx-check-double',    title: "You're all caught up",     sub: 'No timesheets are pending approval.' },
  noProjects:  { icon: 'bx-folder-open',     title: 'No projects found',        sub: 'Create a project or change your filters.' },
  noEmployees: { icon: 'bx-user-x',          title: 'No employees found',       sub: 'No active employees match the current selection.' },
  noSearch:    { icon: 'bx-search-alt',      title: 'No results',               sub: 'Try a different search term.' },
  error:       { icon: 'bx-error-circle',    title: 'Something went wrong',     sub: 'Check the console or try syncing again.' },
};

export default function EmptyState({
  preset = 'noData',
  title, sub, icon,
  action, actionLabel = 'Take action',
  style = {},
}) {
  const p = PRESETS[preset] || PRESETS.noData;
  const resolvedIcon  = icon  || p.icon;
  const resolvedTitle = title || p.title;
  const resolvedSub   = sub   || p.sub;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 40px', textAlign: 'center', gap: '12px',
      ...style,
    }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '4px',
      }}>
        <i className={`bx ${resolvedIcon}`} style={{ fontSize: '2rem', color: '#a855f7', opacity: 0.8 }} />
      </div>
      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>{resolvedTitle}</div>
      <div style={{ color: '#8e8e93', fontSize: '0.88rem', maxWidth: '320px', lineHeight: 1.5 }}>{resolvedSub}</div>
      {action && (
        <button
          onClick={action}
          style={{
            marginTop: '8px', padding: '9px 22px', borderRadius: '100px',
            background: '#a855f7', border: 'none', color: '#fff',
            fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
