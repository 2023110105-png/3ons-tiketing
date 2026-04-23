// ===== IMPORT SHARED UTILITIES =====
// Using tenantUtils.js to avoid function duplication across pages
import {
  bootstrapStoreFromServer as _bootstrapStoreFromServer,
  setWorkspaceSnapshot,
  getActiveTenantId as _getActiveTenantId,
  getActiveEventId
} from '../../lib/tenantUtils';
import { syncCheckInLog, subscribeWorkspaceChanges } from '../../lib/dataSync';
import { fetchParticipants } from '../../lib/participantService';

let _workspaceSnapshot = null;
let _unsubscribeRealtime = null;
let _pendingCheckIns = [];
let _offlineQueueHistory = [];
let _checkInCache = [];

// Helper functions - dynamic tenant dari user context
function getUserName() { return localStorage.getItem('user_name') || 'Admin'; }

// Dynamic tenant ID dari user yang login
function getTenantId() {
  // Prioritas: window.currentUser > localStorage > default
  return _getActiveTenantId();
}

function getActiveTenant() { return { id: getTenantId() }; }
function generateOfflineId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function savePendingCheckIns() { localStorage.setItem('pending_checkins', JSON.stringify(_pendingCheckIns)); }

async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await _bootstrapStoreFromServer();
  
  // Also fetch participants directly from Supabase for realtime data
  const tenantId = getTenantId();
  const eventId = getActiveEventId();
  
  if (tenantId && eventId) {
    try {
      const dbParticipants = await fetchParticipants(tenantId, eventId);
      console.log(`[FrontGate] Fetched ${dbParticipants.length} participants directly from DB for event ${eventId}`);
      
      // Ensure workspace structure exists and merge DB participants
      if (!_workspaceSnapshot) _workspaceSnapshot = { store: { tenants: {} } };
      if (!_workspaceSnapshot.store) _workspaceSnapshot.store = { tenants: {} };
      if (!_workspaceSnapshot.store.tenants[tenantId]) {
        _workspaceSnapshot.store.tenants[tenantId] = { events: {} };
      }
      if (!_workspaceSnapshot.store.tenants[tenantId].events) {
        _workspaceSnapshot.store.tenants[tenantId].events = {};
      }
      if (!_workspaceSnapshot.store.tenants[tenantId].events[eventId]) {
        _workspaceSnapshot.store.tenants[tenantId].events[eventId] = {};
      }
      
      // Use DB participants as source of truth
      _workspaceSnapshot.store.tenants[tenantId].events[eventId].participants = dbParticipants;
    } catch (err) {
      console.error('[FrontGate] Failed to fetch participants from DB:', err);
    }
  } else {
    console.error('[FrontGate] Missing tenantId or eventId:', { tenantId, eventId });
  }
  
  setWorkspaceSnapshot(_workspaceSnapshot);
  return _workspaceSnapshot;
}

function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getTenantId();
  const eventId = getActiveEventId();
  if (!eventId) {
    console.error('[getParticipants] No active event ID found');
    return [];
  }
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}

function getCurrentDay() { return 1; }

function getStats(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { total: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0 };
  const participants = getParticipants(day);
  const checkInLogs = getCheckInLogs(day);
  const checkedInTicketIds = new Set(checkInLogs.map(log => log.ticket_id));
  const total = participants.length;
  const checkedIn = checkedInTicketIds.size;
  const notCheckedIn = total - checkedIn;
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  return { total, checkedIn, notCheckedIn, percentage };
}

function getCheckInLogs(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getTenantId();
  const eventId = getActiveEventId();
  if (!eventId) {
    console.error('[getCheckInLogs] No active event ID found');
    return [];
  }
  // Support both field names for backward compatibility
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  const logs = event?.checkInLogs || event?.checkin_logs || [];
  return logs.filter(l => !day || Number(l.day) === Number(day) || Number(l.day_number) === Number(day));
}

function searchParticipants(query, day) {
  const participants = getParticipants(day);
  if (!query) return participants;
  const keyword = String(query).toLowerCase().trim();
  return participants.filter(p =>
    (p.name && p.name.toLowerCase().includes(keyword)) ||
    (p.ticket_id && p.ticket_id.toLowerCase().includes(keyword)) ||
    (p.phone && p.phone.toLowerCase().includes(keyword))
  );
}

function enqueuePendingCheckIn(checkInData) {
  _pendingCheckIns.push({
    ...checkInData,
    timestamp: new Date().toISOString(),
    attempts: 0
  });
  return true;
}

function getPendingCheckIns() {
  return _pendingCheckIns;
}

function removePendingCheckIn(ticketId) {
  _pendingCheckIns = _pendingCheckIns.filter(item => item.ticket_id !== ticketId);
  return true;
}

function clearPendingCheckIns() {
  _pendingCheckIns = [];
  return true;
}

function getOfflineQueueHistory(limit = 100) {
  return _offlineQueueHistory.slice(0, limit);
}

function getMaxPendingAttempts() {
  return 5;
}

async function checkIn(ticketId, day, scannedBy, qrName = '') {
  try {
    console.log(`[checkIn] Start: ticketId=${ticketId}, day=${day}`);
    // Sync data from server first to ensure we have latest participants
    await bootstrapStoreFromServer();

    // Cari peserta berdasarkan ticket_id (case-insensitive)
    const participants = getParticipants(day);
    console.log(`[checkIn] Found ${participants.length} participants for day ${day}`);
    console.log(`[checkIn] First few participants:`, participants.slice(0, 5).map(p => ({ tid: p.ticket_id, name: p.name, day: p.day_number || p.day })));
    console.log(`[checkIn] All ticketIds for day ${day}:`, participants.map(p => p.ticket_id).slice(0, 10));
    
    // Case-insensitive ticket ID search
    const searchTicketId = String(ticketId || '').trim().toLowerCase();
    let participant = participants.find(p => String(p.ticket_id || '').trim().toLowerCase() === searchTicketId);
    let matchedByName = false;
    let finalTicketId = ticketId;

    // AUTO-RECOGNITION: Jika tidak ditemukan, coba cocokkan berdasarkan nama (untuk QR lama)
    if (!participant && qrName) {
      const qrNameNormalized = String(qrName).trim().toLowerCase();
      participant = participants.find(p => {
        const pName = String(p.name || '').trim().toLowerCase();
        return pName === qrNameNormalized && Number(p.day_number || p.day) === Number(day);
      });
      
      if (participant) {
        matchedByName = true;
        finalTicketId = participant.ticket_id; // Gunakan ticket_id yang baru
        console.log(`[checkIn] Auto-recognition by name: "${qrName}" -> ${finalTicketId}`);
      }
    }

    if (!participant) {
      console.log(`[checkIn] Participant not found: ticketId=${ticketId}, day=${day}`);
      // Coba cari di semua participants tanpa filter day (case-insensitive)
      const allParticipants = getParticipants();
      console.log(`[checkIn] Total participants (all days): ${allParticipants.length}`);
      const foundInOtherDay = allParticipants.find(p => String(p.ticket_id || '').trim().toLowerCase() === searchTicketId);
      if (foundInOtherDay) {
        const foundDay = foundInOtherDay.day_number || foundInOtherDay.day || 'unknown';
        console.log(`[checkIn] Found in other day:`, { tid: foundInOtherDay.ticket_id, name: foundInOtherDay.name, day: foundDay });
        return { 
          success: false, 
          error: `Peserta terdaftar untuk Hari ${foundDay}, tapi scan untuk Hari ${day}.`, 
          status: 'wrong_day', 
          participant: foundInOtherDay,
          expectedDay: foundDay,
          scannedDay: day
        };
      }
      return { success: false, error: 'Peserta tidak terdaftar (tidak ditemukan di data terbaru)', status: 'not_registered' };
    }

    // Verify participant is properly registered with required data
    if (!participant.name || !participant.ticket_id) {
      return { success: false, error: 'Data peserta tidak valid - belum terdaftar dengan lengkap', status: 'invalid_registration' };
    }

    console.log(`[checkIn] Participant found:`, { tid: participant.ticket_id, name: participant.name, day: participant.day_number || participant.day });
    
    // Check if already checked in (case-insensitive)
    const existingLogs = getCheckInLogs(day);
    const finalTicketIdLower = String(finalTicketId || '').trim().toLowerCase();
    const alreadyCheckedIn = existingLogs.some(log => String(log.ticket_id || '').trim().toLowerCase() === finalTicketIdLower);
    if (alreadyCheckedIn) {
      return { success: false, error: 'Peserta sudah check-in', alreadyCheckedIn: true, status: 'duplicate', participant };
    }

    // Add to check-in logs
    const tenantId = getTenantId();
    const eventId = getActiveEventId();
    // Use participant's actual ticket_id from database (not from QR) for consistency
    const actualTicketId = participant.ticket_id || finalTicketId;
    const newLog = {
      id: `${actualTicketId}_${Date.now()}`,
      ticket_id: actualTicketId,
      scanned_by: scannedBy,
      timestamp: new Date().toISOString(),
      day: day,
      day_number: day,
      tenant_id: tenantId,
      event_id: eventId,
      // Participant info for BackGate/Monitor compatibility
      participant_name: participant?.name || participant?.nama || 'Unknown',
      participant_category: participant?.category || participant?.kategori || 'Regular',
      participant_ticket: actualTicketId,
      // Flag untuk auto-recognition
      auto_recognized: matchedByName,
      original_qr_ticket_id: matchedByName ? ticketId : null
    };

    // Store in memory (support both field names)
    if (_workspaceSnapshot?.store?.tenants?.[tenantId]?.events?.[eventId]) {
      const event = _workspaceSnapshot.store.tenants[tenantId].events[eventId];
      // Use checkInLogs (camelCase) as primary, fallback to checkin_logs
      if (!event.checkInLogs) event.checkInLogs = event.checkin_logs || [];
      event.checkInLogs.push(newLog);
      // Also update lowercase version for backward compatibility
      event.checkin_logs = event.checkInLogs;
    }

    // Persist to database (async, don't block response)
    void syncCheckInLog({ tenantId, eventId, log: newLog });

    console.log(`[checkIn] SUCCESS: ${participant.name} checked in for day ${day}`);

    return { 
      success: true, 
      ticket_id: actualTicketId, 
      participant, 
      status: 'success',
      auto_recognized: matchedByName,
      message: matchedByName ? 'Tiket ditemukan berdasarkan nama (QR lama)' : null
    };
  } catch {
    return { success: false, error: 'Check-in failed', status: 'error' };
  }
}

// Force check-in (override wrong_day restriction)
async function forceCheckIn(ticketId, day, scannedBy, qrName = '') {
  try {
    console.log(`[forceCheckIn] Override: ticketId=${ticketId}, day=${day}`);
    await bootstrapStoreFromServer();

    const participants = getParticipants();
    const participant = participants.find(p => p.ticket_id === ticketId);
    if (!participant) {
      return { success: false, error: 'Peserta tidak ditemukan', status: 'error' };
    }

    const finalTicketId = participant.ticket_id;
    const tenantId = getTenantId();
    const eventId = getActiveEventId();

    // Generate offline UUID
    const offlineId = generateOfflineId();
    const timestamp = new Date().toISOString();

    const newLog = {
      id: offlineId,
      ticket_id: finalTicketId,
      day: day,
      scanned_by: scannedBy,
      timestamp: timestamp,
      sync_status: 'pending',
      synced_at: null,
      qr_data: qrName || participant.name
    };

    _pendingCheckIns.push(newLog);
    savePendingCheckIns();

    const existingIndex = _checkInCache.findIndex(
      log => log.ticket_id === finalTicketId && log.day === day
    );
    if (existingIndex !== -1) {
      _checkInCache[existingIndex] = newLog;
    } else {
      _checkInCache.push(newLog);
    }

    void syncCheckInLog({ tenantId, eventId, log: newLog });

    console.log(`[forceCheckIn] SUCCESS: ${participant.name} force checked in for day ${day}`);

    return { 
      success: true, 
      ticket_id: finalTicketId, 
      participant, 
      status: 'success',
      forced: true,
      message: 'Check-in berhasil ( OVERRIDE - Salah Hari )'
    };
  } catch {
    return { success: false, error: 'Force check-in failed', status: 'error' };
  }
}

async function manualCheckIn(ticketId, scannedBy, day) {
  // Sync data first to ensure we have latest participants
  await bootstrapStoreFromServer(true);

  const participants = getParticipants();
  const participant = participants.find(p => p.ticket_id === ticketId);
  if (!participant) {
    return { success: false, error: 'Peserta tidak terdaftar (tidak ditemukan di data)', status: 'not_registered' };
  }

  // Verify participant is registered with proper data
  if (!participant.name || !participant.ticket_id) {
    return { success: false, error: 'Data peserta tidak valid (nama atau tiket ID kosong)', status: 'invalid_data' };
  }

  const checkDay = day || getCurrentDay();
  return checkIn(ticketId, checkDay, scannedBy);
}

async function syncPendingCheckIns() {
  const results = { processed: 0, synced: 0, failed: 0 };
  const pending = [..._pendingCheckIns];
  
  for (const item of pending) {
    results.processed++;
    try {
      // Parse QR data untuk mendapatkan ticket_id, day, dan nama
      let ticketId = item.ticket_id;
      let day = item.day || 1;
      let qrName = '';
      
      if (item.qr_data) {
        try {
          const parsed = parseQRData(item.qr_data);
          if (parsed && parsed.ticketId) {
            // Verify signature untuk keamanan
            const isValid = verifyQRSignature({
              tenantId: parsed.tenantId,
              eventId: parsed.eventId,
              ticketId: parsed.ticketId,
              dayNumber: parsed.dayNumber,
              signature: parsed.signature
            });
            
            if (isValid) {
              ticketId = parsed.ticketId || ticketId;
              day = parsed.dayNumber || day;
              qrName = parsed.name || ''; // Ambil nama untuk auto-recognition
            }
          }
        } catch {
          // Gunakan nilai default
        }
      }
      
      const result = await checkIn(ticketId, day, item.scanned_by, qrName);
      if (result.success) {
        results.synced++;
        removePendingCheckIn(item.ticket_id);
      } else {
        item.attempts++;
        if (item.attempts >= getMaxPendingAttempts()) {
          results.failed++;
          _offlineQueueHistory.push({
            ...item,
            type: 'sync_fail',
            error: result.error
          });
          removePendingCheckIn(item.ticket_id);
        }
      }
    } catch {
      item.attempts++;
    }
  }
  
  return results;
}

function retryPendingCheckIn(ticketId) {
  const item = _pendingCheckIns.find(p => p.ticket_id === ticketId);
  if (item) {
    item.attempts = 0;
    return true;
  }
  return false;
}
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContextSaaS'
import { useSound } from '../../hooks/useRealtime'
import { CheckCircle, XCircle, AlertTriangle, Ban, Camera, Keyboard, Play, Square, Search, UserCheck, WifiOff, RefreshCw, Trash2, CircleHelp } from 'lucide-react'
import { exportOfflineQueueReportToCSV } from '../../utils/csvExport'
import { apiFetch } from '../../utils/api'
import { parseQRData, verifyQRSignature, generateQRData } from '../../utils/qrSecurity'

const SAME_QR_DEBOUNCE_MS = 1200
const VERIFY_TIMEOUT_MS = 2200
const REALTIME_REFRESH_MS = 500

// Helper untuk ambil hari yang tersedia dari data
function getAvailableDays() {
  const participants = getParticipants()
  const days = new Set()
  participants.forEach(p => {
    const day = Number(p.day_number || p.day || 1)
    if (day > 0) days.add(day)
  })
  return Array.from(days).sort((a, b) => a - b)
}

export default function FrontGate() {
  const { user: _user } = useAuth() // Auth check - user info available if needed
  // Tenant ID otomatis dari getTenantId() via tenantUtils (reads from user context)
  void getTenantId
  
  const availableDays = getAvailableDays()
  const defaultDay = availableDays[0] || 1
  const [selectedDay, setSelectedDay] = useState(defaultDay)
  const [result, setResult] = useState(null)
  const [stats, setStats] = useState(getStats(selectedDay))
  const [manualInput, setManualInput] = useState('')
  const [scanMode, setScanMode] = useState('manual') // 'camera', 'manual', 'search'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(getPendingCheckIns().length)
  const [pendingItems, setPendingItems] = useState(getPendingCheckIns())
  const [showResultDetail, setShowResultDetail] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isResolvingLatestData, setIsResolvingLatestData] = useState(false)
  const [showLimitInfo, setShowLimitInfo] = useState(false)
  const [isLimitInfoFading, setIsLimitInfoFading] = useState(false)
  const lastScanRef = useRef({ data: null, time: 0 })
  const lastServerSyncRef = useRef(0)
  const scannerRef = useRef(null)
  const selectedDayRef = useRef(selectedDay)
  
  // Keep selectedDayRef up to date
  useEffect(() => {
    selectedDayRef.current = selectedDay
  }, [selectedDay])
  const { playSuccess, playError, playVIPAlert, playWarning } = useSound()

  const refreshStats = useCallback(() => {
    setStats(getStats(selectedDay))
  }, [selectedDay])

  const refreshPendingState = useCallback(() => {
    const items = getPendingCheckIns()
    setPendingItems(items)
    setPendingCount(items.length)
  }, [])

  const refreshFromServerIfStale = useCallback(async () => {
    const now = Date.now()
    if (now - lastServerSyncRef.current < 400) return  // 400ms debounce untuk 500ms interval
    lastServerSyncRef.current = now
    await bootstrapStoreFromServer(true)
    refreshStats()
  }, [refreshStats])

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

  const handleSyncPending = useCallback(() => {
    if (!navigator.onLine || isSyncing) return
    setIsSyncing(true)
    const res = syncPendingCheckIns()
    refreshPendingState()
    refreshStats()

    if (res.processed > 0) {
      if (res.failed === 0) {
        setResult({ success: true, status: 'synced', message: `${res.synced} scan offline berhasil disinkronkan` })
      } else {
        setResult({ success: false, status: 'sync_partial', message: `Sinkronisasi selesai: ${res.synced} berhasil, ${res.failed} gagal` })
      }
      setShowResultDetail(false)
      setTimeout(() => setResult(null), getResultDismissMs(res.failed === 0
        ? { success: true, status: 'synced' }
        : { success: false, status: 'sync_partial' }))
    }
    setIsSyncing(false)
  }, [isSyncing, refreshPendingState, refreshStats])

  const verifyScanWithServer = useCallback(async (qrData) => {
    void refreshFromServerIfStale()

    const parsed = parseQRData(qrData)
    if (!parsed) {
      return { valid: false, reason: 'invalid_payload', enforced: true }
    }

    const parsedTicketId = parsed.ticketId
    // eslint-disable-next-line no-unused-vars
    const parsedSecureRef = parsed.secureRef  // Reserved for future security validation
    const participantPool = getParticipants()
    // Cari peserta berdasarkan ticket_id dari QR data (tidak cocokkan qr_data lengkap karena ada timestamp)
    const matched = participantPool.find(p => p.ticket_id === parsedTicketId)
    // Ambil tenant_id dari tenant aktif, bukan dari QR
    const activeTenantId = getActiveTenant().id

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
      const response = await apiFetch('/api/ticket/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          qr_data: qrData,
          tenant_id: activeTenantId,
          secure_code: matched?.secure_code || '',
          secure_ref: matched?.secure_ref || ''
        })
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        return { valid: false, reason: 'verify_http_error', enforced: false }
      }

      const data = await response.json()
      return {
        valid: !!data.valid,
        reason: data.reason || 'unknown',
        mode: data.mode || 'unknown',
        enforced: true
      }
    } catch {
      return { valid: false, reason: 'verify_unreachable', enforced: false }
    }
  }, [refreshFromServerIfStale])

  const handleScan = useCallback(async (qrData) => {
    const now = Date.now()
    if (lastScanRef.current.data === qrData && now - lastScanRef.current.time < SAME_QR_DEBOUNCE_MS) {
      return // Abaikan jika QR yang sama discan berulang dalam jendela 5 detik
    }
    lastScanRef.current = { data: qrData, time: now }

    void refreshFromServerIfStale()

    if (!navigator.onLine) {
      enqueuePendingCheckIn(qrData, 'gate_front', scanMode)
      refreshPendingState()
      setResult({
        success: true,
        status: 'queued_offline',
        message: `Offline: scan disimpan ke antrean (${getPendingCheckIns().length} pending)`
      })
      setShowResultDetail(false)
      playWarning()
      setTimeout(() => setResult(null), getResultDismissMs({ success: true, status: 'queued_offline' }))
      return
    }

    // Verifikasi server (non-blocking - tidak menghentikan scan jika gagal)
    const verify = await verifyScanWithServer(qrData)
    if (!verify.valid) {
      console.info(`[ServerVerify] Non-blocking: ${verify.reason} (check-in tetap dilanjutkan)`)
      // Tetap lanjutkan scan meskipun verifikasi server gagal
    }

    // Parse QR data untuk mendapatkan ticket_id, day, dan nama
    let ticketId = '';
    let day = 1;
    let qrName = '';
    const parsed = parseQRData(qrData);
    console.log(`[handleScan] Parsed QR:`, parsed);
    if (parsed && parsed.ticketId) {
      ticketId = parsed.ticketId;
      day = parsed.dayNumber || 1;
      qrName = parsed.name || ''; // Ambil nama untuk auto-recognition
    } else {
      // Jika bukan JSON valid, gunakan qrData sebagai ticket_id langsung
      ticketId = qrData;
    }
    console.log(`[handleScan] ticketId=${ticketId}, day=${day}, qrName=${qrName}`);
    
    // Cek response dari server verify - jika ada name_matched, gunakan ticket_id dari server
    if (verify?.valid && verify?.participant?.ticket_id) {
      ticketId = verify.participant.ticket_id;
      console.log(`[handleScan] Using server-matched ticket_id: ${ticketId}`);
    }
    
    let res = await checkIn(ticketId, day, 'gate_front', qrName)
    if (!res.success && res.error?.toLowerCase().includes('tidak ditemukan')) {
      // New participants may still be in-flight from admin device sync.
      // Force a fresh pull and retry once so gate scan works without manual refresh.
      setIsResolvingLatestData(true)
      try {
        await bootstrapStoreFromServer(true)
        res = await checkIn(ticketId, day, 'gate_front', qrName)
      } finally {
        setIsResolvingLatestData(false)
      }
    }
    setResult(res)
    setShowResultDetail(false)

    if (res.success) {
      triggerSuccessHaptic()
      if (res.participant?.category === 'VIP') {
        playVIPAlert()
      } else {
        playSuccess()
      }
    } else if (res.status === 'wrong_day') {
      triggerErrorHaptic()
      playWarning()
    } else {
      triggerErrorHaptic()
      playError()
    }

    refreshStats()
    setTimeout(() => setResult(null), getResultDismissMs(res))
  }, [playSuccess, playError, playVIPAlert, playWarning, scanMode, refreshFromServerIfStale, refreshPendingState, refreshStats, verifyScanWithServer])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    handleScan(manualInput)
    setManualInput('')
  }

  // Manual check-in by participant ID - now async with server sync
  const handleManualCheckIn = async (participant) => {
    setIsResolvingLatestData(true)
    const res = await manualCheckIn(participant.ticket_id, 'gate_front', selectedDay)
    setIsResolvingLatestData(false)
    setResult(res)
    setShowResultDetail(false)

    if (res.success) {
      triggerSuccessHaptic()
      if (res.participant?.category === 'VIP') {
        playVIPAlert()
      } else {
        playSuccess()
      }
      setSearchResults(prev => prev.map(p =>
        p.ticket_id === participant.ticket_id ? { ...p, is_checked_in: true } : p
      ))
    } else {
      triggerErrorHaptic()
      playError()
    }

    refreshStats()
    setTimeout(() => setResult(null), getResultDismissMs(res))
  }

  // Search handler with sync - ensures data is fresh from server before searching
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query)
    if (query.trim().length >= 2) {
      // Sync data from server first to ensure we have latest participants
      setIsResolvingLatestData(true)
      try {
        await bootstrapStoreFromServer(true)
        refreshStats()
      } catch (err) {
        console.error('[FrontGate] Failed to sync before search:', err)
      } finally {
        setIsResolvingLatestData(false)
      }
      // Search with fresh data
      const results = searchParticipants(query, selectedDay)
      // Mark participants as registered if found in data
      const resultsWithSyncStatus = results.map(p => ({
        ...p,
        is_registered: true,
        registration_status: 'terdaftar'
      }))
      setSearchResults(resultsWithSyncStatus)
    } else {
      setSearchResults([])
    }
  }, [selectedDay, refreshStats])

  // Camera scanner
  const startCamera = async () => {
    try {
      // Tunggu sebentar agar DOM element siap
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Cek apakah element qr-reader sudah ada
      const qrElement = document.getElementById('qr-reader')
      if (!qrElement) {
        console.error('[Camera] qr-reader element not found')
        alert('Komponen scanner belum siap. Coba lagi.')
        return
      }
      
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!Html5Qrcode) {
        throw new Error('Library html5-qrcode gagal di-load')
      }
      console.log('[Camera] Html5Qrcode loaded successfully')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText),
        (errorMessage) => { console.log('[Camera] Scan error:', errorMessage) }
      )
    } catch (err) {
      console.error('[Camera] Full error:', err)
      console.error('[Camera] Error type:', typeof err)
      console.error('[Camera] Error string:', String(err))
      console.error('[Camera] Error keys:', Object.keys(err || {}))
      console.error('[Camera] Error name:', err?.name)
      console.error('[Camera] Error message:', err?.message)
      console.error('[Camera] Error stack:', err?.stack)
      
      // Parse error string untuk mendapatkan pesan yang lebih baik
      const errStr = String(err)
      let userMsg = 'Gagal mengakses kamera'
      
      if (errStr.includes('NotAllowedError')) {
        userMsg = 'Izin kamera ditolak. Klik Allow saat browser meminta izin.'
      } else if (errStr.includes('NotFoundError')) {
        userMsg = 'Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.'
      } else if (errStr.includes('NotReadableError')) {
        userMsg = 'Kamera sedang digunakan aplikasi lain. Tutup Zoom/Teams dulu.'
      } else if (errStr.includes('AbortError')) {
        userMsg = 'Akses kamera dibatalkan.'
      } else {
        userMsg = `Gagal mengakses kamera: ${errStr}`
      }
      
      alert(userMsg)
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        console.log('[Camera] Scanner stopped successfully')
      } catch (err) {
        console.log('[Camera] Stop error (may already be stopped):', err?.message)
      }
      scannerRef.current = null
    }
  }

  // Initial data load from Supabase
  useEffect(() => {
    const loadData = async () => {
      await bootstrapStoreFromServer();
      refreshStats();
      refreshPendingState();
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime subscription to capture admin data changes
  // Only run once on mount to avoid subscribe/unsubscribe cycles
  useEffect(() => {
    // Subscribe to realtime changes from Supabase and BroadcastChannel
    _unsubscribeRealtime = subscribeWorkspaceChanges((payload) => {
      const eventType = payload?.eventType || payload?.type;
      console.log('[FrontGate] Realtime update received:', eventType);
      
      // Force immediate clear and refresh for critical operations
      if (eventType === 'CHECKINS_RESET' || eventType === 'PARTICIPANTS_DELETED' || eventType === 'PARTICIPANTS_UPDATED') {
        console.log('[FrontGate] Critical data change detected, forcing full refresh...');
        // Clear local cache first
        _workspaceSnapshot = null;
      }
      
      // Refresh workspace snapshot when data changes
      void bootstrapStoreFromServer().then(() => {
        // Update stats and pending items directly using ref for current selectedDay
        setStats(getStats(selectedDayRef.current));
        setPendingCount(getPendingCheckIns().length);
        setPendingItems(getPendingCheckIns());
        console.log('[FrontGate] Data refreshed from realtime update:', eventType);
      });
    });

    // Also listen for storage events (localStorage changes from other tabs)
    const handleStorageChange = (e) => {
      if (e.key?.includes('pending_checkins') || e.key?.includes('workspace')) {
        console.log('[FrontGate] Storage change detected:', e.key);
        refreshPendingState();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (_unsubscribeRealtime) {
        _unsubscribeRealtime();
        _unsubscribeRealtime = null;
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshPendingState])

  useEffect(() => {
    return () => { 
      stopCamera()
      console.log('[FrontGate] Component unmounted, camera stopped')
    }
  }, [])

  useEffect(() => {
    refreshPendingState()
  }, [refreshPendingState])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshFromServerIfStale()
      refreshStats()
      refreshPendingState()
    }, REALTIME_REFRESH_MS)
    return () => window.clearInterval(intervalId)
  }, [refreshFromServerIfStale, refreshPendingState, refreshStats])

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      handleSyncPending()
    }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [handleSyncPending])

  useEffect(() => {
    if (!showLimitInfo) return
    setIsLimitInfoFading(false)
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

  const handleModeSwitch = (mode) => {
    if (mode === 'camera' && scanMode !== 'camera') {
      setScanMode('camera')
      // Delay lebih lama agar DOM element qr-reader siap
      setTimeout(startCamera, 500)
    } else if (mode !== 'camera') {
      stopCamera()
      setScanMode(mode)
    }
  }

  // Haptic feedback helper for mobile
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10) // Short 10ms vibration
    }
  }
  
  const triggerSuccessHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]) // Pattern: short, pause, short
    }
  }
  
  const triggerErrorHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]) // Pattern: long, pause, long
    }
  }

  const getResultClass = () => {
    if (!result) return ''
    if (result.success) return 'success'
    if (result.status === 'sync_partial') return 'warning'
    if (result.status === 'duplicate') return 'error'
    if (result.status === 'wrong_day') return 'warning'
    return 'error'
  }

  const getResultIcon = () => {
    if (!result) return ''
    if (result.status === 'queued_offline') return <WifiOff size={28} />
    if (result.status === 'synced') return <RefreshCw size={28} />
    if (result.success) return <CheckCircle size={28} />
    if (result.status === 'duplicate') return <XCircle size={28} />
    if (result.status === 'wrong_day') return <AlertTriangle size={28} />
    return <Ban size={28} />
  }

  const getResultTitle = () => {
    if (!result) return ''
    if (result.status === 'queued_offline') return 'TERSIMPAN OFFLINE'
    if (result.status === 'synced') return 'SINKRON BERHASIL'
    if (result.status === 'sync_partial') return 'SINKRON SEBAGIAN'
    if (result.status === 'invalid_server') return 'VERIFIKASI DI SERVER GAGAL'
    if (result.success) return 'CHECK-IN BERHASIL'
    if (result.status === 'duplicate') return 'SUDAH CHECK-IN'
    if (result.status === 'wrong_day') {
      return `SALAH HARI (Tiket Hari ${result.expectedDay})`;
    }
    if (result.status === 'not_registered') return 'PESERTA BELUM TERDAFTAR'
    if (result.status === 'invalid_registration') return 'REGISTRASI TIDAK VALID'
    if (result.status === 'not_found') return 'PESERTA TIDAK DITEMUKAN'
    return 'TIDAK VALID'
  }

  const getResultTone = () => {
    if (!result) return 'error'
    if (result.success) return 'success'
    if (result.status === 'wrong_day' || result.status === 'sync_partial') return 'warning'
    return 'error'
  }

  const getResultDismissMs = (res) => {
    if (!res) return 2500
    if (res.success) return 1500
    if (res.status === 'duplicate' || res.status === 'wrong_day') return 3500
    return 3000
  }

  const getResultActionHint = () => {
    if (!result) return ''
    if (result.status === 'queued_offline') return 'Lanjut scan. Data disimpan dan akan sinkron otomatis.'
    if (result.status === 'synced') return 'Sinkron berhasil. Lanjut scan berikutnya.'
    if (result.status === 'sync_partial') return 'Sebagian gagal. Coba sinkron ulang saat koneksi stabil.'
    if (result.success) return 'Silakan peserta masuk.'
    if (result.status === 'duplicate') return 'Arahkan peserta ke helpdesk untuk verifikasi ulang.'
    if (result.status === 'wrong_day') {
      return `Tiket untuk Hari ${result.expectedDay}. Saat ini Hari ${result.scannedDay}.`;
    }
    if (result.status === 'invalid_server') return 'Periksa koneksi server atau arahkan ke helpdesk.'
    if (result.status === 'not_registered') return 'Peserta belum terdaftar di sistem. Arahkan ke helpdesk untuk registrasi.'
    if (result.status === 'invalid_registration') return 'Data registrasi peserta tidak lengkap. Arahkan ke helpdesk.'
    if (result.status === 'not_found') return 'Data peserta tidak ditemukan. Arahkan ke helpdesk.'
    return 'Tiket ditolak. Arahkan ke helpdesk.'
  }

  const canShowDetailToggle = !!result && !result.success

  const getCategoryAvatarClass = (category) => {
    if (category === 'VIP') return 'm-p-avatar-vip'
    if (category === 'Dealer') return 'm-p-avatar-dealer'
    if (category === 'Media') return 'm-p-avatar-media'
    return 'm-p-avatar-regular'
  }

  const handleRetryPendingItem = (itemId) => {
    if (!navigator.onLine) {
      setResult({ success: false, status: 'sync_partial', message: 'Tidak bisa mengulang saat offline' })
      setTimeout(() => setResult(null), 2500)
      return
    }

    const res = retryPendingCheckIn(itemId)
    refreshPendingState()
    refreshStats()

    if (res.success) {
      setResult({ success: true, status: 'synced', message: 'Item pending berhasil disinkronkan' })
    } else {
      setResult({ success: false, status: 'sync_partial', message: res.result?.message || 'Pengulangan gagal' })
    }
    setTimeout(() => setResult(null), 2500)
  }

  const handleRemovePendingItem = (itemId) => {
    const confirmed = window.confirm('Hapus item pending ini dari antrean?')
    if (!confirmed) return
    removePendingCheckIn(itemId)
    refreshPendingState()
  }

  const handleRetryAllPending = () => {
    if (!navigator.onLine) {
      setResult({ success: false, status: 'sync_partial', message: 'Tidak bisa mengulang semua saat offline' })
      setTimeout(() => setResult(null), 2500)
      return
    }
    handleSyncPending()
  }

  const handleClearAllPending = () => {
    const confirmed = window.confirm(`Hapus semua antrean offline (${pendingCount} item)?`)
    if (!confirmed) return
    clearPendingCheckIns()
    refreshPendingState()
    setResult({ success: true, status: 'synced', message: 'Semua antrean offline berhasil dibersihkan' })
    setTimeout(() => setResult(null), 2500)
  }

  const handleForceCheckIn = async () => {
    if (!result || result.status !== 'wrong_day' || !result.participant) {
      return;
    }
    
    const confirmed = window.confirm(
      `⚠️ Check-in Override\n\n` +
      `Nama: ${result.participant.name}\n` +
      `Tiket: ${result.participant.ticket_id}\n\n` +
      `Tiket untuk Hari ${result.expectedDay}, tapi akan check-in untuk Hari ${result.scannedDay}.\n\n` +
      `Lanjutkan check-in?`
    );
    
    if (!confirmed) return;
    
    triggerSuccessHaptic();
    
    const res = await forceCheckIn(
      result.participant.ticket_id,
      result.scannedDay,
      getUserName(),
      result.participant.name
    );
    
    if (res.success) {
      refreshStats();
      setResult({
        success: true,
        status: 'forced',
        message: 'Check-in berhasil (OVERRIDE)',
        participant: result.participant,
        scannedDay: result.scannedDay,
        expectedDay: result.expectedDay
      });
      setTimeout(() => setResult(null), 3000);
    } else {
      triggerErrorHaptic();
      setResult({
        success: false,
        status: 'error',
        message: res.error || 'Force check-in gagal'
      });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const handleExportOfflineReport = async () => {
    const ok = await exportOfflineQueueReportToCSV(getPendingCheckIns(), getOfflineQueueHistory(1000))
    if (ok) {
      setResult({ success: true, status: 'synced', message: 'Laporan antrean offline berhasil diekspor' })
    } else {
      setResult({ success: false, status: 'sync_partial', message: 'Gagal mengekspor laporan antrean offline' })
    }
    setTimeout(() => setResult(null), 2500)
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <span className="page-kicker">Pintu masuk</span>
        <h1 className="scanner-title">
          Pemindaian tiket
        </h1>
        <p className="scanner-subtitle">
          Pindai QR, input kode manual, atau cari nama. Antrean offline disinkron saat jaringan kembali.
        </p>
        <div className="scanner-status-row">
          <span className={`badge ${isOnline ? 'badge-green' : 'badge-red'}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          <span className="badge badge-yellow">Pending: {pendingCount}</span>
          {isResolvingLatestData && (
            <span className="badge badge-blue">Sinkron data terbaru...</span>
          )}
          {isOnline && pendingCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={handleSyncPending} disabled={isSyncing}>
              <RefreshCw size={12} className="scanner-inline-icon" /> {isSyncing ? 'Menyinkronkan…' : 'Sinkron sekarang'}
            </button>
          )}
        </div>

        {/* Day Selector - Dropdown */}
        <div className="day-selector" style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginTop: '16px',
          padding: '12px 16px',
          background: 'var(--bg-secondary, #f8fafc)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e2e8f0)'
        }}>
          <label htmlFor="day-selector" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Pilih Hari:
          </label>
          <select
            id="day-selector"
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
            {availableDays.length > 0 ? (
              availableDays.map(day => (
                <option key={day} value={day}>Hari {day}</option>
              ))
            ) : (
              <option value={1}>Hari 1</option>
            )}
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
      </div>

      {/* Mode Tabs - 3 tabs now */}
      <div className="tabs scanner-tabs">
        <button className={`tab touch-feedback ${scanMode === 'camera' ? 'active' : ''}`} onClick={() => { triggerHaptic(); handleModeSwitch('camera'); }}>
          <Camera size={16} /> Kamera
        </button>
        <button className={`tab touch-feedback ${scanMode === 'manual' ? 'active' : ''}`} onClick={() => { triggerHaptic(); handleModeSwitch('manual'); }}>
          <Keyboard size={16} /> Manual
        </button>
        <button className={`tab touch-feedback ${scanMode === 'search' ? 'active' : ''}`} onClick={() => { triggerHaptic(); handleModeSwitch('search'); }}>
          <Search size={16} /> Cari
        </button>
      </div>

      {/* ===== CAMERA MODE ===== */}
      {scanMode === 'camera' && (
        <div className="scanner-viewport">
          <div id="qr-reader" className="scanner-reader"></div>
          {result && (
            <div className={`scanner-result ${getResultClass()}`}>
              <div className="scanner-result-icon">{getResultIcon()}</div>
              <div className="scanner-result-text">
                {getResultTitle()}
              </div>
              {/* Tampilkan nama dan tiket langsung saat success */}
              {result.success && result.participant && (
                <div className="scanner-result-participant">
                  <div className="scanner-result-name">{result.participant.name}</div>
                  <div className="scanner-result-ticket">{result.participant.ticket_id}</div>
                </div>
              )}
              <div className="scanner-result-action">{getResultActionHint()}</div>
              
              {/* Tombol Check-in Tetap untuk kasus wrong_day */}
              {result && result.status === 'wrong_day' && result.participant && (
                <button 
                  className="btn btn-warning btn-sm scanner-force-checkin-btn" 
                  onClick={handleForceCheckIn}
                  style={{ marginTop: '12px' }}
                >
                  <AlertTriangle size={16} /> Check-in Tetap
                </button>
              )}
              
              {canShowDetailToggle && (
                <button className="btn btn-ghost btn-sm scanner-detail-toggle" onClick={() => setShowResultDetail(prev => !prev)}>
                  {showResultDetail ? 'Sembunyikan Detail' : 'Lihat Detail'}
                </button>
              )}
              {canShowDetailToggle && showResultDetail && (
                <>
                  {result.security && (
                    <div className="scanner-result-detail scanner-result-subdetail">
                      Security: {result.security.mode} · Ref {result.security.secure_ref_mask}
                    </div>
                  )}
                  <div className="scanner-result-detail scanner-result-subdetail">
                    {result.message}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== MANUAL INPUT MODE ===== */}
      {scanMode === 'manual' && (
        <div className="scanner-panel">
          <div className="card scanner-card-spaced">
            <h3 className="card-title mb-16">Input QR Data Manual</h3>
            <form onSubmit={handleManualSubmit} className="scanner-inline-form">
              <input
                id="qr-input"
                name="qr_data"
                className="form-input"
                placeholder='Paste QR data atau ketik JSON...'
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary">Scan</button>
            </form>
            <p className="scanner-hint">
              Tip: Untuk testing, klik tombol "Quick Scan" di bawah
            </p>
          </div>

          <div className="card">
            <h3 className="card-title mb-8">Quick Scan (Demo)</h3>
            <p className="scanner-note scanner-note-tight">
              Klik untuk simulasi scan peserta
            </p>
            <QuickScanButtons currentDay={selectedDay} onScan={handleScan} />
          </div>

          {result && (
            <div className={`card mt-16 animate-scale-in scanner-feedback-card scanner-feedback-${getResultTone()}`}>
              <div className="scanner-feedback-body">
                <div className="scanner-feedback-icon scanner-feedback-icon-lg">{getResultIcon()}</div>
                <h2 className={`scanner-feedback-title scanner-feedback-title-lg scanner-feedback-title-${getResultTone()}`}>
                  {getResultTitle()}
                </h2>
                {/* Tampilkan nama dan tiket langsung saat success */}
                {result.success && result.participant && (
                  <div className="scanner-feedback-participant-highlight">
                    <div className="scanner-feedback-name-highlight">{result.participant.name}</div>
                    <div className="scanner-feedback-ticket-highlight">{result.participant.ticket_id}</div>
                  </div>
                )}
                <p className="scanner-feedback-action">{getResultActionHint()}</p>
                
                {/* Tombol Check-in Tetap untuk kasus wrong_day */}
                {result && result.status === 'wrong_day' && result.participant && (
                  <button 
                    className="scanner-force-checkin-btn" 
                    onClick={handleForceCheckIn}
                    style={{ marginTop: '12px', marginBottom: '8px' }}
                  >
                    <AlertTriangle size={16} /> Check-in Tetap (Override)
                  </button>
                )}
                
                {canShowDetailToggle && (
                  <button className="btn btn-ghost btn-sm scanner-detail-toggle scanner-detail-toggle-inline" onClick={() => setShowResultDetail(prev => !prev)}>
                    {showResultDetail ? 'Sembunyikan Detail' : 'Lihat Detail'}
                  </button>
                )}
                {canShowDetailToggle && showResultDetail && result.participant && (
                  <div className="scanner-feedback-participant">
                    <div className="scanner-feedback-name scanner-feedback-name-lg">{result.participant.name}</div>
                    <div className="scanner-feedback-meta scanner-feedback-meta-lg">
                      {result.participant.ticket_id} · {result.participant.category}
                    </div>
                  </div>
                )}
                {canShowDetailToggle && showResultDetail && result.security && (
                  <p className="scanner-feedback-meta scanner-feedback-message">
                    Security: {result.security.mode} · Ref {result.security.secure_ref_mask}
                  </p>
                )}
                {canShowDetailToggle && showResultDetail && <p className="scanner-feedback-meta scanner-feedback-message">{result.message}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== SEARCH & CHECK-IN BY NAME MODE ===== */}
      {scanMode === 'search' && (
        <div className="scanner-panel">
          <div className="card scanner-card-spaced">
            <h3 className="card-title mb-12 scanner-title-inline">
              <UserCheck size={18} /> Manual Check-in
            </h3>
            <p className="scanner-note">
              Cari nama peserta jika QR Code bermasalah
            </p>
            <div className="scanner-search-input-wrap">
              <Search size={16} className="scanner-search-icon" />
              <input
                id="search-input"
                name="search_query"
                type="text"
                className="form-input scanner-search-input"
                placeholder="Ketik nama atau ticket ID..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="search"
                aria-label="Cari peserta berdasarkan nama atau ticket ID"
                autoFocus
              />
            </div>
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="card">
              <div className="card-header scanner-results-header">
                <h3 className="card-title scanner-results-title">
                  {searchResults.length > 0 ? `${searchResults.length} hasil ditemukan (Data Tersinkron)` : 'Tidak ada hasil (Cek koneksi atau data belum terdaftar)'}
                </h3>
              </div>
              <div className="scanner-results-scroll">
                {searchResults.map(p => (
                  <div key={p.id} className="scanner-search-row">
                    <div className={`scanner-search-avatar ${getCategoryAvatarClass(p.category)}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="scanner-search-info">
                      <div className="scanner-search-name">{p.name}</div>
                      <div className="scanner-search-meta">
                        <span className={`badge badge-${p.category === 'VIP' ? 'red' : p.category === 'Dealer' ? 'blue' : p.category === 'Media' ? 'yellow' : 'gray'}`}>{p.category}</span>
                        <span className="badge badge-green">{p.registration_status || 'Terdaftar'}</span>
                        {p.ticket_id}
                      </div>
                    </div>
                    {p.is_checked_in ? (
                      <div className="scanner-search-checked">
                        <CheckCircle size={16} /> Hadir
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm scanner-search-check-btn"
                        onClick={() => handleManualCheckIn(p)}
                      >
                        <UserCheck size={14} /> Check-in
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className={`card mt-16 animate-scale-in scanner-feedback-card scanner-feedback-${getResultTone()}`}>
              <div className="scanner-feedback-body">
                <div className="scanner-feedback-icon">{getResultIcon()}</div>
                <h2 className={`scanner-feedback-title scanner-feedback-title-${getResultTone()}`}>
                  {getResultTitle()}
                </h2>
                {/* Tampilkan nama dan tiket langsung saat success */}
                {result.success && result.participant && (
                  <div className="scanner-feedback-participant-highlight">
                    <div className="scanner-feedback-name-highlight">{result.participant.name}</div>
                    <div className="scanner-feedback-ticket-highlight">{result.participant.ticket_id}</div>
                  </div>
                )}
                <p className="scanner-feedback-action">{getResultActionHint()}</p>
                
                {/* Tombol Check-in Tetap untuk kasus wrong_day */}
                {result && result.status === 'wrong_day' && result.participant && (
                  <button 
                    className="scanner-force-checkin-btn" 
                    onClick={handleForceCheckIn}
                    style={{ marginTop: '12px', marginBottom: '8px' }}
                  >
                    <AlertTriangle size={16} /> Check-in Tetap (Override)
                  </button>
                )}
                
                {canShowDetailToggle && (
                  <button className="btn btn-ghost btn-sm scanner-detail-toggle scanner-detail-toggle-inline" onClick={() => setShowResultDetail(prev => !prev)}>
                    {showResultDetail ? 'Sembunyikan Detail' : 'Lihat Detail'}
                  </button>
                )}
                {canShowDetailToggle && showResultDetail && result.participant && (
                  <div className="scanner-feedback-participant scanner-feedback-participant-tight">
                    <div className="scanner-feedback-name">{result.participant.name}</div>
                    <div className="scanner-feedback-meta">
                      {result.participant.ticket_id} · {result.participant.category}
                    </div>
                  </div>
                )}
                {canShowDetailToggle && showResultDetail && <p className="scanner-feedback-meta scanner-feedback-message">{result.message}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="scanner-stats">
        <div className="scanner-stat">
          <div className="scanner-stat-value scanner-stat-success">{stats.checkedIn}</div>
          <div className="scanner-stat-label">Sudah Masuk</div>
        </div>
        <div className="scanner-stat">
          <div className="scanner-stat-value">{stats.total}</div>
          <div className="scanner-stat-label">Total</div>
        </div>
        <div className="scanner-stat">
          <div className="scanner-stat-value scanner-stat-primary">{stats.percentage}%</div>
          <div className="scanner-stat-label">Progress</div>
        </div>
      </div>

      <div className="card scanner-offline-card">
        <div className="card-header scanner-offline-header">
          <h3 className="card-title scanner-title-inline">
            <WifiOff size={16} /> Antrean Offline
          </h3>
          <div className="offline-header-controls">
            <span className="badge badge-yellow">{pendingCount} pending</span>
            <span className={`badge ${getLimitBadgeClass()}`}>
              Limit: {getMaxPendingAttempts()}x
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowLimitInfo(prev => !prev)}
              title="Info warna batas pengulangan"
            >
              <CircleHelp size={12} />
            </button>
            {pendingCount > 0 && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={handleRetryAllPending} disabled={!isOnline || isSyncing} title="Ulangi semua item">
                  <RefreshCw size={12} />
                </button>
                <button className="btn btn-ghost btn-danger btn-sm" onClick={handleClearAllPending} title="Hapus semua antrean">
                  <Trash2 size={12} />
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm" onClick={handleExportOfflineReport} title="Ekspor laporan antrean offline">
              Export
            </button>
          </div>
        </div>

        {showLimitInfo && (
          <div className={`scanner-limit-info ${isLimitInfoFading ? 'is-fading' : ''}`}>
            {getLimitBadgeInfo()}
          </div>
        )}

        {pendingItems.length === 0 ? (
          <div className="scanner-empty-note">
            Tidak ada antrean offline.
          </div>
        ) : (
          <div className="offline-list">
            {pendingItems.slice(0, 20).map(item => (
              <div key={item.id} className="scanner-offline-item">
                <div className="scanner-offline-item-main">
                  <div className="scanner-offline-time">
                    {new Date(item.created_at).toLocaleTimeString('id-ID')} · {item.source}
                  </div>
                  <div className="scanner-offline-meta">
                    Attempts: {item.attempts || 0}{item.last_error ? ` · Error: ${item.last_error}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRetryPendingItem(item.id)} disabled={!isOnline} title="Ulangi item ini">
                  <RefreshCw size={12} />
                </button>
                <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleRemovePendingItem(item.id)} title="Hapus item ini">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Quick scan buttons for demo
function QuickScanButtons({ currentDay, onScan }) {
  const participants = getParticipants(currentDay)
  const checkInLogs = getCheckInLogs(currentDay)
  const checkedInTicketIds = new Set(checkInLogs.map(log => log.ticket_id))
  
  const unchecked = participants.filter(p => !checkedInTicketIds.has(p.ticket_id)).slice(0, 6)
  const checked = participants.filter(p => checkedInTicketIds.has(p.ticket_id)).slice(0, 2)

  // Generate fresh QR data untuk konsistensi
  const getFreshQRData = (p) => {
    // Generate QR data baru berdasarkan ticket_id dan day yang ada di data
    const tenantId = getTenantId();
    const eventId = getActiveEventId();
    if (!eventId) {
      console.error('[getFreshQRData] No active event ID found');
      return null;
    }
    return generateQRData({
      ticket_id: p.ticket_id,
      day_number: p.day_number || p.day || currentDay,
      name: p.name,
      category: p.category
    }, tenantId, eventId)
  }

  return (
    <div className="quick-scan-list">
      {unchecked.length > 0 && (
        <>
          <div className="quick-scan-label">
            Belum Check-in:
          </div>
          {unchecked.map(p => (
            <button key={p.id} className="btn btn-secondary btn-sm quick-scan-btn" onClick={() => onScan(getFreshQRData(p))}>
              <span className="quick-scan-icon success"><Play size={12} /></span>
              {p.name}
              <span className="quick-scan-ticket">{p.ticket_id}</span>
            </button>
          ))}
        </>
      )}
      {checked.length > 0 && (
        <>
          <div className="quick-scan-label quick-scan-label-spaced">
            Sudah Check-in (test duplikat):
          </div>
          {checked.map(p => (
            <button key={p.id} className="btn btn-secondary btn-sm quick-scan-btn quick-scan-btn-muted" onClick={() => onScan(getFreshQRData(p))}>
              <span className="quick-scan-icon danger"><Square size={10} /></span>
              {p.name}
              <span className="quick-scan-ticket">{p.ticket_id}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
