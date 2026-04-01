import { useState, useMemo } from 'react'
import { ShieldCheck, Search, Filter, Download, Clock, User, Info } from 'lucide-react'
import { getOwnerAuditLog } from '../../../store/mockData'

export default function AuditLog() {
  const [logs, setLogs] = useState(getOwnerAuditLog())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState('all')

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
    <div className="audit-log-container">
      <div className="toolbar mb-16" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <div className="admin-search-wrap" style={{ flex: 1, maxWidth: '400px' }}>
            <Search size={14} className="admin-search-icon" />
            <input 
              className="form-input" 
              placeholder="Cari di log audit..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="form-select" 
            style={{ width: 'auto' }}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            {actionTypes.map(type => (
              <option key={type} value={type}>{type === 'all' ? 'Semua Aksi' : type.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={handleExport}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Waktu</th>
                <th style={{ width: '120px' }}>Aktor</th>
                <th style={{ width: '150px' }}>Aksi</th>
                <th>Deskripsi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center p-32 text-muted">Belum ada data log audit.</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-muted">
                      <div className="flex items-center gap-4">
                        <Clock size={12} />
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        <User size={12} className="text-primary" />
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
                          className="btn btn-ghost btn-sm p-4 ml-8" 
                          title="Lihat Detail"
                          onClick={() => alert(JSON.stringify(log.meta, null, 2))}
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
    </div>
  )
}
