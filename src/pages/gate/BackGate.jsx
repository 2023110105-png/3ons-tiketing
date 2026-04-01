import { useState, useEffect } from 'react'
import { getStats, getCheckInLogs, getCurrentDay, getParticipants } from '../../store/mockData'
import { useRealtime, useSound } from '../../hooks/useRealtime'
import { Radio } from 'lucide-react'

export default function BackGate() {
  const currentDay = getCurrentDay()
  const [stats, setStats] = useState(getStats(currentDay))
  const [logs, setLogs] = useState(getCheckInLogs(currentDay))
  const [newEntries, setNewEntries] = useState(new Set())
  const { lastEvent } = useRealtime()
  const { playNotification } = useSound()
  const [refreshKey, setRefreshKey] = useState(0)

  // Refresh stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setStats(getStats(currentDay))
    setLogs(getCheckInLogs(currentDay))
  }, [currentDay, refreshKey])

  // Handle realtime events
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'check_in') {
      playNotification()
      setStats(getStats(currentDay))
      setLogs(getCheckInLogs(currentDay))
      
      // Mark as new for animation
      setNewEntries(prev => {
        const next = new Set(prev)
        next.add(lastEvent.log.id)
        return next
      })

      // Remove "new" status after 5 seconds
      setTimeout(() => {
        setNewEntries(prev => {
          const next = new Set(prev)
          next.delete(lastEvent.log.id)
          return next
        })
      }, 5000)
    }
  }, [lastEvent])

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  }

  const timeSince = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (diff < 5) return 'Baru saja'
    if (diff < 60) return `${diff} detik lalu`
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
    return new Date(timestamp).toLocaleTimeString('id-ID')
  }

  return (
    <div className="monitor-container">
      {/* Big Counter */}
      <div className="monitor-counter animate-fade-in-up">
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Live Attendance — Hari {currentDay}
        </div>
        <div className="monitor-counter-value">
          <span>{stats.checkedIn}</span> / {stats.total}
        </div>
        <div className="monitor-counter-label">
          Peserta sudah check-in
        </div>
        <div className="progress-bar mt-16" style={{ maxWidth: 400, margin: '16px auto 0' }}>
          <div className="progress-bar-fill" style={{ width: `${stats.percentage}%` }}></div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>
          {stats.percentage}% kehadiran
        </div>
      </div>

      {/* Category Stats */}
      <div className="stats-grid mb-24">
        {Object.entries(stats.byCategory).map(([cat, data]) => (
          <div key={cat} className="stat-card">
            <div className="stat-card-label" style={{ marginBottom: 4 }}>{cat}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
              {data.checkedIn}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/{data.total}</span>
            </div>
            <div className="progress-bar mt-8">
              <div className="progress-bar-fill" style={{
                width: `${data.total > 0 ? (data.checkedIn / data.total) * 100 : 0}%`,
                background: cat === 'VIP' ? 'var(--yamaha-red)' : cat === 'Dealer' ? 'var(--info)' : cat === 'Media' ? 'var(--warning)' : 'var(--success)'
              }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Feed */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Check-in Feed</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }}></div>
            <span className="badge badge-green">Real-time</span>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon animate-float"><Radio size={40} /></div>
            <h3>Menunggu peserta check-in...</h3>
            <p>Notifikasi akan muncul secara real-time ketika peserta di-scan oleh panitia depan</p>
          </div>
        ) : (
          <div className="monitor-feed">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`monitor-feed-item ${newEntries.has(log.id) ? 'new' : ''}`}
              >
                <div className="monitor-feed-item-avatar">
                  {getInitials(log.participant_name)}
                </div>
                <div className="monitor-feed-item-info">
                  <div className="monitor-feed-item-name">{log.participant_name}</div>
                  <div className="monitor-feed-item-meta">
                    <span className={`badge ${
                      log.participant_category === 'VIP' ? 'badge-red' :
                      log.participant_category === 'Dealer' ? 'badge-blue' :
                      log.participant_category === 'Media' ? 'badge-yellow' : 'badge-gray'
                    }`} style={{ marginRight: 6 }}>
                      {log.participant_category}
                    </span>
                    {log.participant_ticket}
                  </div>
                </div>
                <div className="monitor-feed-item-time">
                  {timeSince(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
