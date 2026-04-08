import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetail: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const detail = this.state.error && String(this.state.error)
      return (
        <div style={{ padding: '30px 20px', minHeight: '100vh', background: '#0A0A0F', color: '#F0F0F5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#16161F', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%' }}>
            <h2 style={{ color: '#EF4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              Terjadi gangguan tampilan
            </h2>
            <p style={{ color: '#9CA3AF', marginBottom: 16, fontSize: '0.9rem' }}>
              Halaman tidak bisa ditampilkan dengan benar. Coba muat ulang. Jika masalah berulang, hubungi tim pendukung dan sebutkan apa yang Anda lakukan sebelum muncul pesan ini.
            </p>
            {detail && (
              <>
                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(156, 163, 175, 0.4)',
                    color: '#9CA3AF',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    marginBottom: 12,
                    width: '100%'
                  }}
                >
                  {this.state.showDetail ? 'Sembunyikan detail untuk tim pendukung' : 'Tampilkan detail untuk tim pendukung'}
                </button>
                {this.state.showDetail && (
                  <div style={{ background: '#000', padding: 12, borderRadius: 8, overflowX: 'auto', marginBottom: 20 }}>
                    <pre style={{ color: '#EF4444', fontSize: '0.75rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {detail}
                    </pre>
                  </div>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: '#E60012', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600, width: '100%', cursor: 'pointer', marginTop: detail ? 8 : 0 }}
            >
              Muat ulang halaman
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
