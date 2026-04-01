import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px 20px', minHeight: '100vh', background: '#0A0A0F', color: '#F0F0F5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#16161F', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%' }}>
            <h2 style={{ color: '#EF4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ Aplikasi Crash
            </h2>
            <p style={{ color: '#9CA3AF', marginBottom: 16, fontSize: '0.9rem' }}>
              Terjadi kesalahan sistem saat memuat komponen ini. Mohon screenshot pesan di bawah ini dan berikan ke developer.
            </p>
            <div style={{ background: '#000', padding: 12, borderRadius: 8, overflowX: 'auto', marginBottom: 20 }}>
              <pre style={{ color: '#EF4444', fontSize: '0.75rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              style={{ background: '#E60012', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600, width: '100%', cursor: 'pointer' }}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
