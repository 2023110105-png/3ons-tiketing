import { useState } from 'react'
import { Settings, Database, Shield, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'

export default function AdminSystem() {
  const [health] = useState({
    supabase: { status: 'connected', lastPing: '2s ago' },
    storage: { status: 'healthy', used: '12%', total: '100%' },
    security: { status: 'secure', ssl: true, auth: true }
  })
  const [isChecking, setIsChecking] = useState(false)

  const runHealthCheck = () => {
    setIsChecking(true)
    setTimeout(() => {
      setIsChecking(false)
    }, 2000)
  }

  return (
    <div className="owner-system">
      {/* Health Status */}
      <div className="owner-section">
        <div className="owner-section-header">
          <div>
            <span className="owner-section-kicker">Status Sistem</span>
            <h3 className="owner-section-title-sm">Health Overview</h3>
          </div>
          <button className="owner-btn-secondary" onClick={runHealthCheck} disabled={isChecking}>
            <RefreshCw size={16} className={isChecking ? 'owner-spin' : ''} />
            {isChecking ? 'Memeriksa...' : 'Periksa Sekarang'}
          </button>
        </div>

        <div className="owner-health-grid">
          <div className="owner-health-card">
            <div className="owner-health-icon green"><Database size={20} /></div>
            <div className="owner-health-info">
              <span className="owner-health-label">Database</span>
              <span className="owner-health-status">{health.supabase.status}</span>
              <span className="owner-health-meta">Last ping: {health.supabase.lastPing}</span>
            </div>
          </div>

          <div className="owner-health-card">
            <div className="owner-health-icon blue"><Shield size={20} /></div>
            <div className="owner-health-info">
              <span className="owner-health-label">Security</span>
              <span className="owner-health-status">{health.security.status}</span>
              <span className="owner-health-meta">
                SSL: {health.security.ssl ? 'On' : 'Off'} • Auth: {health.security.auth ? 'On' : 'Off'}
              </span>
            </div>
          </div>

          <div className="owner-health-card">
            <div className="owner-health-icon orange"><Database size={20} /></div>
            <div className="owner-health-info">
              <span className="owner-health-label">Storage</span>
              <span className="owner-health-status">{health.storage.used} used</span>
              <span className="owner-health-meta">Total: {health.storage.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="owner-section">
        <div className="owner-section-subheader">
          <span className="owner-section-kicker">Pemeliharaan</span>
          <h3 className="owner-section-title-sm">Tindakan Perawatan</h3>
        </div>
        <div className="owner-actions-list">
          <div className="owner-action-row">
            <div className="owner-action-info">
              <Database size={18} />
              <div>
                <span className="owner-action-name">Clear Cache</span>
                <span className="owner-action-desc">Clear local and server cache</span>
              </div>
            </div>
            <button className="owner-btn-secondary">Clear</button>
          </div>

          <div className="owner-action-row">
            <div className="owner-action-info">
              <RefreshCw size={18} />
              <div>
                <span className="owner-action-name">Sync Data</span>
                <span className="owner-action-desc">Force sync all data with Supabase</span>
              </div>
            </div>
            <button className="owner-btn-secondary">Sync Now</button>
          </div>

          <div className="owner-action-row">
            <div className="owner-action-info">
              <Shield size={18} />
              <div>
                <span className="owner-action-name">Security Scan</span>
                <span className="owner-action-desc">Run security vulnerability check</span>
              </div>
            </div>
            <button className="owner-btn-secondary">Scan</button>
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="owner-section">
        <div className="owner-section-subheader">
          <span className="owner-section-kicker">Informasi</span>
          <h3 className="owner-section-title-sm">Environment</h3>
        </div>
        <div className="owner-info-list">
          <div className="owner-info-row">
            <span className="owner-info-label">Platform Version</span>
            <span className="owner-info-value">v1.0.0</span>
          </div>
          <div className="owner-info-row">
            <span className="owner-info-label">Node Environment</span>
            <span className="owner-info-value">production</span>
          </div>
          <div className="owner-info-row">
            <span className="owner-info-label">Data Backend</span>
            <span className="owner-info-value">Supabase</span>
          </div>
          <div className="owner-info-row">
            <span className="owner-info-label">Last Deploy</span>
            <span className="owner-info-value">2026-04-13</span>
          </div>
        </div>
      </div>
    </div>
  )
}
