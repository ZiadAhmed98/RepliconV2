import { useNavigate } from 'react-router-dom';

export default function SettingsLayout({ title, subtitle, accent = '#818cf8', children }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '32px', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'inherit', maxWidth: '900px' }}>
      <button
        onClick={() => navigate('/administration')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: '0 0 20px 0' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
      >
        <i className="bx bx-arrow-back" style={{ fontSize: '14px' }} />
        Back to Administration
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '4px', height: '28px', borderRadius: '4px', background: accent, flexShrink: 0 }} />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{title}</h1>
      </div>
      {subtitle && (
        <p style={{ margin: '4px 0 28px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.38)' }}>{subtitle}</p>
      )}

      {children}
    </div>
  );
}
