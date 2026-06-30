import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  report = () => {
    const err = this.state.error;
    window.dispatchEvent(new CustomEvent('mds:report-issue', {
      detail: {
        category: 'bug',
        severity: 'high',
        subject: `Error: ${err?.message || 'a page failed to render'}`.slice(0, 160),
        clientError: String(err?.stack || err?.message || '').slice(0, 2000),
      },
    }));
  };

  render() {
    if (this.state.hasError) {
      const btn = (bg, bd, col) => ({
        padding: '8px 18px', borderRadius: '9px',
        background: bg, border: `1px solid ${bd}`, color: col,
        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
      });
      return (
        <div style={{
          margin: '24px auto', maxWidth: '460px',
          padding: '32px 28px', background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px',
          textAlign: 'center',
        }}>
          <i className='bx bx-error-circle' style={{ fontSize: '2.4rem', display: 'block', marginBottom: '10px', color: '#fca5a5' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9', marginBottom: '6px' }}>
            {this.props.name ? `${this.props.name} couldn’t be displayed` : 'Something went wrong'}
          </div>
          <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            The rest of the app is still working. You can retry, or let us know so we can fix it.
          </div>
          {this.state.error?.message && (
            <div style={{ fontSize: '0.72rem', color: 'rgba(248,113,113,0.7)', fontFamily: 'monospace', marginTop: '8px', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              style={btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.15)', '#f1f5f9')}>
              <i className='bx bx-refresh' /> Retry
            </button>
            <button onClick={this.report}
              style={btn('rgba(139,92,246,0.15)', 'rgba(139,92,246,0.35)', '#c4b5fd')}>
              <i className='bx bx-lifebuoy' /> Report this issue
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
