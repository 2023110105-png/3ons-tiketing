// ===== REAL FUNCTIONS FOR BACKGATE =====
import { fetchFirebaseWorkspaceSnapshot, subscribeWorkspaceChanges } from '../../lib/dataSync';
let _workspaceSnapshot = null;
let _unsubscribeRealtime = null;

async function bootstrapStoreFromFirebase() {
  _workspaceSnapshot = await fetchFirebaseWorkspaceSnapshot();
  return _workspaceSnapshot;
}

// getCurrentDay removed - now using selectedDay state

function getCheckInLogs(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  // Support both field names for backward compatibility
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  const logs = event?.checkInLogs || event?.checkin_logs || [];
  return logs.filter(l => !day || Number(l.day) === Number(day) || Number(l.day_number) === Number(day));
}

function getStats(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { total: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0, byCategory: {} };
  const participants = getParticipants(day);
  const checkInLogs = getCheckInLogs(day);
  const checkedInTicketIds = new Set(checkInLogs.map(log => log.ticket_id));
  const total = participants.length;
  const checkedIn = checkedInTicketIds.size;
  const notCheckedIn = total - checkedIn;
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  
  // Build byCategory stats
  const byCategory = {};
  participants.forEach(p => {
    const cat = p.category || 'Regular';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, checkedIn: 0 };
    byCategory[cat].total++;
    if (checkedInTicketIds.has(p.ticket_id)) byCategory[cat].checkedIn++;
  });
  
  return { total, checkedIn, notCheckedIn, percentage, byCategory };
}

function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}

function getPendingCheckIns() { return []; }
function getMaxPendingAttempts() { return 5; }
function getOfflineQueueHistory() { return []; }

// Enrich check-in logs with participant data if missing
function enrichLogsWithParticipantData(logs) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return logs;
  const participants = getParticipants();
  return logs.map(log => {
    if (log.participant_name && log.participant_category && log.participant_ticket) {
      return log; // Already has all data
    }
    // Look up participant by ticket_id
    const participant = participants.find(p => p.ticket_id === log.ticket_id);
    if (participant) {
      return {
        ...log,
        participant_name: log.participant_name || participant.name || participant.nama || 'Unknown',
        participant_category: log.participant_category || participant.category || participant.kategori || 'Regular',
        participant_ticket: log.participant_ticket || log.ticket_id || '-'
      };
    }
    return log;
  });
}
import { useState, useEffect } from 'react'
import { useRealtime, useSound } from '../../hooks/useRealtime'
import { Radio, WifiOff, CircleHelp } from 'lucide-react'
import { exportOfflineQueueReportToCSV } from '../../utils/csvExport'

const REALTIME_REFRESH_MS = 2500

export default function BackGate() {
  const [selectedDay, setSelectedDay] = useState(1) // State untuk pilih Day 1 atau Day 2
  const [showLimitInfo, setShowLimitInfo] = useState(false)
  const [isLimitInfoFading, setIsLimitInfoFading] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const { lastEvent } = useRealtime()
  const { playNotification } = useSound()
  const [refreshKey, setRefreshKey] = useState(0)

  void refreshKey
  const stats = getStats(selectedDay)
  const rawLogs = getCheckInLogs(selectedDay)
  const logs = enrichLogsWithParticipantData(rawLogs)
  const pendingItems = getPendingCheckIns()

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      await bootstrapStoreFromFirebase();
      setRefreshKey(k => k + 1);
    };
    loadData();
  }, [selectedDay]) // Reload ketika selectedDay berubah

  // Refresh stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      void bootstrapStoreFromFirebase();
      setRefreshKey(k => k + 1)
    }, REALTIME_REFRESH_MS)
    return () => clearInterval(interval)
  }, [])

  // Realtime subscription to capture check-ins from FrontGate
  useEffect(() => {
    _unsubscribeRealtime = subscribeWorkspaceChanges((payload) => {
      console.log('[BackGate] Realtime update received:', payload?.eventType);
      // Refresh workspace snapshot when data changes
      void bootstrapStoreFromFirebase().then(() => {
        setRefreshKey(k => k + 1);
        console.log('[BackGate] Data refreshed from realtime update');
      });
    });

    return () => {
      if (_unsubscribeRealtime) {
        _unsubscribeRealtime();
        _unsubscribeRealtime = null;
      }
    };
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
    if (!name || typeof name !== 'string') return '--';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  }

  const timeSince = (timestamp) => {
    if (!timestamp) return '-';
    const ts = new Date(timestamp).getTime();
    if (isNaN(ts)) return '-';
    const diff = Math.floor((nowTs - ts) / 1000)
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
      {/* Day Selector - Dropdown */}
      <div className="day-selector" style={{ 
        display: 'flex', 
        gap: '12px', 
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: '20px',
        padding: '12px 16px',
        background: 'var(--bg-secondary, #f8fafc)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #e2e8f0)'
      }}>
        <label htmlFor="backgate-day-selector" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Pilih Hari:
        </label>
        <select
          id="backgate-day-selector"
          name="day"
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          style={{
            padding: '10px 16px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            border: '2px solid var(--brand-primary, #3b82f6)',
            background: 'white',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            minWidth: '120px'
          }}
        >
          {(() => {
            const participants = getParticipants()
            const days = new Set()
            participants.forEach(p => {
              const day = Number(p.day_number || p.day || 1)
              if (day > 0) days.add(day)
            })
            const availableDays = Array.from(days).sort((a, b) => a - b)
            return availableDays.length > 0 ? (
              availableDays.map(day => (
                <option key={day} value={day}>Hari {day}</option>
              ))
            ) : (
              <option value={1}>Hari 1</option>
            )
          })()}
        </select>
        <div style={{
          padding: '8px 16px',
          background: 'var(--brand-primary, #3b82f6)',
          color: 'white',
          borderRadius: '8px',
          fontWeight: '700',
          fontSize: '14px'
        }}>
          Aktif: Hari {selectedDay}
        </div>
      </div>

      {/* Big Counter */}
      <div className="monitor-counter animate-fade-in-up">
        <div className="monitor-kicker">
          Kehadiran langsung · Hari {selectedDay}
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
        {Object.entries(stats.byCategory || {}).map(([cat, data]) => (
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
            {logs.map((log, index) => (
              <div
                key={log.id || `${log.ticket_id}-${index}`}
                className={`monitor-feed-item ${lastEvent?.log?.id === log.id ? 'new' : ''}`}
              >
                <div className="monitor-feed-item-avatar">
                  {getInitials(log.participant_name || log.ticket_id)}
                </div>
                <div className="monitor-feed-item-info">
                  <div className="monitor-feed-item-name">{log.participant_name || 'Peserta Tidak Dikenal'}</div>
                  <div className="monitor-feed-item-meta">
                    <span className={`badge ${
                      log.participant_category === 'VIP' ? 'badge-red' :
                      log.participant_category === 'Dealer' ? 'badge-blue' :
                      log.participant_category === 'Media' ? 'badge-yellow' : 'badge-gray'
                    } monitor-meta-badge`}>
                      {log.participant_category || 'Regular'}
                    </span>
                    <span className="monitor-ticket-badge">{log.participant_ticket || log.ticket_id || '-'}</span>
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
