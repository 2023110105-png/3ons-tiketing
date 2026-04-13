import { useState } from 'react'
import { ClipboardList, Filter, Download } from 'lucide-react'

export default function AdminAudit() {
  const [logs] = useState([
    { id: 1, action: 'LOGIN', user: 'admin@example.com', details: 'User login', timestamp: '2026-04-13 15:30:00' },
    { id: 2, action: 'CHECKIN', user: 'gate@example.com', details: 'Participant check-in: T120260001', timestamp: '2026-04-13 15:25:00' },
    { id: 3, action: 'EXPORT', user: 'admin@example.com', details: 'Exported participant data', timestamp: '2026-04-13 15:20:00' },
    { id: 4, action: 'CREATE', user: 'owner@example.com', details: 'Created new tenant', timestamp: '2026-04-13 15:15:00' },
    { id: 5, action: 'UPDATE', user: 'admin@example.com', details: 'Updated event settings', timestamp: '2026-04-13 15:10:00' },
  ])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.action !== filter) return false
    if (searchTerm && !log.details.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'User', 'Details'].join(','),
      ...filteredLogs.map(log => [log.timestamp, log.action, log.user, log.details].join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="owner-audit">
      <div className="owner-section-header">
        <h3>Audit Log</h3>
        <button className="owner-btn-secondary" onClick={exportLogs}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="owner-filters">
        <div className="owner-search">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="owner-filter-group">
          <Filter size={16} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="CHECKIN">Check-in</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="EXPORT">Export</option>
          </select>
        </div>
      </div>

      <div className="owner-table-container">
        <table className="owner-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id}>
                <td className="owner-timestamp">{log.timestamp}</td>
                <td>
                  <span className={`owner-badge ${log.action.toLowerCase()}`}>{log.action}</span>
                </td>
                <td>{log.user}</td>
                <td>{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLogs.length === 0 && (
        <div className="owner-empty">
          <ClipboardList size={48} />
          <p>No audit logs found</p>
        </div>
      )}
    </div>
  )
}
