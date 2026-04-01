import { useState, useEffect } from 'react'
import { getStats, getCheckInLogs, getCurrentDay, getPendingCheckIns, getOfflineQueueHistory, getMaxPendingAttempts } from '../../store/mockData'
import { useRealtime, useSound } from '../../hooks/useRealtime'
import { Radio, WifiOff, CircleHelp } from 'lucide-react'
import { exportOfflineQueueReportToCSV } from '../../utils/csvExport'

export default function BackGate() {
  const currentDay = getCurrentDay()
  const [showLimitInfo, setShowLimitInfo] = useState(false)
  const [isLimitInfoFading, setIsLimitInfoFading] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const { lastEvent } = useRealtime()
  const { playNotification } = useSound()
  const [refreshKey, setRefreshKey] = useState(0)

  void refreshKey
  const stats = getStats(currentDay)
  const logs = getCheckInLogs(currentDay)
  const pendingItems = getPendingCheckIns()

  // Refresh stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showLimitInfo) return
    const fadeTimer = setTimeout(() => setIsLimitInfoFading(true), 4650)
    const hideTimer = setTimeout(() => {
      setShowLimitInfo(false)
      setIsLimitInfoFading(false)
    }, 5000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [showLimitInfo])

  // Handle realtime events
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'check_in') {
      playNotification()
    }
  }, [lastEvent, playNotification])

  const handleToggleLimitInfo = () => {
    setShowLimitInfo((prev) => {
      if (!prev) {
        setIsLimitInfoFading(false)
      }
      return !prev
    })
  }

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  }

  const timeSince = (timestamp) => {
    const diff = Math.floor((nowTs - new Date(timestamp).getTime()) / 1000)
    if (diff < 5) return 'Baru saja'
    if (diff < 60) return `${diff} detik lalu`
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
    return new Date(timestamp).toLocaleTimeString('id-ID')
  }

  const getLimitBadgeClass = () => {
    const limit = getMaxPendingAttempts()
    if (limit <= 3) return 'badge-red'
    if (limit <= 5) return 'badge-yellow'
    return 'badge-green'
  }

  const getLimitBadgeInfo = () => {
    const limit = getMaxPendingAttempts()
    if (limit <= 3) return `Merah: limit ${limit}x, risiko purge cepat.`
    if (limit <= 5) return `Kuning: limit ${limit}x, risiko sedang.`
    return `Hijau: limit ${limit}x, lebih aman sebelum purge.`
  }

  const handleExportOfflineReport = async () => {
    await exportOfflineQueueReportToCSV(getPendingCheckIns(), getOfflineQueueHistory(1000))
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
                background: cat === 'VIP' ? 'var(--brand-primary)' : cat === 'Dealer' ? 'var(--info)' : cat === 'Media' ? 'var(--warning)' : 'var(--success)'
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
                className={`monitor-feed-item ${lastEvent?.log?.id === log.id ? 'new' : ''}`}
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WifiOff size={16} /> Offline Queue Monitor
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-yellow">{pendingItems.length} pending</span>
            <span className={`badge ${getLimitBadgeClass()}`}>
              Limit: {getMaxPendingAttempts()}x
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleToggleLimitInfo} title="Info warna retry limit">
              <CircleHelp size={12} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleExportOfflineReport}>Export</button>
          </div>
        </div>
        {showLimitInfo && (
          <div style={{
            padding: '0 14px 10px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            opacity: isLimitInfoFading ? 0 : 1,
            transition: 'opacity 0.35s ease'
          }}>
            {getLimitBadgeInfo()}
          </div>
        )}
        {pendingItems.length === 0 ? (
          <div style={{ padding: 14, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Tidak ada antrean offline saat ini.
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {pendingItems.slice(0, 20).map(item => (
              <div key={item.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {new Date(item.created_at).toLocaleString('id-ID')}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    source: {item.source} · attempts: {item.attempts || 0}
                  </div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--warning)', textAlign: 'right' }}>
                  {item.last_error || 'Menunggu sinkronisasi'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
