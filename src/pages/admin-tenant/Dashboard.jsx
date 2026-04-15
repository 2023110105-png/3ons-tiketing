// ===== IMPORT SHARED UTILITIES =====
// Using tenantUtils.js to avoid function duplication across pages
import {
  getActiveTenantId,
  bootstrapStoreFromServer,
  getWorkspaceSnapshot,
  getActiveTenant as _getActiveTenant,
  setCurrentDay as _setCurrentDay
} from '../../lib/tenantUtils';
import { subscribeWorkspaceChanges } from '../../lib/dataSync';

// Local subscription unsubscribe function
let _unsubscribeRealtime = null;

function getAllParticipants() {
  const snapshot = getWorkspaceSnapshot();
  if (!snapshot || !snapshot.store) return [];
  const tenantId = getActiveTenantId();
  return snapshot.store.tenants?.[tenantId]?.events?.['event-default']?.participants || [];
}

function getAllCheckInLogs() {
  const snapshot = getWorkspaceSnapshot();
  if (!snapshot || !snapshot.store) return [];
  const tenantId = getActiveTenantId();
  const event = snapshot.store.tenants?.[tenantId]?.events?.['event-default'];
  return event?.checkInLogs || event?.checkin_logs || [];
}

function getStats() {
  const snapshot = getWorkspaceSnapshot();
  if (!snapshot || !snapshot.store) return { byCategory: {}, total: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0 };
  const participants = getAllParticipants();
  const checkInLogs = getAllCheckInLogs();
  const checkedInTicketIds = new Set(checkInLogs.map(log => log.ticket_id));
  
  const byCategory = {
    VIP: { total: 0, checkedIn: 0 },
    Dealer: { total: 0, checkedIn: 0 },
    Media: { total: 0, checkedIn: 0 },
    Regular: { total: 0, checkedIn: 0 }
  };
  
  participants.forEach(p => {
    const category = p.category || 'Regular';
    if (byCategory[category]) {
      byCategory[category].total++;
      if (checkedInTicketIds.has(p.ticket_id)) {
        byCategory[category].checkedIn++;
      }
    }
  });
  
  const total = participants.length;
  const checkedIn = checkedInTicketIds.size;
  const notCheckedIn = total - checkedIn;
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  
  return { byCategory, total, checkedIn, notCheckedIn, percentage };
}

function simulateCheckIns() { 
  alert('Simulasi check-in dijalankan.'); 
}
import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { Users, UserCheck, Clock, TrendingUp, Zap, ClipboardList } from 'lucide-react'
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const isMobile = useIsMobileLayout()

  void refreshKey
  const stats = getStats()
  const logs = getAllCheckInLogs()

  useEffect(() => {
    // Initial data load
    const loadData = async () => {
      await bootstrapStoreFromServer();
      setRefreshKey(k => k + 1); // Trigger re-render
    };
    loadData();
    
    // Auto-refresh every 2 seconds
    const interval = setInterval(async () => {
      await bootstrapStoreFromServer();
      setRefreshKey(k => k + 1);
    }, 2000);
    return () => clearInterval(interval)
  }, [])

  // Realtime subscription for instant updates
  useEffect(() => {
    _unsubscribeRealtime = subscribeWorkspaceChanges((payload) => {
      console.log('[Dashboard] Realtime update received:', payload?.eventType);
      // Refresh workspace snapshot when data changes
      void bootstrapStoreFromServer().then(() => {
        setRefreshKey(k => k + 1);
        console.log('[Dashboard] Data refreshed from realtime update');
      });
    });

    return () => {
      if (_unsubscribeRealtime) {
        _unsubscribeRealtime();
        _unsubscribeRealtime = null;
      }
    };
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

  // ===== MOBILE DASHBOARD v2.0 =====
  if (isMobile) {
    return (
      <div style={dashboardStyles.page}>
        {/* Animated Background */}
        <div style={dashboardStyles.bgDecorative}>
          <div style={dashboardStyles.bgGradient} />
          <div style={dashboardStyles.floatingShape1} />
          <div style={dashboardStyles.floatingShape2} />
        </div>

        {/* Mobile Hero Counter */}
        <div style={mobileStyles.heroCard}>
          <div style={mobileStyles.heroTitle}>KEHADIRAN REAL-TIME</div>
          <div style={mobileStyles.heroCounter}>
            <span style={mobileStyles.heroNum}>{stats.checkedIn}</span>
            <span style={mobileStyles.heroDivider}>/</span>
            <span style={mobileStyles.heroTotal}>{stats.total}</span>
          </div>
          <div style={mobileStyles.heroLabel}>Peserta Hadir</div>
          <div style={mobileStyles.heroBar}>
            <div style={{...mobileStyles.heroBarFill, width: `${stats.percentage}%`}}></div>
          </div>
          <div style={mobileStyles.heroPct}>{stats.percentage}%</div>
        </div>

        {/* Mobile Category Chips */}
        <div style={mobileStyles.chipsRow}>
          {Object.entries(stats.byCategory).map(([cat, data]) => (
            <div key={cat} style={{...mobileStyles.chip, ...mobileStyles[`chip${cat}`]}}>
              <span style={mobileStyles.chipNum}>{data.checkedIn}/{data.total}</span>
              <span style={mobileStyles.chipLabel}>{cat}</span>
            </div>
          ))}
        </div>

        {/* Simulate Button */}
        <button style={mobileStyles.simBtn} onClick={handleSimulate}>
          <Zap size={14} /> Simulasi Check-in
        </button>

        {/* Mobile Activity Feed */}
        <div style={mobileStyles.activitySection}>
          <div style={mobileStyles.sectionHeader}>
            <span style={mobileStyles.sectionTitle}>Aktivitas Terbaru</span>
            <span style={mobileStyles.liveBadge}>
              <span style={mobileStyles.liveDot}></span>
              LANGSUNG
            </span>
          </div>
          {logs.length === 0 ? (
            <div className="m-empty">
              <span className="dashboard-empty-icon"><ClipboardList size={32} /></span>
              <p>Belum ada aktivitas check-in</p>
              <p className="m-empty-subtle">Tekan tombol simulasi untuk melihat alur data real-time.</p>
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

  // ===== DESKTOP DASHBOARD v2.0 =====
  return (
    <div style={dashboardStyles.page}>
      {/* Animated Background */}
      <div style={dashboardStyles.bgDecorative}>
        <div style={dashboardStyles.bgGradient} />
        <div style={dashboardStyles.floatingShape1} />
        <div style={dashboardStyles.floatingShape2} />
      </div>

      {/* Header */}
      <div style={dashboardStyles.header}>
        <div>
          <span style={dashboardStyles.kicker}>📊 Panel Admin</span>
          <h1 style={dashboardStyles.title}>Ringkasan Event</h1>
          <p style={dashboardStyles.subtitle}>Monitoring kehadiran real-time semua peserta</p>
        </div>
        <button style={dashboardStyles.simulateBtn} onClick={handleSimulate}>
          <Zap size={16} /> Simulasi Check-in
        </button>
      </div>

      {/* Stats Grid v2.0 */}
      <div style={dashboardStyles.statsGrid}>
        {/* Total Participants */}
        <div style={{...dashboardStyles.statCard, ...dashboardStyles.statCardBlue}}>
          <div style={dashboardStyles.statIconWrap}>
            <Users size={24} style={dashboardStyles.statIcon} />
          </div>
          <div style={dashboardStyles.statContent}>
            <div style={dashboardStyles.statValue}>{stats.total}</div>
            <div style={dashboardStyles.statLabel}>Total Peserta</div>
          </div>
          <div style={dashboardStyles.statTrend}>100%</div>
        </div>

        {/* Checked In */}
        <div style={{...dashboardStyles.statCard, ...dashboardStyles.statCardGreen}}>
          <div style={dashboardStyles.statIconWrap}>
            <UserCheck size={24} style={dashboardStyles.statIcon} />
          </div>
          <div style={dashboardStyles.statContent}>
            <div style={dashboardStyles.statValue}>{stats.checkedIn}</div>
            <div style={dashboardStyles.statLabel}>Sudah Hadir</div>
          </div>
          <div style={dashboardStyles.statTrendUp}>↑ {stats.percentage}%</div>
        </div>

        {/* Not Checked In */}
        <div style={{...dashboardStyles.statCard, ...dashboardStyles.statCardOrange}}>
          <div style={dashboardStyles.statIconWrap}>
            <Clock size={24} style={dashboardStyles.statIcon} />
          </div>
          <div style={dashboardStyles.statContent}>
            <div style={dashboardStyles.statValue}>{stats.notCheckedIn}</div>
            <div style={dashboardStyles.statLabel}>Belum Hadir</div>
          </div>
          <div style={dashboardStyles.statTrendDown}>{100 - stats.percentage}%</div>
        </div>

        {/* Attendance Rate */}
        <div style={{...dashboardStyles.statCard, ...dashboardStyles.statCardPurple}}>
          <div style={dashboardStyles.statIconWrap}>
            <TrendingUp size={24} style={dashboardStyles.statIcon} />
          </div>
          <div style={dashboardStyles.statContent}>
            <div style={dashboardStyles.statValue}>{stats.percentage}%</div>
            <div style={dashboardStyles.statLabel}>Tingkat Kehadiran</div>
            <div style={dashboardStyles.progressBar}>
              <div style={{...dashboardStyles.progressFill, width: `${stats.percentage}%`}} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div>
              <h3 className="card-title">Tren kehadiran</h3>
              <p className="card-subtitle-hint">Perkiraan check-in per jam (08:00–19:00) berdasarkan semua log check-in.</p>
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
          <span className="badge badge-green dashboard-live-badge">
            <span className="dashboard-live-dot" aria-hidden="true"></span>
            Langsung
          </span>
        </div>
        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardList size={40} /></div>
            <h3>Belum ada aktivitas</h3>
            <p>Aktivitas kehadiran akan muncul di sini secara langsung</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSimulate}>
              <Zap size={14} /> Simulasi data dulu
            </button>
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

      {/* CSS Animations */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.6; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(15px) translateX(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}

// Dashboard v2.0 Styles
const dashboardStyles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgDecorative: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 0,
  },
  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(239,68,68,0.03) 0%, rgba(59,130,246,0.03) 50%, rgba(16,185,129,0.03) 100%)',
    animation: 'gradientShift 15s ease infinite',
  },
  floatingShape1: {
    position: 'absolute',
    top: '10%',
    right: '5%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 8s ease-in-out infinite',
  },
  floatingShape2: {
    position: 'absolute',
    bottom: '20%',
    left: '10%',
    width: '200px',
    height: '200px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float2 10s ease-in-out infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  kicker: {
    fontSize: '13px',
    color: '#ef4444',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
    display: 'block',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
  },
  simulateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
    transition: 'all 0.2s ease',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  statCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
    },
  },
  statCardBlue: {
    borderLeft: '4px solid #3b82f6',
  },
  statCardGreen: {
    borderLeft: '4px solid #10b981',
  },
  statCardOrange: {
    borderLeft: '4px solid #f59e0b',
  },
  statCardPurple: {
    borderLeft: '4px solid #8b5cf6',
  },
  statIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
  },
  statIcon: {
    color: '#3b82f6',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: 500,
  },
  statTrend: {
    fontSize: '13px',
    color: '#3b82f6',
    fontWeight: 600,
    padding: '4px 10px',
    background: 'rgba(59,130,246,0.1)',
    borderRadius: '20px',
  },
  statTrendUp: {
    fontSize: '13px',
    color: '#10b981',
    fontWeight: 600,
    padding: '4px 10px',
    background: 'rgba(16,185,129,0.1)',
    borderRadius: '20px',
  },
  statTrendDown: {
    fontSize: '13px',
    color: '#f59e0b',
    fontWeight: 600,
    padding: '4px 10px',
    background: 'rgba(245,158,11,0.1)',
    borderRadius: '20px',
  },
  progressBar: {
    width: '100%',
    height: '6px',
    background: '#e5e7eb',
    borderRadius: '3px',
    marginTop: '12px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  },
}

// Mobile Dashboard v2.0 Styles
const mobileStyles = {
  heroCard: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 10px 40px rgba(239,68,68,0.3)',
    color: 'white',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  },
  heroTitle: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    opacity: 0.9,
    marginBottom: '12px',
  },
  heroCounter: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  heroNum: {
    fontSize: '48px',
    fontWeight: 700,
    lineHeight: 1,
  },
  heroDivider: {
    fontSize: '32px',
    opacity: 0.6,
  },
  heroTotal: {
    fontSize: '24px',
    fontWeight: 500,
    opacity: 0.8,
  },
  heroLabel: {
    fontSize: '14px',
    opacity: 0.9,
    marginBottom: '16px',
  },
  heroBar: {
    width: '100%',
    height: '8px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: '4px',
    marginBottom: '8px',
    overflow: 'hidden',
  },
  heroBarFill: {
    height: '100%',
    background: 'white',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },
  heroPct: {
    fontSize: '18px',
    fontWeight: 600,
  },
  chipsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  chip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    minWidth: '80px',
  },
  chipVIP: {
    borderLeft: '3px solid #ef4444',
  },
  chipDealer: {
    borderLeft: '3px solid #3b82f6',
  },
  chipMedia: {
    borderLeft: '3px solid #f59e0b',
  },
  chipRegular: {
    borderLeft: '3px solid #6b7280',
  },
  chipNum: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1f2937',
  },
  chipLabel: {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '4px',
  },
  simBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
    position: 'relative',
    zIndex: 1,
  },
  activitySection: {
    background: 'white',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    position: 'relative',
    zIndex: 1,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    background: 'rgba(16,185,129,0.1)',
    color: '#10b981',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
  },
  liveDot: {
    width: '8px',
    height: '8px',
    background: '#10b981',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
}
