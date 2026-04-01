import { useState, useRef, useEffect, useCallback } from 'react'
import { checkIn, getStats, getCurrentDay, getParticipants, manualCheckIn, searchParticipants, enqueuePendingCheckIn, syncPendingCheckIns, getPendingCheckIns, retryPendingCheckIn, removePendingCheckIn, clearPendingCheckIns, getOfflineQueueHistory, getMaxPendingAttempts } from '../../store/mockData'
import { useSound } from '../../hooks/useRealtime'
import { CheckCircle, XCircle, AlertTriangle, Ban, Camera, Keyboard, Play, Square, Search, UserCheck, WifiOff, RefreshCw, Trash2, CircleHelp } from 'lucide-react'
import { exportOfflineQueueReportToCSV } from '../../utils/csvExport'

export default function FrontGate() {
  const currentDay = getCurrentDay()
  const [result, setResult] = useState(null)
  const [stats, setStats] = useState(getStats(currentDay))
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanMode, setScanMode] = useState('manual') // 'camera', 'manual', 'search'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(getPendingCheckIns().length)
  const [pendingItems, setPendingItems] = useState(getPendingCheckIns())
  const [isSyncing, setIsSyncing] = useState(false)
  const [showLimitInfo, setShowLimitInfo] = useState(false)
  const [isLimitInfoFading, setIsLimitInfoFading] = useState(false)
  const searchResultsRef = useRef(null) // Unused, just keeping ref pattern if needed
  const lastScanRef = useRef({ data: null, time: 0 })
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const { playSuccess, playError, playVIPAlert, playWarning } = useSound()

  const refreshStats = () => setStats(getStats(currentDay))

  const refreshPendingState = () => {
    const items = getPendingCheckIns()
    setPendingItems(items)
    setPendingCount(items.length)
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
        setResult({ success: false, status: 'sync_partial', message: `Sync selesai: ${res.synced} berhasil, ${res.failed} gagal` })
      }
      setTimeout(() => setResult(null), 3000)
    }
    setIsSyncing(false)
  }, [isSyncing])

  const handleScan = useCallback((qrData) => {
    const now = Date.now()
    if (lastScanRef.current.data === qrData && now - lastScanRef.current.time < 3000) {
      return // Abaikan jika QR yang sama discan dalam waktu < 3 detik
    }
    lastScanRef.current = { data: qrData, time: now }

    if (!navigator.onLine) {
      enqueuePendingCheckIn(qrData, 'gate_front', scanMode)
      refreshPendingState()
      setResult({
        success: true,
        status: 'queued_offline',
        message: `Offline: scan disimpan ke antrean (${getPendingCheckIns().length} pending)`
      })
      playWarning()
      setTimeout(() => setResult(null), 3000)
      return
    }

    const res = checkIn(qrData)
    setResult(res)

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
    setTimeout(() => setResult(null), 3000)
  }, [playSuccess, playError, playVIPAlert, playWarning, scanMode])

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
    setTimeout(() => setResult(null), 3000)
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
      setIsScanning(true)
    } catch (err) {
      console.error('Camera error:', err)
      setScanMode('manual')
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch (e) {}
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  useEffect(() => {
    refreshPendingState()
  }, [])

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
    if (result.status === 'synced') return 'SYNC BERHASIL'
    if (result.status === 'sync_partial') return 'SYNC SEBAGIAN'
    if (result.success) return 'CHECK-IN BERHASIL'
    if (result.status === 'duplicate') return 'SUDAH CHECK-IN'
    if (result.status === 'wrong_day') return 'SALAH HARI'
    return 'TIDAK VALID'
  }

  const handleRetryPendingItem = (itemId) => {
    if (!navigator.onLine) {
      setResult({ success: false, status: 'sync_partial', message: 'Tidak bisa retry saat offline' })
      setTimeout(() => setResult(null), 2500)
      return
    }

    const res = retryPendingCheckIn(itemId)
    refreshPendingState()
    refreshStats()

    if (res.success) {
      setResult({ success: true, status: 'synced', message: 'Item pending berhasil disinkronkan' })
    } else {
      setResult({ success: false, status: 'sync_partial', message: res.result?.message || 'Retry gagal' })
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
      setResult({ success: false, status: 'sync_partial', message: 'Tidak bisa retry all saat offline' })
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
      setResult({ success: true, status: 'synced', message: 'Laporan offline queue berhasil diexport' })
    } else {
      setResult({ success: false, status: 'sync_partial', message: 'Gagal export laporan offline queue' })
    }
    setTimeout(() => setResult(null), 2500)
  }

  return (
    <div className="scanner-container">
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>
          Front Gate Scanner
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Scan QR Code peserta
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${isOnline ? 'badge-green' : 'badge-red'}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          <span className="badge badge-yellow">Pending: {pendingCount}</span>
          {isOnline && pendingCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={handleSyncPending} disabled={isSyncing}>
              <RefreshCw size={12} style={{ marginRight: 4 }} /> {isSyncing ? 'Sync...' : 'Sync Sekarang'}
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs - 3 tabs now */}
      <div className="tabs" style={{ maxWidth: 460, width: '100%', marginBottom: 20 }}>
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
          <div id="qr-reader" style={{ width: '100%', height: '100%' }}></div>
          {result && (
            <div className={`scanner-result ${getResultClass()}`}>
              <div className="scanner-result-icon">{getResultIcon()}</div>
              <div className="scanner-result-text">
                {getResultTitle()}
              </div>
              {result.participant && (
                <div className="scanner-result-detail">{result.participant.name}</div>
              )}
              <div className="scanner-result-detail" style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 4 }}>
                {result.message}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MANUAL INPUT MODE ===== */}
      {scanMode === 'manual' && (
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="card-title mb-16">Input QR Data Manual</h3>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder='Paste QR data atau ketik JSON...'
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                autoFocus
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary">Scan</button>
            </form>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Tip: Untuk testing, klik tombol "Quick Scan" di bawah
            </p>
          </div>

          <div className="card">
            <h3 className="card-title mb-8">Quick Scan (Demo)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Klik untuk simulasi scan peserta
            </p>
            <QuickScanButtons currentDay={currentDay} onScan={handleScan} />
          </div>

          {result && (
            <div className={`card mt-16 animate-scale-in`} style={{
              borderColor: result.success ? 'var(--success)' : result.status === 'warning' ? 'var(--warning)' : 'var(--danger)',
              boxShadow: result.success ? '0 0 30px var(--success-glow)' : result.status === 'wrong_day' ? '0 0 30px rgba(245, 158, 11, 0.3)' : '0 0 30px var(--danger-glow)'
            }}>
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: '3rem', animation: 'successPop 0.5s ease-out' }}>{getResultIcon()}</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', color: result.success ? 'var(--success)' : result.status === 'wrong_day' ? 'var(--warning)' : 'var(--danger)', marginTop: 8 }}>
                  {getResultTitle()}
                </h2>
                {result.participant && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{result.participant.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {result.participant.ticket_id} · {result.participant.category}
                    </div>
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>{result.message}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== SEARCH & CHECK-IN BY NAME MODE ===== */}
      {scanMode === 'search' && (
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="card-title mb-12" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={18} /> Manual Check-in
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Cari nama peserta jika QR Code bermasalah
            </p>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                placeholder="Ketik nama atau ticket ID..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h3 className="card-title" style={{ fontSize: '0.85rem' }}>
                  {searchResults.length > 0 ? `${searchResults.length} hasil ditemukan` : 'Tidak ada hasil'}
                </h3>
              </div>
              <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                {searchResults.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s'
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.85rem', color: 'white', flexShrink: 0,
                      background: p.category === 'VIP' ? 'var(--yamaha-red)' : p.category === 'Dealer' ? 'var(--info)' : p.category === 'Media' ? 'var(--warning)' : 'var(--text-muted)'
                    }}>
                      {p.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge badge-${p.category === 'VIP' ? 'red' : p.category === 'Dealer' ? 'blue' : p.category === 'Media' ? 'yellow' : 'gray'}`}>{p.category}</span>
                        {p.ticket_id}
                      </div>
                    </div>
                    {p.is_checked_in ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                        <CheckCircle size={16} /> Hadir
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleManualCheckIn(p)}
                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
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
            <div className={`card mt-16 animate-scale-in`} style={{
              borderColor: result.success ? 'var(--success)' : 'var(--danger)',
              boxShadow: result.success ? '0 0 30px var(--success-glow)' : '0 0 30px var(--danger-glow)'
            }}>
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: '2.5rem' }}>{getResultIcon()}</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.3rem', color: result.success ? 'var(--success)' : 'var(--danger)', marginTop: 8 }}>
                  {getResultTitle()}
                </h2>
                {result.participant && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{result.participant.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {result.participant.ticket_id} · {result.participant.category}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="scanner-stats">
        <div className="scanner-stat">
          <div className="scanner-stat-value" style={{ color: 'var(--success)' }}>{stats.checkedIn}</div>
          <div className="scanner-stat-label">Sudah Masuk</div>
        </div>
        <div className="scanner-stat">
          <div className="scanner-stat-value">{stats.total}</div>
          <div className="scanner-stat-label">Total</div>
        </div>
        <div className="scanner-stat">
          <div className="scanner-stat-value" style={{ color: 'var(--yamaha-red)' }}>{stats.percentage}%</div>
          <div className="scanner-stat-label">Progress</div>
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 560, marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WifiOff size={16} /> Antrean Offline
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="badge badge-yellow">{pendingCount} pending</span>
            <span className={`badge ${getLimitBadgeClass()}`}>
              Limit: {getMaxPendingAttempts()}x
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowLimitInfo(prev => !prev)}
              title="Info warna retry limit"
            >
              <CircleHelp size={12} />
            </button>
            {pendingCount > 0 && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={handleRetryAllPending} disabled={!isOnline || isSyncing} title="Retry semua item">
                  <RefreshCw size={12} />
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleClearAllPending} title="Hapus semua antrean" style={{ color: 'var(--danger)' }}>
                  <Trash2 size={12} />
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm" onClick={handleExportOfflineReport} title="Export post-mortem offline queue">
              Export
            </button>
          </div>
        </div>

        {showLimitInfo && (
          <div style={{
            padding: '0 12px 10px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            opacity: isLimitInfoFading ? 0 : 1,
            transition: 'opacity 0.35s ease'
          }}>
            {getLimitBadgeInfo()}
          </div>
        )}

        {pendingItems.length === 0 ? (
          <div style={{ padding: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tidak ada antrean offline.
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {pendingItems.slice(0, 20).map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {new Date(item.created_at).toLocaleTimeString('id-ID')} · {item.source}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Attempts: {item.attempts || 0}{item.last_error ? ` · Error: ${item.last_error}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRetryPendingItem(item.id)} disabled={!isOnline} title="Retry item ini">
                  <RefreshCw size={12} />
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRemovePendingItem(item.id)} title="Hapus item ini" style={{ color: 'var(--danger)' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {unchecked.length > 0 && (
        <>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 4 }}>
            Belum Check-in:
          </div>
          {unchecked.map(p => (
            <button key={p.id} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => onScan(p.qr_data)}>
              <span style={{ color: 'var(--success)' }}><Play size={12} /></span>
              {p.name}
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{p.ticket_id}</span>
            </button>
          ))}
        </>
      )}
      {checked.length > 0 && (
        <>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 8 }}>
            Sudah Check-in (test duplikat):
          </div>
          {checked.map(p => (
            <button key={p.id} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%', opacity: 0.7 }} onClick={() => onScan(p.qr_data)}>
              <span style={{ color: 'var(--danger)' }}><Square size={10} /></span>
              {p.name}
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{p.ticket_id}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
