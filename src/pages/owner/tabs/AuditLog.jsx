import { useState, useMemo } from 'react'
import { Search, Download, Clock, User, Info } from 'lucide-react'
import { getOwnerAuditLog } from '../../../store/mockData'

function formatMetaForViewer(meta) {
  try {
    return JSON.stringify(meta, null, 2)
  } catch {
    return String(meta)
  }
}

export default function AuditLog() {
  const [logs] = useState(getOwnerAuditLog())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [metaDetail, setMetaDetail] = useState(null)

  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => {
        if (filterAction === 'all') return true
        return log.action.includes(filterAction)
      })
      .filter(log => {
        const q = searchQuery.toLowerCase().trim()
        return !q || 
               log.description.toLowerCase().includes(q) || 
               log.actor.toLowerCase().includes(q) ||
               log.action.toLowerCase().includes(q)
      })
  }, [logs, filterAction, searchQuery])

  const actionTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.action.split('_')[0]))
    return ['all', ...Array.from(types)]
  }, [logs])

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Actor,Action,Description\n"
      + filteredLogs.map(l => `${l.timestamp},${l.actor},${l.action},"${l.description.replace(/"/g, '""')}"`).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `owner_audit_log_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="audit-log-container owner-fade-in-up">
      <div className="owner-tab-intro">
        <span className="page-kicker">Kepatuhan</span>
        <h2>Riwayat aktivitas pemilik</h2>
        <p>Ringkasan aksi dari akun pemilik platform: siapa, kapan, dan apa yang berubah. Unduh CSV untuk lampiran audit internal atau eksternal.</p>
      </div>
      <div className="owner-toolbar">
        <div className="owner-toolbar-left">
          <div className="owner-search-input" style={{ flex: 1, maxWidth: '400px' }}>
            <Search size={16} />
            <input 
              className="owner-form-input" 
              placeholder="Cari di riwayat aktivitas..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="owner-form-select" 
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            {actionTypes.map(type => (
              <option key={type} value={type}>{type === 'all' ? 'Semua Aksi' : type.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="owner-toolbar-right">
          <button type="button" className="btn btn-ghost" onClick={handleExport} title="Unduh sebagai CSV">
            <Download size={18} /> Unduh CSV
          </button>
        </div>
      </div>

      <div className="owner-card-container" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="owner-card-header" style={{ borderRadius: 0 }}>
          <div className="owner-card-title">Log aktivitas</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredLogs.length} catatan</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="owner-data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Aksi</th>
                <th>Deskripsi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Belum ada riwayat aktivitas
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600' }}>
                        <User size={14} style={{ color: 'var(--brand-primary)' }} />
                        {log.actor}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray text-xs">{log.action.toUpperCase()}</span>
                    </td>
                    <td className="text-sm">
                      {log.description}
                      {log.meta && (
                        <button 
                          type="button"
                          className="btn btn-ghost btn-sm p-4 ml-8" 
                          title="Lihat rincian tambahan"
                          onClick={() => setMetaDetail(log.meta)}
                        >
                          <Info size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {metaDetail != null && (
        <div className="modal-overlay" onClick={() => setMetaDetail(null)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="audit-meta-title">
            <div className="modal-header">
              <h3 id="audit-meta-title" className="modal-title">Rincian tambahan</h3>
              <button type="button" className="modal-close" onClick={() => setMetaDetail(null)} aria-label="Tutup">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="card-subtitle-hint" style={{ marginBottom: 12 }}>
                Ringkasan teknis untuk keperluan audit. Berikan ke tim pendukung hanya jika diminta.
              </p>
              <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 280, margin: 0, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                {formatMetaForViewer(metaDetail)}
              </pre>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setMetaDetail(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
