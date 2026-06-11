import { useNavigate } from 'react-router-dom';

export default function SettingsLayout({ title, subtitle, accent = '#818cf8', children }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '32px', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'inherit', maxWidth: '920px' }}>

      {/* Back button */}
      <button
        onClick={() => navigate('/administration')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: '0 0 24px 0' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
      >
        <i className="bx bx-arrow-back" style={{ fontSize: '15px' }} />
        Back to Administration
      </button>

      {/* Title row */}
      <div style={{ marginBottom: subtitle ? '6px' : '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '4px', height: '26px', borderRadius: '4px', background: accent, flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{title}</h1>
        </div>
        {subtitle && (
          <p style={{ margin: '6px 0 0 14px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{subtitle}</p>
        )}
      </div>

      {subtitle && <div style={{ marginBottom: '24px' }} />}

      {children}
    </div>
  );
}
