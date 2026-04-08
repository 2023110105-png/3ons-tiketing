import { Link } from 'react-router-dom'
import { AlertTriangle, Smartphone } from 'lucide-react'

function normalizeStatus(status) {
  return String(status || '').toLowerCase()
}

export default function WaConnectBanner({ wa, title = 'WhatsApp belum siap', className = '' }) {
  const status = normalizeStatus(wa?.status)
  const isReady = !!wa?.isReady
  if (isReady) return null

  const statusLabel = status ? status.toUpperCase() : '-'
  const isOffline = status === 'offline' || status === 'disconnected'
  const message = isOffline
    ? 'WhatsApp belum tersambung. Sambungkan dulu perangkat untuk menjalankan kirim massal / retry.'
    : 'WhatsApp sedang disiapkan. Tunggu sampai status siap sebelum menjalankan kirim massal / retry.'

  return (
    <div className={`card wa-connect-banner ${className}`.trim()} role="status" aria-live="polite">
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {title}
        </h3>
        <div className="badge badge-gray text-xs">Status: {statusLabel}</div>
      </div>
      <div className="admin-note" style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ color: 'var(--text-muted)' }}>{message}</div>
          </div>
          <Link to="/admin/connect" className="btn btn-primary btn-inline-icon">
            <Smartphone size={14} /> Sambungkan perangkat
          </Link>
        </div>
      </div>
    </div>
  )
}

