// ===== DUMMY FUNGSI FITUR FRONTGATE (NO DUPLICATE) =====
function bootstrapStoreFromFirebase() { return Promise.resolve(); }
function syncPendingCheckIns() { return { processed: 0, synced: 0, failed: 0 }; }
function getParticipants() { return []; }
function getActiveTenant() { return { id: 'tenant-default' }; }
function enqueuePendingCheckIn() { return true; }
function checkIn() { return Promise.resolve({ success: true }); }
function manualCheckIn() { return Promise.resolve({ success: true }); }
function searchParticipants() { return []; }
function retryPendingCheckIn() { return true; }
function removePendingCheckIn() { return true; }
function clearPendingCheckIns() { return true; }
function getOfflineQueueHistory() { return []; }
function getStats() { return {}; }
function getCurrentDay() { return 1; }
function getMaxPendingAttempts() { return 5; }
function getPendingCheckIns() { return []; }
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSound } from '../../hooks/useRealtime'
import { CheckCircle, XCircle, AlertTriangle, Ban, Camera, Keyboard, Play, Square, Search, UserCheck, WifiOff, RefreshCw, Trash2, CircleHelp } from 'lucide-react'
import { exportOfflineQueueReportToCSV } from '../../utils/csvExport'
import { apiFetch } from '../../utils/api'

const SAME_QR_DEBOUNCE_MS = 1200
const VERIFY_TIMEOUT_MS = 2200
const REALTIME_REFRESH_MS = 2500

export default function FrontGate() {
  const currentDay = getCurrentDay()
  const [result, setResult] = useState(null)
  const [stats, setStats] = useState(getStats(currentDay))
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
  const lastFirebaseSyncRef = useRef(0)
  const scannerRef = useRef(null)
  const { playSuccess, playError, playVIPAlert, playWarning } = useSound()

  const refreshStats = useCallback(() => {
    setStats(getStats(currentDay))
  }, [currentDay])

  const refreshPendingState = useCallback(() => {
    const items = getPendingCheckIns()
    setPendingItems(items)
    setPendingCount(items.length)
  }, [])

  const refreshFromFirebaseIfStale = useCallback(async () => {
    const now = Date.now()
    if (now - lastFirebaseSyncRef.current < 2000) return
    lastFirebaseSyncRef.current = now
    void bootstrapStoreFromFirebase(true)
  }, [])

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
    void refreshFromFirebaseIfStale()

    let parsed
    try {
      parsed = JSON.parse(String(qrData || ''))
    } catch {
      return { valid: false, reason: 'invalid_payload', enforced: true }
    }

    const normalizedQr = String(qrData || '').trim()
    const parsedTicketId = String(parsed?.tid || '').trim()
    const parsedSecureRef = String(parsed?.r || '').trim()
    const participantPool = getParticipants()
    const matched = participantPool.find(p => String(p.qr_data || '').trim() === normalizedQr)
      || participantPool.find(p => p.ticket_id === parsedTicketId && (!parsedSecureRef || String(p.secure_ref || '').trim() === parsedSecureRef))
      || participantPool.find(p => p.ticket_id === parsedTicketId)
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
  }, [refreshFromFirebaseIfStale])

  const handleScan = useCallback(async (qrData) => {
    const now = Date.now()
    if (lastScanRef.current.data === qrData && now - lastScanRef.current.time < SAME_QR_DEBOUNCE_MS) {
      return // Abaikan jika QR yang sama discan berulang dalam jendela 5 detik
    }
    lastScanRef.current = { data: qrData, time: now }

    void refreshFromFirebaseIfStale()

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

    const verify = await verifyScanWithServer(qrData)
    if (verify.enforced && !verify.valid) {
      setResult({
        success: false,
        status: 'invalid_server',
        message: `Server verify gagal (${verify.reason})`
      })
      setShowResultDetail(false)
      playError()
      setTimeout(() => setResult(null), getResultDismissMs({ success: false, status: 'invalid_server' }))
      return
    }

    let res = checkIn(qrData)
    if (!res.success && res.status === 'invalid' && String(res.message || '').toLowerCase().includes('tidak ditemukan')) {
      // New participants may still be in-flight from admin device sync.
      // Force a fresh pull and retry once so gate scan works without manual refresh.
      setIsResolvingLatestData(true)
      try {
        await bootstrapStoreFromFirebase(true)
        res = checkIn(qrData)
      } finally {
        setIsResolvingLatestData(false)
      }
    }
    setResult(res)
    setShowResultDetail(false)

    if (res.success) {
      // VIP gets special fanfare
      if (res.participant?.category === 'VIP') {
        playVIPAlert()
      } else {
        playSuccess()
      }
    } else if (res.status === 'wrong_day') {
      playWarning()
    } else {
      playError()
    }

    refreshStats()
    setTimeout(() => setResult(null), getResultDismissMs(res))
  }, [playSuccess, playError, playVIPAlert, playWarning, scanMode, refreshFromFirebaseIfStale, refreshPendingState, refreshStats, verifyScanWithServer])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    handleScan(manualInput)
    setManualInput('')
  }

  // Manual check-in by participant ID
  const handleManualCheckIn = (participant) => {
    const res = manualCheckIn(participant.id, 'gate_front')
    setResult(res)
    setShowResultDetail(false)

    if (res.success) {
      if (res.participant?.category === 'VIP') {
        playVIPAlert()
      } else {
        playSuccess()
      }
      setSearchResults(prev => prev.map(p =>
        p.id === participant.id ? { ...p, is_checked_in: true } : p
      ))
    } else {
      playError()
    }

    refreshStats()
    setTimeout(() => setResult(null), getResultDismissMs(res))
  }

  // Search handler
  const handleSearch = (query) => {
    setSearchQuery(query)
    if (query.trim().length >= 2) {
      const results = searchParticipants(query, currentDay)
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }

  // Camera scanner
  const startCamera = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => handleScan(decodedText),
        () => {}
      )
    } catch (err) {
      console.error('Camera error:', err)
      setScanMode('manual')
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // Scanner may already be stopped.
      }
      scannerRef.current = null
    }
  }

  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  useEffect(() => {
    refreshPendingState()
  }, [refreshPendingState])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshFromFirebaseIfStale()
      refreshStats()
      refreshPendingState()
    }, REALTIME_REFRESH_MS)
    return () => window.clearInterval(intervalId)
  }, [refreshFromFirebaseIfStale, refreshPendingState, refreshStats])

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
      setTimeout(startCamera, 100)
    } else if (mode !== 'camera') {
      stopCamera()
      setScanMode(mode)
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
    if (result.status === 'wrong_day') return 'SALAH HARI'
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
    if (result.status === 'wrong_day') return 'Informasikan hari tiket yang benar.'
    if (result.status === 'invalid_server') return 'Periksa koneksi server atau arahkan ke helpdesk.'
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
      </div>

      {/* Mode Tabs - 3 tabs now */}
      <div className="tabs scanner-tabs">
        <button className={`tab ${scanMode === 'camera' ? 'active' : ''}`} onClick={() => handleModeSwitch('camera')}>
          <Camera size={16} /> Kamera
        </button>
        <button className={`tab ${scanMode === 'manual' ? 'active' : ''}`} onClick={() => handleModeSwitch('manual')}>
          <Keyboard size={16} /> Manual
        </button>
        <button className={`tab ${scanMode === 'search' ? 'active' : ''}`} onClick={() => handleModeSwitch('search')}>
          <Search size={16} /> Cari Nama
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
              <div className="scanner-result-action">{getResultActionHint()}</div>
              {canShowDetailToggle && (
                <button className="btn btn-ghost btn-sm scanner-detail-toggle" onClick={() => setShowResultDetail(prev => !prev)}>
                  {showResultDetail ? 'Sembunyikan Detail' : 'Lihat Detail'}
                </button>
              )}
              {canShowDetailToggle && showResultDetail && (
                <>
                  {result.participant && (
                    <div className="scanner-result-detail">{result.participant.name}</div>
                  )}
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
            <QuickScanButtons currentDay={currentDay} onScan={handleScan} />
          </div>

          {result && (
            <div className={`card mt-16 animate-scale-in scanner-feedback-card scanner-feedback-${getResultTone()}`}>
              <div className="scanner-feedback-body">
                <div className="scanner-feedback-icon scanner-feedback-icon-lg">{getResultIcon()}</div>
                <h2 className={`scanner-feedback-title scanner-feedback-title-lg scanner-feedback-title-${getResultTone()}`}>
                  {getResultTitle()}
                </h2>
                <p className="scanner-feedback-action">{getResultActionHint()}</p>
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
                  {searchResults.length > 0 ? `${searchResults.length} hasil ditemukan` : 'Tidak ada hasil'}
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
                <p className="scanner-feedback-action">{getResultActionHint()}</p>
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
  const unchecked = participants.filter(p => !p.is_checked_in).slice(0, 6)
  const checked = participants.filter(p => p.is_checked_in).slice(0, 2)

  return (
    <div className="quick-scan-list">
      {unchecked.length > 0 && (
        <>
          <div className="quick-scan-label">
            Belum Check-in:
          </div>
          {unchecked.map(p => (
            <button key={p.id} className="btn btn-secondary btn-sm quick-scan-btn" onClick={() => onScan(p.qr_data)}>
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
            <button key={p.id} className="btn btn-secondary btn-sm quick-scan-btn quick-scan-btn-muted" onClick={() => onScan(p.qr_data)}>
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
