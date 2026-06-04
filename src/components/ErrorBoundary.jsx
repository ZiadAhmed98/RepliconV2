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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px', background: 'rgba(255,59,48,0.06)',
          border: '1px solid rgba(255,59,48,0.2)', borderRadius: '16px',
          textAlign: 'center', color: '#ff3b30',
        }}>
          <i className='bx bx-error-circle' style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }} />
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            {this.props.name ? `${this.props.name} failed to render` : 'Something went wrong'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,59,48,0.7)' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '12px', padding: '6px 16px', borderRadius: '8px',
              background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
              color: '#ff3b30', cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
