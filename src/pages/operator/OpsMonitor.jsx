// ===== REAL FUNCTIONS FOR OPS MONITOR =====
import { fetchWorkspaceSnapshot, subscribeWorkspaceChanges } from '../../lib/dataSync';
let _workspaceSnapshot = null;
let _unsubscribeRealtime = null;
async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}
function _getParticipants(day) {
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
function _getActiveTenant() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: 'tenant-default' };
  return _workspaceSnapshot.store.tenants?.['tenant-default'] || { id: 'tenant-default' };
}
function _getAvailableDays() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [1];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  const days = [...new Set(participants.map(p => p.day_number || p.day || 1))];
  return days.length > 0 ? days.sort((a, b) => a - b) : [1];
}
function _setCurrentDay(day) {
  if (_workspaceSnapshot?.store?.tenants?.['tenant-default']) {
    _workspaceSnapshot.store.tenants['tenant-default'].currentDay = day;
  }
}
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
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { total: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0 };
  
  // Calculate stats dynamically based on selected day
  const participants = _getParticipants(day);
  const checkInLogs = getCheckInLogs(day);
  const checkedInTicketIds = new Set(checkInLogs.map(log => String(log.ticket_id || '').trim().toLowerCase()));
  
  const total = participants.length;
  const checkedIn = participants.filter(p => checkedInTicketIds.has(String(p.ticket_id || '').trim().toLowerCase())).length;
  const notCheckedIn = total - checkedIn;
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  
  return { total, checkedIn, notCheckedIn, percentage };
}
function getPendingCheckIns() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.pending_checkins || [];
}
function getOfflineQueueHistory(limit) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  const arr = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.offline_queue_history || [];
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}
import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Clock, FileText, RefreshCw, Signal, WifiOff } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'

const STALE_SCAN_WARN_MINUTES = 6

function formatTime(value) {
  try {
    return new Date(value).toLocaleString('id-ID')
  } catch {
    return '-'
  }
}

function minutesSince(value) {
  const t = new Date(value || 0).getTime()
  if (!Number.isFinite(t) || t <= 0) return null
  return Math.max(0, Math.round((Date.now() - t) / 60000))
}

function getLogKind(log) {
  const gate = String(log?.scanned_by || log?.gate || '').toLowerCase()
  if (gate.includes('front')) return 'front'
  if (gate.includes('back')) return 'back'
  return gate ? 'gate' : 'unknown'
}

export default function OpsMonitor() {
    // Initial load data dari Supabase
    useEffect(() => {
      const load = async () => {
        await bootstrapStoreFromServer();
      };
      load();
    }, []);
  const toast = useToast()
  const [dayFilter, setDayFilter] = useState(1)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [tick, setTick] = useState(0)
  
  // Update available days and dayFilter when data changes
  const availableDays = _getAvailableDays()
  useEffect(() => {
    if (availableDays.length > 0 && !availableDays.includes(dayFilter)) {
      setDayFilter(availableDays[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, dayFilter])

  // Lightweight auto-refresh for live ops view
  useEffect(() => {
    const id = window.setInterval(() => {
      void bootstrapStoreFromServer(true)
      setTick(t => t + 1)
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  // Realtime subscription for instant updates
  useEffect(() => {
    _unsubscribeRealtime = subscribeWorkspaceChanges(async (payload) => {
      console.log('[OpsMonitor] Realtime update received:', payload?.eventType);
      // Refresh workspace snapshot when data changes
      try {
        await bootstrapStoreFromServer(true);
        setTick(t => t + 1);
        console.log('[OpsMonitor] Data refreshed from realtime update');
      } catch (err) {
        console.error('[OpsMonitor] Failed to refresh data:', err);
      }
    });

    return () => {
      if (_unsubscribeRealtime) {
        _unsubscribeRealtime();
        _unsubscribeRealtime = null;
      }
    };
  }, [])

  const stats = getStats(dayFilter)
  const checkInLogs = getCheckInLogs(dayFilter).slice(0, 50)
  const pendingQueue = getPendingCheckIns()
  const offlineHistory = getOfflineQueueHistory(60)

  const lastScanAt = checkInLogs[0]?.timestamp || null
  const pendingCount = pendingQueue.length
  const staleMinutes = minutesSince(lastScanAt)
  const pendingByGate = useMemo(() => {
    const buckets = { gate_front: 0, gate_back: 0, other: 0 }
    pendingQueue.forEach(item => {
      const by = String(item?.scanned_by || '').toLowerCase()
      if (by === 'gate_front') buckets.gate_front++
      else if (by === 'gate_back') buckets.gate_back++
      else buckets.other++
    })
    return buckets
  }, [pendingQueue])

  const offlineSummary = useMemo(() => {
    const out = { enqueued: 0, sync_success: 0, sync_fail: 0, purge: 0, other: 0 }
    offlineHistory.forEach(item => {
      const type = String(item?.type || '').toLowerCase()
      if (type in out) out[type]++
      else out.other++
    })
    return out
  }, [offlineHistory])

  const gateActivity = useMemo(() => {
    const front = checkInLogs.filter(l => getLogKind(l) === 'front').length
    const back = checkInLogs.filter(l => getLogKind(l) === 'back').length
    const other = checkInLogs.length - front - back
    return { front, back, other }
  }, [checkInLogs])

  const gateLastSeen = useMemo(() => {
    const out = { gate_front: null, gate_back: null }
    checkInLogs.forEach(log => {
      const by = String(log?.scanned_by || log?.gate || '').toLowerCase()
      const ts = log?.timestamp
      if (!ts) return
      if (by === 'gate_front' && !out.gate_front) out.gate_front = ts
      if (by === 'gate_back' && !out.gate_back) out.gate_back = ts
    })
    return out
  }, [checkInLogs])

  const participantNameMap = useMemo(() => {
    const participants = _getParticipants(dayFilter)
    const map = new Map()
    participants.forEach(p => {
      const ticketId = p.ticket_id || p.ticketId || p.participant_ticket
      if (ticketId) {
        map.set(String(ticketId).toLowerCase(), p.name || p.participant_name || '-')
      }
    })
    return map
  }, [dayFilter])

  const gateOfflineHints = useMemo(() => {
    const out = { gate_front: null, gate_back: null }
    offlineHistory.forEach(item => {
      const by = String(item?.payload?.scanned_by || '').toLowerCase()
      const ts = item?.timestamp
      if (!ts) return
      if (by === 'gate_front' && !out.gate_front) out.gate_front = ts
      if (by === 'gate_back' && !out.gate_back) out.gate_back = ts
    })
    return out
  }, [offlineHistory])

  const gateStatus = useMemo(() => {
    const build = (key, label) => {
      const seenAt = gateLastSeen[key] || null
      const offlineAt = gateOfflineHints[key] || null
      const mins = minutesSince(seenAt || offlineAt)
      const hasOfflineQueue = (key === 'gate_front' ? pendingByGate.gate_front : pendingByGate.gate_back) > 0

      if (!seenAt && !offlineAt) {
        return { key, label, tone: 'warn', pill: 'Belum ada aktivitas', sub: 'Belum ada data dari gate ini.' }
      }

      if (mins != null && mins >= STALE_SCAN_WARN_MINUTES) {
        return {
          key,
          label,
          tone: hasOfflineQueue ? 'bad' : 'warn',
          pill: hasOfflineQueue ? 'Perlu dicek' : 'Mulai sepi',
          sub: `Terakhir aktif ${mins} menit lalu${hasOfflineQueue ? ` · antrean offline ${key === 'gate_front' ? pendingByGate.gate_front : pendingByGate.gate_back}` : ''}.`
        }
      }

      return {
        key,
        label,
        tone: hasOfflineQueue ? 'warn' : 'ok',
        pill: hasOfflineQueue ? 'Aktif (offline)' : 'Aktif',
        sub: mins == null ? 'Terlihat aktif.' : `Terakhir aktif ${mins} menit lalu.`
      }
    }

    return [
      build('gate_front', 'Pintu depan'),
      build('gate_back', 'Pintu belakang')
    ]
  }, [gateLastSeen, gateOfflineHints, pendingByGate])

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await bootstrapStoreFromServer(true)
      toast.success('Update', 'Data terbaru berhasil dimuat.')
      setTick(t => t + 1)
    } catch {
      toast.warning('Koneksi', 'Belum bisa memuat data terbaru. Coba lagi sebentar.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handlePrintAttendance = async () => {
    if (isPrinting) return
    setIsPrinting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')
      
      const stats = getStats(dayFilter)
      const logs = getCheckInLogs(dayFilter)
      const participants = _getParticipants(dayFilter)
      
      // Colors
      const PRIMARY_COLOR = [41, 128, 185] // Blue
      const SECONDARY_COLOR = [52, 73, 94] // Dark blue-gray
      const ACCENT_COLOR = [46, 204, 113] // Green
      const LIGHT_BG = [248, 249, 250]
      const BORDER_COLOR = [200, 200, 200]
      
      // Professional Header with Logo area
      doc.setFillColor(...PRIMARY_COLOR)
      doc.rect(0, 0, 210, 35, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('LAPORAN KEHADIRAN', 105, 18, { align: 'center' })
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Hari ${dayFilter} | ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 28, { align: 'center' })
      
      // Sub-header with event info
      doc.setTextColor(...SECONDARY_COLOR)
      doc.setFontSize(10)
      doc.text('Strings Fiddle Convention 2026', 14, 42)
      doc.setDrawColor(...BORDER_COLOR)
      doc.line(14, 45, 196, 45)
      
      // Stats Summary Cards
      let y = 52
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text('RINGKASAN KEHADIRAN', 14, y)
      y += 10
      
      // Stats boxes
      const boxWidth = 45
      const boxHeight = 25
      const boxSpacing = 4
      
      // Total box
      doc.setFillColor(...LIGHT_BG)
      doc.setDrawColor(...BORDER_COLOR)
      doc.roundedRect(14, y, boxWidth, boxHeight, 3, 3, 'FD')
      doc.setFontSize(8)
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text('TOTAL PESERTA', 14 + boxWidth/2, y + 7, { align: 'center' })
      doc.setFontSize(14)
      doc.setTextColor(...PRIMARY_COLOR)
      doc.text(String(stats.total), 14 + boxWidth/2, y + 18, { align: 'center' })
      
      // Checked in box
      doc.setFillColor(...LIGHT_BG)
      doc.roundedRect(14 + boxWidth + boxSpacing, y, boxWidth, boxHeight, 3, 3, 'FD')
      doc.setFontSize(8)
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text('SUDAH CHECK-IN', 14 + boxWidth + boxSpacing + boxWidth/2, y + 7, { align: 'center' })
      doc.setFontSize(14)
      doc.setTextColor(...ACCENT_COLOR)
      doc.text(String(stats.checkedIn), 14 + boxWidth + boxSpacing + boxWidth/2, y + 18, { align: 'center' })
      
      // Not checked in box
      doc.setFillColor(...LIGHT_BG)
      doc.roundedRect(14 + (boxWidth + boxSpacing) * 2, y, boxWidth, boxHeight, 3, 3, 'FD')
      doc.setFontSize(8)
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text('BELUM CHECK-IN', 14 + (boxWidth + boxSpacing) * 2 + boxWidth/2, y + 7, { align: 'center' })
      doc.setFontSize(14)
      doc.setTextColor(231, 76, 60)
      doc.text(String(stats.notCheckedIn), 14 + (boxWidth + boxSpacing) * 2 + boxWidth/2, y + 18, { align: 'center' })
      
      // Percentage box
      doc.setFillColor(...LIGHT_BG)
      doc.roundedRect(14 + (boxWidth + boxSpacing) * 3, y, boxWidth, boxHeight, 3, 3, 'FD')
      doc.setFontSize(8)
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text('PERSENTASE', 14 + (boxWidth + boxSpacing) * 3 + boxWidth/2, y + 7, { align: 'center' })
      doc.setFontSize(14)
      doc.setTextColor(...PRIMARY_COLOR)
      doc.text(`${stats.percentage}%`, 14 + (boxWidth + boxSpacing) * 3 + boxWidth/2, y + 18, { align: 'center' })
      
      y += boxHeight + 12
      
      // CATEGORY BREAKDOWN TABLE
      const categories = {}
      participants.forEach(p => {
        const cat = p.category || 'Regular'
        if (!categories[cat]) categories[cat] = { total: 0, checkedIn: 0 }
        categories[cat].total++
      })
      
      logs.forEach(log => {
        const p = participants.find(pt => 
          String(pt.ticket_id || '').trim().toLowerCase() === String(log.ticket_id || '').trim().toLowerCase()
        )
        if (p) {
          const cat = p.category || 'Regular'
          if (categories[cat]) categories[cat].checkedIn++
        }
      })
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text('KEHADIRAN PER KATEGORI', 14, y)
      y += 8
      
      // Category table header
      doc.setFillColor(...PRIMARY_COLOR)
      doc.setDrawColor(...PRIMARY_COLOR)
      doc.rect(14, y, 182, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('KATEGORI', 18, y + 5.5)
      doc.text('TOTAL', 75, y + 5.5, { align: 'center' })
      doc.text('HADIR', 105, y + 5.5, { align: 'center' })
      doc.text('BELUM', 135, y + 5.5, { align: 'center' })
      doc.text('%', 165, y + 5.5, { align: 'center' })
      doc.text('STATUS', 185, y + 5.5, { align: 'center' })
      
      y += 8
      
      // Category table rows
      const sortedCategories = Object.entries(categories).sort((a, b) => b[1].total - a[1].total)
      sortedCategories.forEach(([cat, data], i) => {
        const notChecked = data.total - data.checkedIn
        const pct = data.total > 0 ? Math.round((data.checkedIn / data.total) * 100) : 0
        const status = pct >= 80 ? 'BAIK' : pct >= 50 ? 'CUKUP' : 'PERLU PERHATIAN'
        
        // Row background alternating
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 250)
          doc.rect(14, y, 182, 7, 'F')
        }
        
        doc.setDrawColor(...BORDER_COLOR)
        doc.line(14, y + 7, 196, y + 7)
        
        doc.setTextColor(...SECONDARY_COLOR)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(cat.toUpperCase(), 18, y + 5)
        doc.text(String(data.total), 75, y + 5, { align: 'center' })
        doc.setTextColor(...ACCENT_COLOR)
        doc.text(String(data.checkedIn), 105, y + 5, { align: 'center' })
        doc.setTextColor(231, 76, 60)
        doc.text(String(notChecked), 135, y + 5, { align: 'center' })
        doc.setTextColor(...SECONDARY_COLOR)
        doc.text(`${pct}%`, 165, y + 5, { align: 'center' })
        
        // Status badge
        if (pct >= 80) {
          doc.setFillColor(46, 204, 113)
          doc.setTextColor(255, 255, 255)
        } else if (pct >= 50) {
          doc.setFillColor(241, 196, 15)
          doc.setTextColor(255, 255, 255)
        } else {
          doc.setFillColor(231, 76, 60)
          doc.setTextColor(255, 255, 255)
        }
        doc.roundedRect(170, y + 1, 25, 5, 2, 2, 'F')
        doc.setFontSize(7)
        doc.text(status, 182.5, y + 4.3, { align: 'center' })
        
        y += 7
      })
      
      y += 10
      
      // CHECK-IN LOGS TABLE
      if (y > 200) {
        doc.addPage()
        y = 20
      }
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...SECONDARY_COLOR)
      doc.text(`DAFTAR CHECK-IN (${logs.length} scan)`, 14, y)
      y += 8
      
      // Table header
      doc.setFillColor(...PRIMARY_COLOR)
      doc.rect(14, y, 182, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('WAKTU', 16, y + 5.5)
      doc.text('GATE', 45, y + 5.5)
      doc.text('ID TIKET', 70, y + 5.5)
      doc.text('NAMA', 105, y + 5.5)
      doc.text('KATEGORI', 150, y + 5.5)
      doc.text('STATUS', 180, y + 5.5, { align: 'right' })
      
      y += 8
      
      // Table rows
      logs.forEach((log, i) => {
        if (y > 280) {
          doc.addPage()
          y = 20
          // Repeat header on new page
          doc.setFillColor(...PRIMARY_COLOR)
          doc.rect(14, y, 182, 8, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(9)
          doc.text('WAKTU', 16, y + 5.5)
          doc.text('GATE', 45, y + 5.5)
          doc.text('ID TIKET', 70, y + 5.5)
          doc.text('NAMA', 105, y + 5.5)
          doc.text('KATEGORI', 150, y + 5.5)
          doc.text('STATUS', 180, y + 5.5, { align: 'right' })
          y += 8
        }
        
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 250)
          doc.rect(14, y, 182, 6, 'F')
        }
        
        const name = participantNameMap.get(String(log.ticket_id || '').toLowerCase()) || log.participant_name || '-'
        const gate = String(log.scanned_by || '-').replace(/_/g, ' ').toUpperCase()
        
        // Find participant category
        const participant = participants.find(p => 
          String(p.ticket_id || '').trim().toLowerCase() === String(log.ticket_id || '').trim().toLowerCase()
        )
        const category = (participant?.category || 'Regular').toUpperCase()
        
        doc.setTextColor(...SECONDARY_COLOR)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(formatTime(log.timestamp).substring(0, 16), 16, y + 4.5)
        doc.text(gate.substring(0, 10), 45, y + 4.5)
        doc.text((log.ticket_id || '-').substring(0, 12), 70, y + 4.5)
        doc.text(name.substring(0, 20), 105, y + 4.5)
        doc.text(category.substring(0, 10), 150, y + 4.5)
        
        const status = String(log.status || 'valid').toUpperCase()
        if (status === 'VALID' || status === 'SUCCESS') {
          doc.setTextColor(...ACCENT_COLOR)
        } else if (status === 'DUPLICATE') {
          doc.setTextColor(241, 196, 15)
        } else {
          doc.setTextColor(231, 76, 60)
        }
        doc.text(status, 180, y + 4.5, { align: 'right' })
        
        y += 6
      })
      
      // Participants not checked in
      if (y > 220) {
        doc.addPage()
        y = 20
      } else {
        y += 10
      }
      
      const checkedInIds = new Set(logs.map(l => String(l.ticket_id || '').toLowerCase()))
      const notCheckedIn = participants.filter(p => !checkedInIds.has(String(p.ticket_id || '').toLowerCase()))
      
      if (notCheckedIn.length > 0) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(231, 76, 60)
        doc.text(`PESERTA BELUM CHECK-IN (${notCheckedIn.length})`, 14, y)
        y += 8
        
        // Not checked in table header
        doc.setFillColor(231, 76, 60)
        doc.rect(14, y, 182, 8, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.text('NO', 18, y + 5.5)
        doc.text('ID TIKET', 35, y + 5.5)
        doc.text('NAMA', 90, y + 5.5)
        doc.text('KATEGORI', 160, y + 5.5)
        
        y += 8
        
        notCheckedIn.slice(0, 40).forEach((p, i) => {
          if (y > 280) {
            doc.addPage()
            y = 20
            doc.setFillColor(231, 76, 60)
            doc.rect(14, y, 182, 8, 'F')
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(9)
            doc.text('NO', 18, y + 5.5)
            doc.text('ID TIKET', 35, y + 5.5)
            doc.text('NAMA', 90, y + 5.5)
            doc.text('KATEGORI', 160, y + 5.5)
            y += 8
          }
          
          if (i % 2 === 0) {
            doc.setFillColor(254, 242, 242)
            doc.rect(14, y, 182, 6, 'F')
          }
          
          doc.setTextColor(...SECONDARY_COLOR)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.text(String(i + 1), 18, y + 4.5)
          doc.text(p.ticket_id || '-', 35, y + 4.5)
          doc.text((p.name || '-').substring(0, 35), 90, y + 4.5)
          doc.text((p.category || 'Regular').toUpperCase(), 160, y + 4.5)
          
          y += 6
        })
        
        if (notCheckedIn.length > 40) {
          y += 5
          doc.setFontSize(9)
          doc.setTextColor(...SECONDARY_COLOR)
          doc.text(`... dan ${notCheckedIn.length - 40} peserta lainnya`, 14, y)
        }
      }
      
      // Footer
      doc.setDrawColor(...BORDER_COLOR)
      doc.line(14, 287, 196, 287)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'normal')
      doc.text(`Dicetak oleh Strings Fiddle Convention 2026 System | ${new Date().toLocaleString('id-ID')}`, 14, 292)
      doc.text(`Halaman 1`, 180, 292, { align: 'right' })
      
      doc.save(`laporan-kehadiran-hari-${dayFilter}-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('Sukses', 'PDF laporan kehadiran telah diunduh.')
    } catch (err) {
      console.error('PDF generation failed:', err)
      toast.error('Gagal', 'Tidak dapat membuat PDF. Pastikan data tersedia.')
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-kicker">Operasional</span>
          <h1>Scan Ops Monitor</h1>
          <p>Pantau scan, antrean offline, dan aktivitas gate secara ringkas. Cocok untuk tim admin saat hari-H.</p>
        </div>
        <div className="admin-actions-wrap">
          <select className="form-select admin-select-auto" value={dayFilter} onChange={(e) => setDayFilter(Number(e.target.value))} title="Filter hari aktif">
            {_getAvailableDays().map(d => (
              <option key={d} value={d}>Hari {d}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" onClick={handlePrintAttendance} disabled={isPrinting} title="Cetak PDF kehadiran">
            <FileText size={16} /> Cetak PDF
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={isRefreshing} title="Muat data terbaru">
            <RefreshCw size={16} className={isRefreshing ? 'spinner' : ''} /> Segarkan
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon"><Activity size={18} /></div>
          <div className="stat-card-value">{stats.checkedIn}</div>
          <div className="stat-card-label">Sudah masuk</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Signal size={18} /></div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Total peserta (hari ini)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><WifiOff size={18} /></div>
          <div className="stat-card-value">{pendingCount}</div>
          <div className="stat-card-label">Antrean offline</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Clock size={18} /></div>
          <div className="stat-card-value" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
            {lastScanAt ? formatTime(lastScanAt) : '-'}
          </div>
          <div className="stat-card-label">
            Scan terakhir{(staleMinutes != null && staleMinutes >= STALE_SCAN_WARN_MINUTES) ? ` · ${staleMinutes} menit lalu` : ''}
          </div>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ringkasan Gate</h3>
            <div className="badge badge-gray text-xs">50 scan terakhir</div>
          </div>
          <div className="card-body">
            {staleMinutes != null && staleMinutes >= STALE_SCAN_WARN_MINUTES && (
              <div className="admin-note" style={{ marginBottom: 12, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div className="admin-note-title" style={{ color: 'var(--warning)', fontWeight: 900 }}>
                  <AlertTriangle size={16} /> Peringatan operasional
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tidak ada scan baru dalam <b>{staleMinutes}</b> menit. Periksa koneksi internet gate atau pastikan petugas tetap di mode pemindaian.
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              {gateStatus.map(item => (
                <div key={item.key} className="ops-gate-row">
                  <div className="ops-gate-title">
                    <div className="ops-gate-name">{item.label}</div>
                    <div className="ops-gate-sub">{item.sub}</div>
                  </div>
                  <div className={`ops-pill ${item.tone}`}>
                    <span className="dot" />
                    {item.pill}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="mini-stat">
                <div className="mini-stat-label">Pintu depan</div>
                <div className="mini-stat-value">{gateActivity.front}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Pintu belakang</div>
                <div className="mini-stat-value">{gateActivity.back}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Lainnya</div>
                <div className="mini-stat-value">{gateActivity.other}</div>
              </div>
            </div>

            <div className="divider" style={{ margin: '14px 0' }} />

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="mini-stat">
                <div className="mini-stat-label">Offline (depan)</div>
                <div className="mini-stat-value">{pendingByGate.gate_front}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Offline (belakang)</div>
                <div className="mini-stat-value">{pendingByGate.gate_back}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Offline (lainnya)</div>
                <div className="mini-stat-value">{pendingByGate.other}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Riwayat Offline</h3>
            <div className="badge badge-gray text-xs">60 aktivitas terakhir</div>
          </div>
          <div className="card-body">
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="mini-stat">
                <div className="mini-stat-label">Tersimpan</div>
                <div className="mini-stat-value">{offlineSummary.enqueued}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Sinkron OK</div>
                <div className="mini-stat-value">{offlineSummary.sync_success}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Sinkron gagal</div>
                <div className="mini-stat-value">{offlineSummary.sync_fail}</div>
              </div>
            </div>

            <div className="divider" style={{ margin: '14px 0' }} />

            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {offlineHistory.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  <AlertTriangle size={18} />
                  <h3>Belum ada aktivitas offline</h3>
                  <p>Jika perangkat sempat offline, catatan akan muncul di sini.</p>
                </div>
              ) : (
                offlineHistory.map(item => (
                  <div key={item.id} className="activity-item" style={{ padding: '10px 0' }}>
                    <div className="activity-left">
                      <div className="activity-dot"></div>
                    </div>
                    <div className="activity-text">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                          {String(item.type || 'activity').replace(/_/g, ' ')}
                        </div>
                        <div className="code-muted-sm">{formatTime(item.timestamp)}</div>
                      </div>
                      {item?.payload?.queue_id && (
                        <div className="code-muted-sm">Queue: {item.payload.queue_id}</div>
                      )}
                      {item?.payload?.scanned_by && (
                        <div className="code-muted-sm">Sumber: {item.payload.scanned_by}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Aktivitas Check-in Terbaru</h3>
          <div className="badge badge-gray text-xs">Log (hari terpilih)</div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Gate</th>
                <th>ID Tiket</th>
                <th>Nama</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {checkInLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 22, color: 'var(--text-muted)' }}>
                    Belum ada log check-in untuk hari ini.
                  </td>
                </tr>
              ) : (
                checkInLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTime(log.timestamp)}</td>
                    <td>
                      <span className="badge badge-gray text-xs">
                        {String(log.scanned_by || log.gate || '-').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="ticket-id-code">{log.ticket_id || log.participant_ticket || '-'}</td>
                    <td style={{ fontWeight: 650 }}>{participantNameMap.get(String(log.ticket_id || log.participant_ticket || '').toLowerCase()) || log.participant_name || log.name || '-'}</td>
                    <td>
                      <span className={`badge ${String(log.status || '').toLowerCase() === 'duplicate' ? 'badge-yellow' : 'badge-green'} text-xs`}>
                        {String(log.status || 'valid').toUpperCase()}
                      </span>
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

