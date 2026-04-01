import { useState, useEffect } from 'react'
import { getStats, getCheckInLogs, getCurrentDay, getParticipants } from '../../store/mockData'
import { useRealtime, useSound } from '../../hooks/useRealtime'
import './TVDashboard.css'

export default function TVDashboard() {
  const currentDay = getCurrentDay()
  const [stats, setStats] = useState(getStats(currentDay))
  const [logs, setLogs] = useState(getCheckInLogs(currentDay))
  const [latestEntry, setLatestEntry] = useState(null)
  const [showLatest, setShowLatest] = useState(false)
  const { lastEvent } = useRealtime()
  const { playNotification } = useSound()
  const [refreshKey, setRefreshKey] = useState(0)
  const [time, setTime] = useState(new Date())

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto refresh
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 1500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setStats(getStats(currentDay))
    setLogs(getCheckInLogs(currentDay))
  }, [currentDay, refreshKey])

  // Handle new check-ins with big animation
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'check_in') {
      playNotification()
      setLatestEntry(lastEvent)
      setShowLatest(true)
      setStats(getStats(currentDay))
      setLogs(getCheckInLogs(currentDay))

      setTimeout(() => setShowLatest(false), 4000)
    }
  }, [lastEvent])

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  }

  const percentage = stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0
  const circumference = 2 * Math.PI * 120
  const dashOffset = circumference - (percentage / 100) * circumference

  return (
    <div className="tv-dashboard">
      {/* Background Effects */}
      <div className="tv-bg-effects">
        <div className="tv-bg-gradient g1"></div>
        <div className="tv-bg-gradient g2"></div>
        <div className="tv-racing-lines"></div>
      </div>

      {/* Header */}
      <header className="tv-header">
        <div className="tv-header-left">
          <img src="/yamaha-logo.svg" alt="Yamaha" className="tv-logo" />
          <div className="tv-header-divider"></div>
          <div>
            <h1 className="tv-event-title">EVENT GATE SCANNER</h1>
            <div className="tv-event-subtitle">Live Attendance Monitoring</div>
          </div>
        </div>
        <div className="tv-header-right">
          <div className="tv-day-badge">
            <span className="tv-day-dot"></span>
            HARI {currentDay}
          </div>
          <div className="tv-clock">
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="tv-content">
        {/* Left: Big Counter */}
        <div className="tv-main-counter">
          <div className="tv-counter-ring">
            <svg viewBox="0 0 260 260" className="tv-ring-svg">
              <circle cx="130" cy="130" r="120" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle
                cx="130" cy="130" r="120" fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 130 130)"
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E60012" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="tv-counter-inner">
              <div className="tv-counter-checked">{stats.checkedIn}</div>
              <div className="tv-counter-slash">/</div>
              <div className="tv-counter-total">{stats.total}</div>
            </div>
          </div>
          <div className="tv-counter-label">PESERTA HADIR</div>
          <div className="tv-counter-percentage">{Math.round(percentage)}%</div>

          {/* Category mini stats */}
          <div className="tv-category-grid">
            {Object.entries(stats.byCategory).map(([cat, data]) => (
              <div key={cat} className="tv-category-item">
                <div className="tv-category-name">{cat}</div>
                <div className="tv-category-count">
                  {data.checkedIn}<span>/{data.total}</span>
                </div>
                <div className="tv-category-bar">
                  <div className="tv-category-bar-fill" style={{
                    width: `${data.total > 0 ? (data.checkedIn / data.total) * 100 : 0}%`,
                    background: cat === 'VIP' ? '#E60012' : cat === 'Dealer' ? '#3B82F6' : cat === 'Media' ? '#F59E0B' : '#10B981'
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Feed */}
        <div className="tv-feed-section">
          <div className="tv-feed-header">
            <h2>LIVE CHECK-IN FEED</h2>
            <div className="tv-live-indicator">
              <span className="tv-live-dot"></span>
              LIVE
            </div>
          </div>
          <div className="tv-feed-list">
            {logs.length === 0 ? (
              <div className="tv-feed-empty">
                <div className="tv-feed-empty-icon">📡</div>
                <div>Menunggu peserta check-in...</div>
              </div>
            ) : (
              logs.slice(0, 8).map((log, i) => (
                <div key={log.id} className={`tv-feed-item ${i === 0 ? 'latest' : ''}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="tv-feed-avatar">
                    {getInitials(log.participant_name)}
                  </div>
                  <div className="tv-feed-info">
                    <div className="tv-feed-name">{log.participant_name}</div>
                    <div className="tv-feed-meta">
                      <span className={`tv-feed-badge ${log.participant_category.toLowerCase()}`}>
                        {log.participant_category}
                      </span>
                      {log.participant_ticket}
                    </div>
                  </div>
                  <div className="tv-feed-time">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="tv-feed-check">✓</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Entry Popup */}
      {showLatest && latestEntry && (
        <div className="tv-new-entry-overlay">
          <div className="tv-new-entry-card">
            <div className="tv-new-entry-icon">✅</div>
            <div className="tv-new-entry-label">PESERTA BARU CHECK-IN</div>
            <div className="tv-new-entry-name">{latestEntry.participant.name}</div>
            <div className="tv-new-entry-meta">
              {latestEntry.participant.ticket_id} · {latestEntry.participant.category}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Ticker */}
      <div className="tv-ticker">
        <div className="tv-ticker-content">
          <span className="tv-ticker-yamaha">YAMAHA EVENT</span>
          <span className="tv-ticker-sep">•</span>
          <span>Hari {currentDay}</span>
          <span className="tv-ticker-sep">•</span>
          <span>{stats.checkedIn} dari {stats.total} peserta sudah hadir</span>
          <span className="tv-ticker-sep">•</span>
          <span>Tingkat kehadiran: {Math.round(percentage)}%</span>
          <span className="tv-ticker-sep">•</span>
          {Object.entries(stats.byCategory).map(([cat, data]) => (
            <span key={cat}>{cat}: {data.checkedIn}/{data.total} <span className="tv-ticker-sep">•</span> </span>
          ))}
          <span>Selamat datang di Event Yamaha!</span>
        </div>
      </div>
    </div>
  )
}
