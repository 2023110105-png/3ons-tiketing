import { useState, useRef, useEffect, useCallback } from 'react'
import { checkIn, getStats, getCurrentDay } from '../../store/mockData'
import { useSound } from '../../hooks/useRealtime'
import './Kiosk.css'

export default function Kiosk() {
  const currentDay = getCurrentDay()
  const [result, setResult] = useState(null)
  const [stats, setStats] = useState(getStats(currentDay))
  const [isScanning, setIsScanning] = useState(false)
  const [idle, setIdle] = useState(true)
  const scannerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const lastScanRef = useRef({ data: null, time: 0 })
  const { playSuccess, playError } = useSound()

  const refreshStats = () => setStats(getStats(currentDay))

  const resetIdle = () => {
    setIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), 30000) // 30s idle
  }

  const handleScan = useCallback((qrData) => {
    const now = Date.now()
    if (lastScanRef.current.data === qrData && now - lastScanRef.current.time < 3000) {
      return // Abaikan jika QR yang sama discan dalam waktu < 3 detik
    }
    lastScanRef.current = { data: qrData, time: now }

    resetIdle()
    const res = checkIn(qrData)
    setResult(res)

    if (res.success) {
      playSuccess()
    } else {
      playError()
    }

    refreshStats()

    // Auto-reset after 5 seconds (longer for kiosk)
    setTimeout(() => {
      setResult(null)
    }, 5000)
  }, [playSuccess, playError])

  // Start camera on mount
  useEffect(() => {
    const startCamera = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('kiosk-reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText) => {
            handleScan(decodedText)
          },
          () => {}
        )
        setIsScanning(true)
      } catch (err) {
        console.error('Camera error:', err)
      }
    }

    startCamera()
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop() } catch (e) {}
      }
    }
  }, [])

  // Auto-refresh stats
  useEffect(() => {
    const interval = setInterval(refreshStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="kiosk" onClick={resetIdle}>
      {/* Idle/Attract Screen */}
      {idle && !result && (
        <div className="kiosk-attract" onClick={resetIdle}>
          <div className="kiosk-attract-bg"></div>
          <div className="kiosk-attract-content">
            <img src="/yamaha-logo.svg" alt="Yamaha" className="kiosk-attract-logo" />
            <h1 className="kiosk-attract-title">SELF CHECK-IN</h1>
            <p className="kiosk-attract-subtitle">Sentuh layar untuk mulai</p>
            <div className="kiosk-attract-tap">
              <div className="kiosk-attract-tap-circle"></div>
              <span>👆</span>
            </div>
          </div>
        </div>
      )}

      {/* Result Overlay */}
      {result && (
        <div className={`kiosk-result-overlay ${result.success ? 'success' : 'error'}`}>
          <div className="kiosk-result-card">
            <div className="kiosk-result-icon">
              {result.success ? '✅' : result.status === 'duplicate' ? '❌' : '⚠️'}
            </div>
            <div className="kiosk-result-title">
              {result.success ? 'SELAMAT DATANG!' : result.status === 'duplicate' ? 'SUDAH CHECK-IN' : 'TIKET TIDAK VALID'}
            </div>
            {result.participant && (
              <div className="kiosk-result-name">{result.participant.name}</div>
            )}
            <div className="kiosk-result-message">{result.message}</div>
            {result.participant && result.success && (
              <div className="kiosk-result-category">
                <span className={`kiosk-cat-badge ${result.participant.category.toLowerCase()}`}>
                  {result.participant.category}
                </span>
                <span className="kiosk-result-ticket">{result.participant.ticket_id}</span>
              </div>
            )}
            <div className="kiosk-result-countdown">
              Kembali dalam 5 detik...
            </div>
          </div>
        </div>
      )}

      {/* Main Scanner View */}
      <div className="kiosk-main">
        <header className="kiosk-header">
          <img src="/yamaha-logo.svg" alt="Yamaha" className="kiosk-logo" />
          <div className="kiosk-time">
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </header>

        <div className="kiosk-scanner-area">
          <h2 className="kiosk-instruction">
            Arahkan QR Code tiket Anda ke kamera
          </h2>

          <div className="kiosk-viewport">
            <div id="kiosk-reader"></div>
            <div className="kiosk-frame">
              <div className="kiosk-corners">
                <span></span>
              </div>
              <div className="kiosk-scan-line"></div>
            </div>
          </div>

          <div className="kiosk-help">
            <div className="kiosk-help-step">
              <div className="kiosk-help-num">1</div>
              <span>Siapkan tiket QR Code</span>
            </div>
            <div className="kiosk-help-arrow">→</div>
            <div className="kiosk-help-step">
              <div className="kiosk-help-num">2</div>
              <span>Arahkan ke kamera</span>
            </div>
            <div className="kiosk-help-arrow">→</div>
            <div className="kiosk-help-step">
              <div className="kiosk-help-num">3</div>
              <span>Selesai! ✓</span>
            </div>
          </div>
        </div>

        <footer className="kiosk-footer">
          <div className="kiosk-stats-bar">
            <div>
              <span className="kiosk-stats-label">HARI {currentDay}</span>
            </div>
            <div>
              <span className="kiosk-stats-value">{stats.checkedIn}</span>
              <span className="kiosk-stats-label"> / {stats.total} Peserta Hadir</span>
            </div>
            <div>
              <span className="kiosk-stats-value">{stats.percentage}%</span>
              <span className="kiosk-stats-label"> Kehadiran</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
