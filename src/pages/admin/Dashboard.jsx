import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { getStats, getCheckInLogs, getCurrentDay, simulateCheckIns } from '../../store/mockData'
import { Users, UserCheck, Clock, TrendingUp, Zap, ClipboardList } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

export default function Dashboard() {
  const currentDay = getCurrentDay()
  const [refreshKey, setRefreshKey] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  void refreshKey
  const stats = getStats(currentDay)
  const logs = getCheckInLogs(currentDay)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const handleSimulate = () => simulateCheckIns(5)

  const getCategoryToneClass = (category) => {
    if (category === 'VIP') return 'dashboard-activity-avatar-vip'
    if (category === 'Dealer') return 'dashboard-activity-avatar-dealer'
    if (category === 'Media') return 'dashboard-activity-avatar-media'
    return 'dashboard-activity-avatar-regular'
  }

  // Chart configs...
  const hours = Array.from({ length: 12 }, (_, i) => `${8 + i}:00`)
  const lineSeries = (() => {
    const counts = new Map(hours.map(label => [label, 0]))
    logs.forEach((log) => {
      const hourLabel = `${new Date(log.timestamp).getHours()}:00`
      if (counts.has(hourLabel)) {
        counts.set(hourLabel, counts.get(hourLabel) + 1)
      }
    })
    return hours.map(label => counts.get(label) || 0)
  })()

  const lineData = {
    labels: hours,
    datasets: [{
      label: 'Kehadiran',
      data: lineSeries,
      borderColor: '#E60012',
      backgroundColor: 'rgba(230, 0, 18, 0.1)',
      fill: true, tension: 0.4,
      pointBackgroundColor: '#E60012', pointBorderColor: '#E60012',
      pointRadius: isMobile ? 2 : 3, pointHoverRadius: isMobile ? 4 : 6,
    }]
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(22, 22, 31, 0.95)',
        titleColor: '#F0F0F5', bodyColor: '#9CA3AF',
        borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
        padding: 12, cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6B7280', font: { size: isMobile ? 9 : 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 6 : 12 }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6B7280', font: { size: isMobile ? 9 : 11 } },
        beginAtZero: true
      }
    }
  }

  const doughnutData = {
    labels: Object.keys(stats.byCategory),
    datasets: [{
      data: Object.values(stats.byCategory).map(c => c.total),
      backgroundColor: ['#E60012', '#10B981', '#3B82F6', '#F59E0B'],
      borderWidth: 0, spacing: 3, borderRadius: 4,
    }]
  }

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#9CA3AF', padding: isMobile ? 10 : 16, usePointStyle: true, pointStyleWidth: 10, font: { size: isMobile ? 10 : 11 } }
      }
    }
  }

  // ===== MOBILE DASHBOARD =====
  if (isMobile) {
    return (
      <div className="page-container">
        {/* Mobile Hero Counter */}
        <div className="m-hero-card">
          <div className="m-hero-title">HARI {currentDay}</div>
          <div className="m-hero-counter">
            <span className="m-hero-num">{stats.checkedIn}</span>
            <span className="m-hero-divider">/</span>
            <span className="m-hero-total">{stats.total}</span>
          </div>
          <div className="m-hero-label">Peserta Hadir</div>
          <div className="m-hero-bar">
            <div className="m-hero-bar-fill" style={{ width: `${stats.percentage}%` }}></div>
          </div>
          <div className="m-hero-pct">{stats.percentage}%</div>
        </div>

        {/* Mobile Category Chips */}
        <div className="m-chips-row">
          {Object.entries(stats.byCategory).map(([cat, data]) => (
            <div key={cat} className={`m-chip m-chip-${cat.toLowerCase()}`}>
              <span className="m-chip-num">{data.checkedIn}/{data.total}</span>
              <span className="m-chip-label">{cat}</span>
            </div>
          ))}
        </div>

        {/* Simulate Button */}
        <button className="btn btn-secondary btn-sm dashboard-mobile-sim-btn" onClick={handleSimulate}>
          <Zap size={14} /> Simulasi Check-in
        </button>

        {/* Mobile Activity Feed - THIS IS THE PRIMARY CONTENT */}
        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title">Aktivitas Terbaru</span>
            <span className="badge badge-green dashboard-live-badge">● LANGSUNG</span>
          </div>
          {logs.length === 0 ? (
            <div className="m-empty">
              <span className="dashboard-empty-icon"><ClipboardList size={32} /></span>
              <p>Belum ada aktivitas check-in</p>
            </div>
          ) : (
            <div className="m-activity-list">
              {logs.slice(0, 15).map(log => (
                <div key={log.id} className="m-activity-card">
                  <div className={`m-activity-avatar ${getCategoryToneClass(log.participant_category)}`}>
                    {log.participant_name.charAt(0)}
                  </div>
                  <div className="m-activity-info">
                    <div className="m-activity-name">{log.participant_name}</div>
                    <div className="m-activity-meta">
                      <span className={`badge badge-${log.participant_category === 'VIP' ? 'red' : log.participant_category === 'Dealer' ? 'blue' : log.participant_category === 'Media' ? 'yellow' : 'gray'}`}>
                        {log.participant_category}
                      </span>
                      <span>{log.participant_ticket}</span>
                    </div>
                  </div>
                  <div className="m-activity-time">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ===== DESKTOP DASHBOARD (unchanged) =====
  return (
    <div className="page-container">
      <div className="page-header dashboard-header">
        <div>
          <span className="page-kicker">Panel admin</span>
          <h1>Ringkasan</h1>
          <p>Kehadiran real-time untuk Hari {currentDay}. Angka dan grafik di bawah menyamai data di pintu masuk.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleSimulate}>
          <Zap size={14} /> Simulasi Check-in
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stagger-1">
          <div className="stat-card-icon red"><Users size={22} /></div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Total Peserta</div>
        </div>
        <div className="stat-card stagger-2">
          <div className="stat-card-icon green"><UserCheck size={22} /></div>
          <div className="stat-card-value">{stats.checkedIn}</div>
          <div className="stat-card-label">Sudah Hadir</div>
          <div className="stat-card-change up">↑ {stats.percentage}%</div>
        </div>
        <div className="stat-card stagger-3">
          <div className="stat-card-icon yellow"><Clock size={22} /></div>
          <div className="stat-card-value">{stats.notCheckedIn}</div>
          <div className="stat-card-label">Belum Hadir</div>
        </div>
        <div className="stat-card stagger-4">
          <div className="stat-card-icon blue"><TrendingUp size={22} /></div>
          <div className="stat-card-value">{stats.percentage}%</div>
          <div className="stat-card-label">Tingkat Kehadiran</div>
          <div className="progress-bar mt-8">
            <div className="progress-bar-fill" style={{ width: `${stats.percentage}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div>
              <h3 className="card-title">Tren kehadiran</h3>
              <p className="card-subtitle-hint">Perkiraan check-in per jam (08:00–19:00) berdasarkan log hari ini.</p>
            </div>
          </div>
          <div className="chart-container"><Line data={lineData} options={lineOptions} /></div>
        </div>
        <div className="card animate-fade-in-up stagger-2">
          <div className="card-header">
            <div>
              <h3 className="card-title">Komposisi kategori</h3>
              <p className="card-subtitle-hint">Distribusi peserta per tipe tiket (VIP, Dealer, Media, Regular).</p>
            </div>
          </div>
          <div className="chart-container"><Doughnut data={doughnutData} options={doughnutOptions} /></div>
        </div>
      </div>

      <div className="card animate-fade-in-up stagger-3">
        <div className="card-header">
          <div>
            <h3 className="card-title">Aktivitas terbaru</h3>
            <p className="card-subtitle-hint">Alur check-in terbaru dari pemindaian di pintu masuk.</p>
          </div>
          <span className="badge badge-green">Langsung</span>
        </div>
        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardList size={40} /></div>
            <h3>Belum ada aktivitas</h3>
              <p>Aktivitas kehadiran akan muncul di sini secara langsung</p>
          </div>
        ) : (
          <div className="activity-feed">
            {logs.slice(0, 10).map(log => (
              <div key={log.id} className="activity-item">
                <div className={`activity-dot ${log.action === 'check_in' ? 'green' : 'red'}`}></div>
                <div>
                  <div className="activity-text">
                    <strong>{log.participant_name}</strong> — berhasil check-in
                    <span className="badge badge-gray ml-8">{log.participant_category}</span>
                  </div>
                  <div className="activity-time">{new Date(log.timestamp).toLocaleTimeString('id-ID')} · {log.participant_ticket}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
