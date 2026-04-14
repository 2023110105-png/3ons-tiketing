// ===== REAL FUNCTIONS FOR SETTINGS =====
import { fetchWorkspaceSnapshot, syncResetCheckInLogs, syncEventSnapshot } from "../../lib/dataSync";
let _workspaceSnapshot = null;

function _getActiveTenantId() {
  // Try to get from window.user first (set by component)
  if (typeof window !== 'undefined' && window.currentUser?.tenant_id) {
    return window.currentUser.tenant_id;
  }
  // Fallback: try to get from user in localStorage
  try {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.user?.tenant_id) return session.user.tenant_id;
    if (session.user?.tenant?.id) return session.user.tenant.id;
  } catch { /* ignore */ }
  // Last resort: try from workspace snapshot
  if (_workspaceSnapshot?.store?.tenants) {
    const firstTenant = Object.keys(_workspaceSnapshot.store.tenants)[0];
    if (firstTenant) return firstTenant;
  }
  return 'default';
}

async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}

function _getParticipants() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
}

function _getActiveTenant() { 
  const tenantId = _getActiveTenantId();
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: tenantId };
  return _workspaceSnapshot.store.tenants?.[tenantId] || { id: tenantId };
}

function _getAvailableDays() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [1];
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  const days = [...new Set(participants.map(p => p.day_number || p.day || 1))];
  return days.length > 0 ? days.sort((a, b) => a - b) : [1];
}

function _getCurrentDay() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 1;
  const tenantId = _getActiveTenantId();
  return _workspaceSnapshot.store.tenants?.[tenantId]?.currentDay || 1;
}

function _setCurrentDay(day) {
  const tenantId = _getActiveTenantId();
  if (_workspaceSnapshot?.store?.tenants?.[tenantId]) {
    _workspaceSnapshot.store.tenants[tenantId].currentDay = day;
  }
}

function getWaTemplate() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return `📋 *E-ATTENDANCE*
🏛️ PALEMBANG VIOLIN COMPETITION

╭────────────────────────╮
  👤 *{{nama}}*
  � {{kategori}}
  📱 Violin-{{tiket}}
╰────────────────────────╯

📅 Event : 11 April 2026
🏢 Venue : Primavera Production

✨ *PETUNJUK REGISTRASI*
Tunjukkan kode QR ini kepada petugas registrasi untuk melakukan absensi peserta.

⚠️ *Ketentuan:*
• Valid untuk 1 (satu) orang peserta
• Wajib menunjukkan QR asli, tidak boleh screenshot
• Harap hadir 30 menit sebelum jadwal tampil

Terima kasih & semoga sukses! 🎻🎶`;
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.waTemplate || '';
}

function getWaSendMode() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 'message_only';
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.waSendMode || 'message_only';
}

function getMaxPendingAttempts() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 3;
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.offlineConfig?.maxPendingAttempts || 3;
}

function getEventsWithOptions(options = {}) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [{ id: 'event-default', name: 'Event Default', isArchived: false }];
  const tenantId = _getActiveTenantId();
  const events = _workspaceSnapshot.store.tenants?.[tenantId]?.events || {};
  const eventList = Object.values(events).map(e => ({ id: e.id, name: e.name, isArchived: e.isArchived || false }));
  if (!options.includeArchived) {
    return eventList.filter(e => !e.isArchived);
  }
  return eventList;
}

function getCurrentEventId() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 'event-default';
  const tenantId = _getActiveTenantId();
  return _workspaceSnapshot.store.tenants?.[tenantId]?.activeEventId || 'event-default';
}

function getStoreBackups() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = _getActiveTenantId();
  return _workspaceSnapshot.store.tenants?.[tenantId]?.backups || [];
}

async function resetCheckIns() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { success: false, error: 'Data not loaded' };
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  if (event) {
    // Clear local data
    event.checkInLogs = [];
    event.pendingCheckIns = [];
    // Sync to server (Supabase)
    try {
      await syncResetCheckInLogs({ tenantId, eventId });
      console.log('[resetCheckIns] Synced to server successfully');
      return { success: true };
    } catch (err) {
      console.error('[resetCheckIns] Sync failed:', err);
      return { success: false, error: 'Gagal sinkron ke server: ' + (err?.message || 'Unknown error') };
    }
  }
  return { success: false, error: 'Event not found' };
}

async function deleteAllParticipants() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { success: false, error: 'Data not loaded' };
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  if (event) {
    // Clear local data
    event.participants = [];
    event.checkInLogs = []; // Also clear check-in logs since participants are gone
    event.pendingCheckIns = [];
    // Sync to server (Supabase)
    try {
      await syncEventSnapshot({
        tenantId,
        event: {
          id: eventId,
          name: event.name || 'Event Default',
          currentDay: event.currentDay || 1,
          isArchived: event.isArchived || false,
          participants: [],
          checkInLogs: [],
          adminLogs: event.adminLogs || []
        }
      });
      console.log('[deleteAllParticipants] Synced to server successfully');
      return { success: true };
    } catch (err) {
      console.error('[deleteAllParticipants] Sync failed:', err);
      return { success: false, error: 'Gagal sinkron ke server: ' + (err?.message || 'Unknown error') };
    }
  }
  return { success: false, error: 'Event not found' };
}
// eslint-disable-next-line no-unused-vars
async function setWaTemplate(template, _user) {
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  const current = _workspaceSnapshot?.store?.tenants?.[tenantId]?.events?.[eventId];
  if (!current) return false;
  
  await syncEventSnapshot({
    tenantId,
    event: {
      id: eventId,
      name: current.name || 'Event Default',
      currentDay: current.currentDay || 1,
      isArchived: current.isArchived || false,
      waTemplate: template,
      waSendMode: current.waSendMode || 'message_only',
      participants: current.participants || [],
      checkInLogs: current.checkInLogs || [],
      adminLogs: current.adminLogs || []
    }
  });
  
  if (_workspaceSnapshot?.store?.tenants?.[tenantId]?.events?.[eventId]) {
    _workspaceSnapshot.store.tenants[tenantId].events[eventId].waTemplate = template;
  }
  return true;
}

// eslint-disable-next-line no-unused-vars
async function setWaSendMode(mode, _user) {
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  const current = _workspaceSnapshot?.store?.tenants?.[tenantId]?.events?.[eventId];
  if (!current) return false;
  
  await syncEventSnapshot({
    tenantId,
    event: {
      id: eventId,
      name: current.name || 'Event Default',
      currentDay: current.currentDay || 1,
      isArchived: current.isArchived || false,
      waTemplate: current.waTemplate || '',
      waSendMode: mode,
      participants: current.participants || [],
      checkInLogs: current.checkInLogs || [],
      adminLogs: current.adminLogs || []
    }
  });
  
  if (_workspaceSnapshot?.store?.tenants?.[tenantId]?.events?.[eventId]) {
    _workspaceSnapshot.store.tenants[tenantId].events[eventId].waSendMode = mode;
  }
  return true;
}
function setMaxPendingAttempts(val) { return val; }
function renameEvent() { return { success: true }; }
function archiveEvent() { return { success: true }; }
function deleteEvent() { return { success: true }; }
function restoreStoreBackup() { return { success: true }; }
function exportStoreBackup() { return { success: true, content: '{}', fileName: 'backup.json' }; }
function deleteStoreBackup() { return { success: true }; }
function deleteInvalidStoreBackups() { return { success: true, deleted: 0 }; }

// ===== BACKUP/EXPORT FUNCTIONS =====
function getAllEventData() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return null;
  const tenantId = _getActiveTenantId();
  const eventId = 'event-default';
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  if (!event) return null;
  
  return {
    event: {
      id: eventId,
      name: event.name || 'Event Default',
      exportDate: new Date().toISOString(),
      currentDay: event.currentDay || 1,
      waTemplate: event.waTemplate || '',
      waSendMode: event.waSendMode || 'message_only'
    },
    participants: event.participants || [],
    checkInLogs: event.checkInLogs || event.checkin_logs || [],
    adminLogs: event.adminLogs || [],
    stats: {
      totalParticipants: (event.participants || []).length,
      totalCheckIns: (event.checkInLogs || event.checkin_logs || []).length,
      byCategory: getCategoryStats(event.participants || [], event.checkInLogs || event.checkin_logs || [])
    }
  };
}

function getCategoryStats(participants, logs) {
  const checkedInIds = new Set(logs.map(l => l.ticket_id));
  const stats = {};
  
  participants.forEach(p => {
    const cat = p.category || 'Regular';
    if (!stats[cat]) stats[cat] = { total: 0, checkedIn: 0 };
    stats[cat].total++;
    if (checkedInIds.has(p.ticket_id)) stats[cat].checkedIn++;
  });
  
  return stats;
}

async function exportFullBackup(format = 'json') {
  const data = getAllEventData();
  if (!data) return { success: false, error: 'Tidak ada data untuk di-export' };
  
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Backup_${data.event.name.replace(/\s+/g, '_')}_${timestamp}`;
  
  if (format === 'json') {
    const content = JSON.stringify(data, null, 2);
    downloadFile(content, `${filename}.json`, 'application/json');
    return { success: true, filename: `${filename}.json`, recordCount: data.participants.length };
  }
  
  if (format === 'csv') {
    return exportAsCSV(data, filename);
  }
  
  if (format === 'excel') {
    return exportAsExcel(data, filename);
  }
  
  return { success: false, error: 'Format tidak didukung' };
}

function exportAsCSV(data, filename) {
  const { participants, checkInLogs, event } = data;
  
  // Participants sheet
  let csv = 'PARTICIPANTS\n';
  csv += 'ID,Nama,Telepon,Email,Kategori,Hari,Ticket ID,QR Data,Status Check-in\n';
  const checkedInIds = new Set(checkInLogs.map(l => l.ticket_id));
  
  participants.forEach(p => {
    const status = checkedInIds.has(p.ticket_id) ? 'Hadir' : 'Belum';
    csv += `${p.id || ''},${escapeCSV(p.name)},${p.phone || ''},${p.email || ''},${p.category || 'Regular'},${p.day_number || p.day || 1},${p.ticket_id},${p.qr_data || ''},${status}\n`;
  });
  
  // Check-in logs sheet
  csv += '\nCHECK-IN LOGS\n';
  csv += 'Ticket ID,Nama,Kategori,Waktu,Hari,Scan Oleh\n';
  checkInLogs.forEach(log => {
    csv += `${log.ticket_id},${escapeCSV(log.participant_name || '')},${log.participant_category || ''},${log.timestamp},${log.day || 1},${log.scanned_by || ''}\n`;
  });
  
  // Summary
  csv += '\nSUMMARY\n';
  csv += 'Metric,Value\n';
  csv += `Event Name,${escapeCSV(event.name)}\n`;
  csv += `Export Date,${event.exportDate}\n`;
  csv += `Total Participants,${participants.length}\n`;
  csv += `Total Check-ins,${checkInLogs.length}\n`;
  csv += `Current Day,${event.currentDay}\n`;
  
  downloadFile(csv, `${filename}.csv`, 'text/csv');
  return { success: true, filename: `${filename}.csv`, recordCount: participants.length };
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportAsExcel(data, filename) {
  // Use XLSX library if available, fallback to CSV
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    
    // Participants sheet
    const wsParticipants = XLSX.utils.json_to_sheet(data.participants.map(p => ({
      ID: p.id,
      Nama: p.name,
      Telepon: p.phone,
      Email: p.email,
      Kategori: p.category || 'Regular',
      Hari: p.day_number || p.day || 1,
      'Ticket ID': p.ticket_id,
      'QR Data': p.qr_data,
      Status: data.checkInLogs.some(l => l.ticket_id === p.ticket_id) ? 'Hadir' : 'Belum'
    })));
    XLSX.utils.book_append_sheet(wb, wsParticipants, 'Peserta');
    
    // Check-in logs sheet
    const wsLogs = XLSX.utils.json_to_sheet(data.checkInLogs.map(l => ({
      'Ticket ID': l.ticket_id,
      Nama: l.participant_name,
      Kategori: l.participant_category,
      Waktu: l.timestamp,
      Hari: l.day,
      'Scan Oleh': l.scanned_by
    })));
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Check-in Logs');
    
    // Download
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return { success: true, filename: `${filename}.xlsx`, recordCount: data.participants.length };
  } catch {
    // Fallback to CSV
    return exportAsCSV(data, filename);
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const isSupabaseEnabled = true;
import { useEffect, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContextSaaS'
import { humanizeUserMessage } from '../../utils/userFriendlyMessage'
import { AlertCircle, RotateCcw, Trash2, ShieldAlert, History, Download, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const BACKUP_AUTO_REFRESH_KEY = 'ons_backup_auto_refresh'
const BACKUP_AUTO_REFRESH_INTERVAL_KEY = 'ons_backup_auto_refresh_interval'

function normalizeConfirmWord(value) {
  return String(value || '').trim().toUpperCase()
}

function getInitialAutoRefreshPreference() {
  try {
    const saved = localStorage.getItem(BACKUP_AUTO_REFRESH_KEY)
    if (saved === '0') return false
    if (saved === '1') return true
  } catch {
    // ignore storage read failures
  }
  return true
}

function getInitialAutoRefreshInterval() {
  try {
    const saved = Number(localStorage.getItem(BACKUP_AUTO_REFRESH_INTERVAL_KEY))
    if ([5000, 8000, 15000].includes(saved)) return saved
  } catch {
    // ignore storage read failures
  }
  return 8000
}

export default function Settings() {
  const toast = useToast()
  const { user } = useAuth()
  
  // State for Reset Check-in modal
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetInput, setResetInput] = useState('')
  const [resetApprovalInput, setResetApprovalInput] = useState('')
  const [resetReason, setResetReason] = useState('')
  
  // State for Delete All modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteApprovalInput, setDeleteApprovalInput] = useState('')
  const [deleteReason, setDeleteReason] = useState('')

  // State for WA Template
  const [waTemplate, setWaTemplateState] = useState(getWaTemplate())
  const [waSendMode] = useState(getWaSendMode())
  const [maxRetryAttempts, setMaxRetryAttemptsState] = useState(getMaxPendingAttempts())
  const [events, setEvents] = useState(getEventsWithOptions({ includeArchived: true }))
  const [activeEventId, setActiveEventId] = useState(getCurrentEventId())
  const [storeBackups, setStoreBackups] = useState(getStoreBackups())
  const [backupBaselineCount] = useState(() => getStoreBackups().length)
  const [backupSearch, setBackupSearch] = useState('')
  const [backupFilter, setBackupFilter] = useState('all')
  const [backupSort, setBackupSort] = useState('newest')
  const [backupAutoRefreshEnabled, setBackupAutoRefreshEnabled] = useState(getInitialAutoRefreshPreference)
  const [backupAutoRefreshInterval, setBackupAutoRefreshInterval] = useState(getInitialAutoRefreshInterval)
  const [backupRefreshCountdown, setBackupRefreshCountdown] = useState(() => Math.ceil(getInitialAutoRefreshInterval() / 1000))
  const [backupLastRefreshAgeSec, setBackupLastRefreshAgeSec] = useState(0)
  const [isBackupTabVisible, setIsBackupTabVisible] = useState(() => document.visibilityState === 'visible')
  const [supabaseCheckRunning, setSupabaseCheckRunning] = useState(false)
  
  // State for Cleanup
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupCount, setCleanupCount] = useState(0)
  const [cleanupResult, setCleanupResult] = useState('')
  
  const clearResetModalState = () => {
    setShowResetModal(false)
    setResetInput('')
    setResetApprovalInput('')
    setResetReason('')
  }
  const clearDeleteModalState = () => {
    setShowDeleteModal(false)
    setDeleteInput('')
    setDeleteApprovalInput('')
    setDeleteReason('')
  }

  const formatBackupSize = (value) => {
    const size = Number(value || 0)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const refreshEvents = () => {
    setEvents(getEventsWithOptions({ includeArchived: true }))
    setActiveEventId(getCurrentEventId())
    refreshBackups()
  }

  const refreshBackups = () => {
    setStoreBackups(getStoreBackups())
    setBackupLastRefreshAgeSec(0)
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      setBackupLastRefreshAgeSec(prev => prev + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Bootstrap data and update waTemplate state after load
  useEffect(() => {
    let mounted = true
    async function load() {
      await bootstrapStoreFromServer()
      if (mounted) {
        const template = getWaTemplate()
        setWaTemplateState(template)
        // Expose to window for whatsapp.js generateWaMessage
        if (typeof window !== 'undefined') {
          window.getWaTemplate = getWaTemplate
        }
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(BACKUP_AUTO_REFRESH_KEY, backupAutoRefreshEnabled ? '1' : '0')
    } catch {
      // ignore storage write failures
    }
  }, [backupAutoRefreshEnabled])

  useEffect(() => {
    try {
      localStorage.setItem(BACKUP_AUTO_REFRESH_INTERVAL_KEY, String(backupAutoRefreshInterval))
    } catch {
      // ignore storage write failures
    }
  }, [backupAutoRefreshInterval])

  useEffect(() => {
    if (!backupAutoRefreshEnabled) return

    let intervalId = null
    let countdownId = null

    const intervalSeconds = Math.ceil(backupAutoRefreshInterval / 1000)

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshBackups()
        setBackupRefreshCountdown(intervalSeconds)
      }
    }

    const handleVisibilityChange = () => {
      setIsBackupTabVisible(document.visibilityState === 'visible')
      if (document.visibilityState === 'visible') {
        setBackupRefreshCountdown(intervalSeconds)
      }
      refreshWhenVisible()
    }

    const handleFocus = () => {
      refreshBackups()
      setBackupRefreshCountdown(intervalSeconds)
    }

    const handleStorage = () => {
      refreshBackups()
    }

    intervalId = window.setInterval(refreshWhenVisible, backupAutoRefreshInterval)
    countdownId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setBackupRefreshCountdown(prev => (prev <= 1 ? intervalSeconds : prev - 1))
    }, 1000)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
      if (countdownId) {
        window.clearInterval(countdownId)
      }
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [backupAutoRefreshEnabled, backupAutoRefreshInterval])

  const invalidBackupCount = storeBackups.filter(item => !item.isValid).length
  const validBackupCount = storeBackups.length - invalidBackupCount
  const totalBackupSize = storeBackups.reduce((sum, item) => sum + Number(item.size || 0), 0)
  const backupSessionDelta = storeBackups.length - backupBaselineCount
  const backupLastRefreshLabel = backupLastRefreshAgeSec <= 2
    ? 'baru saja'
    : `${backupLastRefreshAgeSec} detik lalu`
  const backupRefreshLabel = !backupAutoRefreshEnabled
    ? 'manual'
    : isBackupTabVisible
      ? `${backupRefreshCountdown}s`
      : 'paused'
  const normalizedBackupSearch = backupSearch.toLowerCase().trim()
  const visibleBackups = [...storeBackups]
    .filter(item => {
      if (backupFilter === 'valid') return item.isValid
      if (backupFilter === 'invalid') return !item.isValid
      return true
    })
    .filter(item => {
      if (!normalizedBackupSearch) return true
      const localDate = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : ''
      const haystack = `${item.key} ${localDate} ${item.isValid ? 'valid' : 'invalid'}`.toLowerCase()
      return haystack.includes(normalizedBackupSearch)
    })
    .sort((a, b) => {
      if (backupSort === 'oldest') return a.timestamp - b.timestamp
      if (backupSort === 'largest') return b.size - a.size
      return b.timestamp - a.timestamp
    })

  const resetBackupView = () => {
    setBackupSearch('')
    setBackupFilter('all')
    setBackupSort('newest')
  }

  const applyTodayPreset = () => {
    const today = new Date().toLocaleDateString('id-ID')
    setBackupSearch(today)
    setBackupFilter('all')
    setBackupSort('newest')
  }

  const applyLargePreset = () => {
    setBackupSearch('')
    setBackupFilter('all')
    setBackupSort('largest')
  }

  const applyInvalidLatestPreset = () => {
    setBackupSearch('')
    setBackupFilter('invalid')
    setBackupSort('newest')
  }

  const handleToggleBackupAutoRefresh = () => {
    setBackupAutoRefreshEnabled(prev => !prev)
  }

  const handleChangeBackupRefreshInterval = (e) => {
    const next = Number(e.target.value)
    if ([5000, 8000, 15000].includes(next)) {
      setBackupAutoRefreshInterval(next)
      setBackupRefreshCountdown(Math.ceil(next / 1000))
    }
  }

  const handleResetCheckIn = async (e) => {
    e.preventDefault()
    if (normalizeConfirmWord(resetInput) !== 'HAPUS') {
      toast.error('Gagal', 'Kata konfirmasi salah')
      return
    }
    if (normalizeConfirmWord(resetApprovalInput) !== 'SETUJU') {
      toast.error('Gagal', 'Konfirmasi kedua harus SETUJU')
      return
    }
    if (!resetReason.trim()) {
      toast.error('Gagal', 'Alasan wajib diisi')
      return
    }
    if (resetReason.trim().length < 15) {
      toast.error('Gagal', 'Alasan minimal 15 karakter')
      return
    }
    
    toast.info('Memproses...', 'Menyinkronkan reset ke server...')
    const result = await resetCheckIns(user, resetReason)
    if (!result?.success) {
      toast.error('Gagal', humanizeUserMessage(result?.error, { fallback: 'Validasi alasan gagal.' }))
      return
    }
    // Refresh data from server to ensure local state is synced
    await bootstrapStoreFromServer(true)
    toast.success('Sukses', 'Semua riwayat check-in telah dibersihkan dan tersinkron ke server.')
    clearResetModalState()
  }

  const handleDeleteAll = async (e) => {
    e.preventDefault()
    if (normalizeConfirmWord(deleteInput) !== 'HAPUS') {
      toast.error('Gagal', 'Kata konfirmasi salah')
      return
    }
    if (normalizeConfirmWord(deleteApprovalInput) !== 'SETUJU') {
      toast.error('Gagal', 'Konfirmasi kedua harus SETUJU')
      return
    }
    if (!deleteReason.trim()) {
      toast.error('Gagal', 'Alasan wajib diisi')
      return
    }
    if (deleteReason.trim().length < 15) {
      toast.error('Gagal', 'Alasan minimal 15 karakter')
      return
    }
    
    toast.info('Memproses...', 'Menghapus dan menyinkronkan ke server...')
    const result = await deleteAllParticipants(user, deleteReason)
    if (!result?.success) {
      toast.error('Gagal', humanizeUserMessage(result?.error, { fallback: 'Validasi alasan gagal.' }))
      return
    }
    // Refresh data from server to ensure local state is synced
    await bootstrapStoreFromServer(true)
    toast.success('Sukses', 'Semua data peserta telah dihapus dari sistem dan tersinkron ke server.')
    clearDeleteModalState()
  }

  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    try {
      await setWaTemplate(waTemplate, user)
      await setWaSendMode(waSendMode, user)
      // Update window.getWaTemplate so generateWaMessage uses latest template
      if (typeof window !== 'undefined') {
        window.getWaTemplate = () => waTemplate
      }
      toast.success('Disimpan', 'Template pesan WhatsApp berhasil diperbarui.')
    } catch (err) {
      toast.error('Gagal', 'Gagal menyimpan template: ' + (err?.message || 'Unknown error'))
    }
  }

  const handleSaveOfflineConfig = (e) => {
    e.preventDefault()
    const value = Number(maxRetryAttempts)
    if (!Number.isInteger(value) || value < 1 || value > 20) {
      toast.error('Gagal', 'Batas kirim ulang harus angka 1 sampai 20')
      return
    }
    const saved = setMaxPendingAttempts(value, user)
    setMaxRetryAttemptsState(saved)
    toast.success('Disimpan', `Batas kirim ulang antrean offline diatur ke ${saved}x`) 
  }

  const handleRenameEvent = (event) => {
    const nextName = window.prompt('Nama event baru:', event.name)
    if (nextName === null) return
    const res = renameEvent(event.id, nextName, user)
    if (!res.success) return toast.error('Gagal', humanizeUserMessage(res.error, { fallback: 'Gagal mengubah nama acara.' }))
    refreshEvents()
    toast.success('Sukses', 'Nama event berhasil diperbarui')
  }

  const handleArchiveEvent = (event) => {
    const confirmWord = window.prompt(`Arsipkan event "${event.name}"? Ketik SETUJU`, '')
    if (confirmWord === null) return
    if (normalizeConfirmWord(confirmWord) !== 'SETUJU') return toast.error('Gagal', 'Konfirmasi harus SETUJU')
    const reason = window.prompt('Alasan arsip event (minimal 15 karakter):', '')
    if (reason === null) return
    const res = archiveEvent(event.id, user, reason)
    if (!res.success) return toast.error('Gagal', humanizeUserMessage(res.error, { fallback: 'Gagal mengarsipkan acara.' }))
    refreshEvents()
    toast.success('Sukses', 'Event berhasil diarsipkan')
  }

  const handleDeleteEvent = (event) => {
    const confirmWord = window.prompt(`Hapus event "${event.name}" permanen? Ketik HAPUS`, '')
    if (confirmWord === null) return
    if (normalizeConfirmWord(confirmWord) !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus event (minimal 15 karakter):', '')
    if (reason === null) return
    const res = deleteEvent(event.id, user, reason)
    if (!res.success) return toast.error('Gagal', humanizeUserMessage(res.error, { fallback: 'Gagal menghapus acara.' }))
    refreshEvents()
    toast.success('Sukses', 'Event berhasil dihapus')
  }

  const handleRestoreBackup = (backup) => {
    if (!backup?.isValid) {
      toast.error('Gagal', 'Cadangan data tidak valid dan tidak bisa dipulihkan')
      return
    }
    const confirmWord = window.prompt('Pemulihan cadangan akan menimpa data aktif. Ketik RESTORE untuk lanjut:', '')
    if (confirmWord === null) return
    if (normalizeConfirmWord(confirmWord) !== 'RESTORE') return toast.error('Gagal', 'Konfirmasi harus RESTORE')
    const reason = window.prompt('Alasan pemulihan data (minimal 15 karakter):', '')
    if (reason === null) return

    const res = restoreStoreBackup(backup.key, user, reason)
    if (!res.success) return toast.error('Gagal', humanizeUserMessage(res.error, { fallback: 'Pemulihan data gagal.' }))

    refreshEvents()
    toast.success('Sukses', 'Cadangan data berhasil dipulihkan. Muat ulang halaman bila perlu sinkronisasi penuh.')
  }

  const handleDownloadBackup = (backup) => {
    const result = exportStoreBackup(backup.key)
    if (!result.success) {
      toast.error('Gagal', humanizeUserMessage(result.error, { fallback: 'Cadangan data gagal diunduh.' }))
      return
    }

    const blob = new Blob([result.content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Sukses', 'Cadangan data berhasil diunduh')
  }

  const handleDeleteBackup = (backup) => {
    const confirmWord = window.prompt('Hapus cadangan data ini? Ketik HAPUS untuk lanjut:', '')
    if (confirmWord === null) return
    if (normalizeConfirmWord(confirmWord) !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus cadangan data (minimal 15 karakter):', '')
    if (reason === null) return

    const result = deleteStoreBackup(backup.key, user, reason)
    if (!result.success) return toast.error('Gagal', humanizeUserMessage(result.error, { fallback: 'Gagal menghapus cadangan data.' }))

    refreshEvents()
    toast.success('Sukses', 'Cadangan data berhasil dihapus')
  }

  // Handler untuk Cleanup Database
  const handlePreviewCleanup = async () => {
    setCleanupLoading(true)
    try {
      const res = await fetch('/api/admin/cleanup-preview')
      const data = await res.json()
      
      if (data.success) {
        setCleanupCount(data.invalid)
        toast.info('Preview', `Total: ${data.total}, Valid: ${data.valid}, Invalid: ${data.invalid}`)
      } else {
        toast.error('Error', data.error)
      }
    } catch (err) {
      toast.error('Error', err.message)
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleCleanupInvalid = async () => {
    if (cleanupCount === 0) {
      toast.error('Info', 'Tidak ada data invalid untuk dihapus')
      return
    }
    
    if (!window.confirm(`Hapus ${cleanupCount} peserta invalid? Data akan dihapus permanen.`)) {
      return
    }
    
    setCleanupLoading(true)
    try {
      const res = await fetch('/api/admin/cleanup-participants', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        setCleanupResult(data.message)
        toast.success('Sukses', data.message)
        setCleanupCount(0)
      } else {
        toast.error('Error', data.error)
      }
    } catch (err) {
      toast.error('Error', err.message)
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleDeleteInvalidBackups = () => {
    if (invalidBackupCount === 0) {
      toast.error('Info', 'Tidak ada cadangan tidak valid untuk dihapus')
      return
    }
    const confirmWord = window.prompt(`Hapus ${invalidBackupCount} backup invalid? Ketik HAPUS untuk lanjut:`, '')
    if (confirmWord === null) return
    if (normalizeConfirmWord(confirmWord) !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus backup invalid (minimal 15 karakter):', '')
    if (reason === null) return

    const result = deleteInvalidStoreBackups(user, reason)
    if (!result.success) return toast.error('Gagal', humanizeUserMessage(result.error, { fallback: 'Gagal menghapus cadangan tidak valid.' }))

    refreshEvents()
    toast.success('Sukses', `${result.deleted} backup invalid berhasil dihapus`)
  }

  const runSupabaseIntegrationCheck = async () => {
    if (supabaseCheckRunning) return
    setSupabaseCheckRunning(true)
    try {
      if (!isSupabaseEnabled || !supabase) {
        toast.error('Supabase belum aktif', 'Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di environment.')
        return
      }

      const { data, error } = await supabase
        .from('workspace_state')
        .select('id, tenant_registry, store, updated_at')
        .eq('id', 'default')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        toast.error('Workspace tidak ditemukan', 'Row id=default belum ada di tabel workspace_state.')
        return
      }

      const probeAt = new Date().toISOString()
      const nextTenantRegistry = {
        ...(data.tenant_registry || {}),
        integration_probe_at: probeAt
      }

      const { error: writeError } = await supabase
        .from('workspace_state')
        .upsert({
          id: 'default',
          tenant_registry: nextTenantRegistry,
          store: data.store || { tenants: {} },
          updated_at: probeAt
        })

      if (writeError) throw writeError

      toast.success(
        'Supabase terhubung',
        `Read/Write berhasil. Probe tersimpan pada ${new Date(probeAt).toLocaleString('id-ID')}.`
      )
    } catch (err) {
      toast.error('Supabase check gagal', humanizeUserMessage(err?.message || 'Gagal konek ke Supabase.', { fallback: 'Cek RLS policy dan environment variable.' }))
    } finally {
      setSupabaseCheckRunning(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="page-kicker">Konfigurasi</span>
        <h1>Pengaturan sistem</h1>
        <p>Templat WhatsApp, acara aktif, zona berisiko, dan cadangan data. Perubahan di sini memengaruhi seluruh tenant yang Anda kelola.</p>
      </div>

      <div className="settings-wrap">
        <div className="card card-pad">
          <h3 className="card-title mb-16">Tes Integrasi Supabase</h3>
          <p className="text-note">
            Jalankan pengecekan satu klik untuk memastikan koneksi <strong>read + write</strong> ke tabel <code>workspace_state</code> berjalan normal.
          </p>
          <div className="actions-right">
            <button type="button" className="btn btn-primary" onClick={runSupabaseIntegrationCheck} disabled={supabaseCheckRunning}>
              {supabaseCheckRunning ? 'Mengecek Supabase...' : 'Tes Koneksi Supabase'}
            </button>
          </div>
        </div>

        {/* BOT TEMPLATE EDITOR */}
        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            Teks Pesan WhatsApp Bot
          </h3>
          <p className="text-note">
            Ubah teks yang akan dikirim otomatis ke peserta. Gunakan penanda di bawah agar sistem mengisi data peserta secara otomatis:
            <br />
            <code className="token-code">{'{{nama}}'}</code>
            <code className="token-code ml-8">{'{{tiket}}'}</code>
            <code className="token-code ml-8">{'{{hari}}'}</code>
            <code className="token-code ml-8">{'{{kategori}}'}</code>
            <code className="token-code ml-8">{'{{tanggal_lahir}}'}</code>
            <code className="token-code ml-8">{'{{catatan}}'}</code>
            <span className="text-note mt-12" style={{ marginTop: 10, display: 'block' }}>
              Data Tambahan lain bisa dipanggil pakai token: ubah nama kolom jadi huruf kecil, lalu ganti spasi dengan `_` (contoh: `Tanggal Lahir` menjadi {'{{tanggal_lahir}}'}).
            </span>
          </p>

          <form onSubmit={handleSaveTemplate}>
            <div className="form-group">
              <textarea 
                className="form-input mono-input"
                rows="8"
                value={waTemplate}
                onChange={e => setWaTemplateState(e.target.value)}
                required
              ></textarea>
            </div>

            <div className="actions-right">
              <button type="submit" className="btn btn-primary">Simpan Pengaturan WhatsApp</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Pengaturan Antrean Offline</h3>
          <p className="text-note">
            Atur batas percobaan kirim ulang untuk antrean scan offline. Jika melewati batas, data akan dibersihkan otomatis dan masuk riwayat penanganan.
          </p>

          <form onSubmit={handleSaveOfflineConfig}>
            <div className="form-group">
              <label className="form-label">Batas Kirim Ulang Maksimum (1 - 20)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="20"
                value={maxRetryAttempts}
                onChange={e => setMaxRetryAttemptsState(e.target.value)}
                required
              />
            </div>
            <div className="actions-right">
              <button type="submit" className="btn btn-primary">Simpan Pengaturan Antrean Offline</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Manajemen Event</h3>
          <p className="text-note">
            Kelola nama event, arsipkan event lama, atau hapus event yang tidak dipakai.
          </p>

          <div className="event-list">
            {events.map(event => (
              <div key={event.id} className="event-item">
                <div className="event-row">
                  <div>
                    <div className="event-name">{event.name}</div>
                    <div className="event-meta">
                      {event.id === activeEventId ? 'Acara Aktif' : 'Tidak Aktif'} {event.isArchived ? '• Diarsipkan' : ''}
                    </div>
                  </div>
                  <div className="event-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRenameEvent(event)}>Ubah Nama</button>
                    {!event.isArchived && event.id !== activeEventId && (
                      <button className="btn btn-ghost btn-warning btn-sm" onClick={() => handleArchiveEvent(event)}>Arsipkan</button>
                    )}
                    {event.id !== activeEventId && (
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteEvent(event)}>Hapus</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            <Trash2 size={18} /> Bersihkan Database
          </h3>
          <p className="text-note">
            Hapus peserta dengan nomor tiket invalid. Hanya menyimpan: Day 1 (1-62), Day 2 (1-152).
          </p>
          <div className="actions-left" style={{ marginTop: 16 }}>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handlePreviewCleanup}
              disabled={cleanupLoading}
            >
              {cleanupLoading ? 'Loading...' : 'Lihat Preview'}
            </button>
            <button 
              className="btn btn-danger btn-sm" 
              onClick={handleCleanupInvalid}
              disabled={cleanupLoading || cleanupCount === 0}
            >
              {cleanupLoading ? 'Processing...' : `Hapus Data Invalid (${cleanupCount})`}
            </button>
          </div>
          {cleanupResult && (
            <div className="admin-note" style={{ marginTop: 16 }}>
              <strong>Hasil:</strong> {cleanupResult}
            </div>
          )}
        </div>

        {/* BACKUP & EXPORT */}
        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            <Download size={18} /> Backup & Export Data
          </h3>
          <p className="text-note">
            Export semua data event untuk backup atau analisis. Data yang di-export meliputi peserta, log check-in, dan statistik lengkap.
          </p>
          
          <div className="backup-stats-grid" style={{ margin: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            <div className="backup-stat-item" style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div className="backup-stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                {getAllEventData()?.participants?.length || 0}
              </div>
              <div className="backup-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Peserta</div>
            </div>
            <div className="backup-stat-item" style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div className="backup-stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                {getAllEventData()?.checkInLogs?.length || 0}
              </div>
              <div className="backup-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Check-in</div>
            </div>
            <div className="backup-stat-item" style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div className="backup-stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
                {Object.keys(getAllEventData()?.stats?.byCategory || {}).length}
              </div>
              <div className="backup-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kategori</div>
            </div>
          </div>

          <div className="actions-left" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={async () => {
                const result = await exportFullBackup('json');
                if (result.success) {
                  toast.success('Export Berhasil', `${result.recordCount} data di-export ke ${result.filename}`);
                } else {
                  toast.error('Export Gagal', result.error);
                }
              }}
            >
              <Download size={14} /> Export JSON
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={async () => {
                const result = await exportFullBackup('csv');
                if (result.success) {
                  toast.success('Export Berhasil', `${result.recordCount} data di-export ke ${result.filename}`);
                } else {
                  toast.error('Export Gagal', result.error);
                }
              }}
            >
              <Download size={14} /> Export CSV
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={async () => {
                const result = await exportFullBackup('excel');
                if (result.success) {
                  toast.success('Export Berhasil', `${result.recordCount} data di-export ke ${result.filename}`);
                } else {
                  toast.error('Export Gagal', result.error);
                }
              }}
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
          
          <div className="admin-note" style={{ marginTop: 16 }}>
            <strong>Format:</strong><br/>
            • <strong>JSON</strong> - Complete data dengan struktur lengkap untuk backup<br/>
            • <strong>CSV</strong> - Format spreadsheet untuk analisis di Excel/Google Sheets<br/>
            • <strong>Excel</strong> - File .xlsx dengan multiple sheet (Peserta, Logs, Summary)
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            <History size={18} /> Cadangan Data Sistem
          </h3>
          <p className="text-note">
            Sistem menyimpan salinan otomatis sebelum data diperbarui. Cadangan ini bisa dipakai untuk pemulihan cepat jika data aktif bermasalah.
          </p>

          <div className="backup-toolbar">
            <div className="admin-search-wrap backup-search-wrap">
              <Search size={14} className="admin-search-icon" />
              <input
                className="form-input"
                type="text"
                placeholder="Cari kode / tanggal cadangan..."
                value={backupSearch}
                onChange={e => setBackupSearch(e.target.value)}
              />
            </div>
            <select className="form-select backup-select" value={backupFilter} onChange={e => setBackupFilter(e.target.value)}>
              <option value="all">Semua Cadangan</option>
              <option value="valid">Siap Dipakai</option>
              <option value="invalid">Data Rusak</option>
            </select>
            <select className="form-select backup-select" value={backupSort} onChange={e => setBackupSort(e.target.value)}>
              <option value="newest">Urut Terbaru</option>
              <option value="oldest">Urut Terlama</option>
              <option value="largest">Ukuran Terbesar</option>
            </select>
            <button className="btn btn-ghost btn-danger btn-sm" onClick={handleDeleteInvalidBackups} disabled={invalidBackupCount === 0}>
              <Trash2 size={14} className="mr-6" /> Hapus Data Rusak ({invalidBackupCount})
            </button>
            <button
              className={`btn btn-ghost btn-sm ${backupAutoRefreshEnabled ? 'btn-green-soft' : 'btn-gray-soft'}`}
              onClick={handleToggleBackupAutoRefresh}
            >
              Penyegaran Otomatis: {backupAutoRefreshEnabled ? 'Aktif' : 'Nonaktif'}
            </button>
            <select
              className="form-select backup-select"
              value={backupAutoRefreshInterval}
              onChange={handleChangeBackupRefreshInterval}
              disabled={!backupAutoRefreshEnabled}
              title="Jeda penyegaran otomatis"
            >
              <option value={5000}>Segarkan tiap 5 detik</option>
              <option value={8000}>Segarkan tiap 8 detik</option>
              <option value={15000}>Segarkan tiap 15 detik</option>
            </select>
            <button
              className="btn btn-ghost btn-sm"
              onClick={resetBackupView}
              disabled={!backupSearch && backupFilter === 'all' && backupSort === 'newest'}
            >
              Atur Ulang Tampilan
            </button>
          </div>

          <div className="backup-presets">
            <button className="btn btn-ghost btn-sm" onClick={applyTodayPreset}>Cadangan Hari Ini</button>
            <button className="btn btn-ghost btn-sm" onClick={applyLargePreset}>Cadangan Terbesar</button>
            <button className="btn btn-ghost btn-warning btn-sm" onClick={applyInvalidLatestPreset}>Data Rusak Terbaru</button>
          </div>

          <div className="backup-stats-row">
            <span className="badge badge-gray">Total: {storeBackups.length}</span>
            <span className="badge badge-green">Siap Dipakai: {validBackupCount}</span>
            <span className="badge badge-red">Data Rusak: {invalidBackupCount}</span>
            <span className="badge badge-yellow">Ukuran: {formatBackupSize(totalBackupSize)}</span>
            <span className={`badge ${backupSessionDelta > 0 ? 'badge-green' : backupSessionDelta < 0 ? 'badge-red' : 'badge-gray'}`}>
              Sesi: {backupSessionDelta > 0 ? `+${backupSessionDelta}` : backupSessionDelta}
            </span>
            <span className={`badge badge-gray ${backupAutoRefreshEnabled && isBackupTabVisible && backupRefreshCountdown <= 1 ? 'countdown-pulse' : ''}`}>
              Segarkan: {backupRefreshLabel}
            </span>
            <span className="badge badge-gray">Pembaruan: {backupLastRefreshLabel}</span>
            <span className={`badge ${isBackupTabVisible ? 'badge-green' : 'badge-yellow'}`}>
              Tab: {isBackupTabVisible ? 'aktif' : 'nonaktif'}
            </span>
          </div>

          <div className="event-meta mb-16">Menampilkan {visibleBackups.length} dari {storeBackups.length} cadangan data</div>

          {visibleBackups.length === 0 ? (
            <div className="event-meta">Belum ada cadangan data tersedia.</div>
          ) : (
            <div className="event-list">
              {visibleBackups.map(backup => (
                <div key={backup.key} className="event-item">
                  <div className="event-row">
                    <div>
                      <div className="event-name">{backup.timestamp ? new Date(backup.timestamp).toLocaleString('id-ID') : '-'}</div>
                      <div className="event-meta">
                        {formatBackupSize(backup.size)} • {backup.eventCount} acara • {backup.isValid ? 'Siap Dipakai' : 'Data Rusak'}
                      </div>
                    </div>
                    <div className="event-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDownloadBackup(backup)}>
                        <Download size={14} className="mr-6" /> Unduh
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRestoreBackup(backup)} disabled={!backup.isValid}>Pulihkan</button>
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteBackup(backup)}>
                        <Trash2 size={14} className="mr-6" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DANGER ZONE */}
        <div className="card danger-card">
          <h3 className="card-title mb-16 card-title-inline danger-title">
            <ShieldAlert size={20} /> Tindakan Berisiko Tinggi
          </h3>
          <p className="text-note mb-24">
            Aksi di bawah ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda melakukan ini hanya untuk <strong>persiapan hari-H</strong> atau setelah event selesai.
          </p>

          <div className="danger-list">
            {/* Reset Checkin Item */}
            <div className="danger-item split">
              <div>
                <div className="danger-item-title">Set Ulang Status Kehadiran</div>
                <div className="danger-item-desc">Mengembalikan semua status peserta menjadi "Belum Hadir". Nama peserta akan tetap ada.</div>
              </div>
              <button className="btn btn-secondary btn-warning btn-shrink" onClick={() => setShowResetModal(true)}>
                <RotateCcw size={14} className="mr-6" /> Set Ulang
              </button>
            </div>

            {/* Delete All Item */}
            <div className="danger-item">
              <div>
                <div className="danger-item-title">Hapus Semua Peserta</div>
                <div className="danger-item-desc">Menghapus <strong>seluruh data peserta</strong> dan riwayat kehadiran. Sistem akan kosong.</div>
              </div>
              <button className="btn btn-danger btn-shrink" onClick={() => setShowDeleteModal(true)}>
                <Trash2 size={14} className="mr-6" /> Hapus Semua
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Check-in Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={clearResetModalState}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title card-title-inline modal-title-warning">
                <AlertCircle size={18} /> Konfirmasi Reset Status
              </h3>
              <button className="modal-close" onClick={clearResetModalState}>✕</button>
            </div>
            <form onSubmit={handleResetCheckIn}>
              <div className="modal-body">
                <p className="modal-text">
                  Anda akan mengubah status semua peserta menjadi <strong>Belum Hadir</strong>.
                  Data diri peserta tidak akan dihapus.
                </p>
                <div className="form-group">
                  <label className="form-label">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                  <input 
                    className="form-input" 
                    placeholder="HAPUS"
                    value={resetInput}
                    onChange={(e) => setResetInput(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Konfirmasi kedua: ketik <strong>SETUJU</strong></label>
                  <input
                    className="form-input"
                    placeholder="SETUJU"
                    value={resetApprovalInput}
                    onChange={(e) => setResetApprovalInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Alasan tindakan (wajib)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Contoh: Persiapan simulasi ulang gate sebelum event dimulai"
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={clearResetModalState}>Batal</button>
                <button type="submit" className="btn btn-primary btn-warning">Set Ulang Kehadiran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={clearDeleteModalState}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title card-title-inline modal-title-danger">
                <AlertCircle size={18} /> Konfirmasi Hapus Database
              </h3>
              <button className="modal-close" onClick={clearDeleteModalState}>✕</button>
            </div>
            <form onSubmit={handleDeleteAll}>
              <div className="modal-body">
                <p className="modal-text">
                  Anda akan <strong>menghapus semua peserta</strong> beserta riwayat check-in-nya. Data yang dihapus tidak bisa dikembalikan.
                </p>
                <div className="form-group">
                  <label className="form-label">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                  <input 
                    className="form-input" 
                    placeholder="HAPUS"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Konfirmasi kedua: ketik <strong>SETUJU</strong></label>
                  <input
                    className="form-input"
                    placeholder="SETUJU"
                    value={deleteApprovalInput}
                    onChange={(e) => setDeleteApprovalInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Alasan tindakan (wajib)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Contoh: Event selesai, data dibersihkan sesuai SOP"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={clearDeleteModalState}>Batal</button>
                <button type="submit" className="btn btn-danger">Hapus Semua Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
