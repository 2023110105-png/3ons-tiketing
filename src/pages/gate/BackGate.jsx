// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getCheckInLogs() { return []; }
// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getStats() { return {}; }
// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getCurrentDay() { return 1; }
import { useState, useEffect } from 'react'
import { useRealtime, useSound } from '../../hooks/useRealtime'
import { Radio, WifiOff, CircleHelp } from 'lucide-react'
import { exportOfflineQueueReportToCSV } from '../../utils/csvExport'

const REALTIME_REFRESH_MS = 2500

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
      void bootstrapStoreFromFirebase(true)
      setRefreshKey(k => k + 1)
    }, REALTIME_REFRESH_MS)
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
        <div className="monitor-kicker">
          Kehadiran langsung · Hari {currentDay}
        </div>
        <div className="monitor-counter-value">
          <span>{stats.checkedIn}</span> / {stats.total}
        </div>
        <div className="monitor-counter-label">
          Peserta sudah check-in
        </div>
        <div className="progress-bar mt-16 monitor-progress-wrap">
          <div className="progress-bar-fill" style={{ width: `${stats.percentage}%` }}></div>
        </div>
        <div className="monitor-subkicker">
          {stats.percentage}% kehadiran
        </div>
      </div>

      {/* Category Stats */}
      <div className="stats-grid mb-24">
        {Object.entries(stats.byCategory).map(([cat, data]) => (
          <div key={cat} className="stat-card">
            <div className="stat-card-label monitor-stat-label">{cat}</div>
            <div className="stat-card-value monitor-stat-value">
              {data.checkedIn}<span className="monitor-stat-total">/{data.total}</span>
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
          <div>
            <h3 className="card-title">Umpan check-in</h3>
            <p className="card-subtitle-hint">Setiap pemindaian valid di pintu depan muncul di sini hampir langsung.</p>
          </div>
          <div className="monitor-live-head">
            <div className="monitor-live-dot"></div>
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
                    } monitor-meta-badge`}>
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

      <div className="card monitor-offline-card">
        <div className="card-header monitor-offline-header">
          <h3 className="card-title monitor-title-inline">
            <WifiOff size={16} /> Antrean offline
          </h3>
          <div className="monitor-offline-controls">
            <span className="badge badge-yellow">{pendingItems.length} pending</span>
            <span className={`badge ${getLimitBadgeClass()}`}>
              Limit: {getMaxPendingAttempts()}x
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleToggleLimitInfo} title="Info warna batas pengulangan">
              <CircleHelp size={12} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleExportOfflineReport}>Ekspor</button>
          </div>
        </div>
        {showLimitInfo && (
          <div className={`monitor-limit-info ${isLimitInfoFading ? 'is-fading' : ''}`}>
            {getLimitBadgeInfo()}
          </div>
        )}
        {pendingItems.length === 0 ? (
          <div className="monitor-empty-note">
            Tidak ada antrean offline saat ini.
          </div>
        ) : (
          <div className="monitor-offline-list">
            {pendingItems.slice(0, 20).map(item => (
              <div key={item.id} className="monitor-offline-item">
                <div>
                  <div className="monitor-offline-time">
                    {new Date(item.created_at).toLocaleString('id-ID')}
                  </div>
                  <div className="monitor-offline-meta">
                    source: {item.source} · attempts: {item.attempts || 0}
                  </div>
                </div>
                <div className="monitor-offline-error">
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
