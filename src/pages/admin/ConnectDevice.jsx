import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle, RefreshCw, Smartphone, LogOut, ShieldAlert } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch, getApiBaseUrl } from '../../utils/api'

export default function ConnectDevice() {
  const [waState, setWaState] = useState({ status: 'checking', isReady: false, qrCode: null })
  const [tenantSessions, setTenantSessions] = useState([])
  const [sessionsError, setSessionsError] = useState('')
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false)
  const [lastError, setLastError] = useState('')
  const toast = useToast()
  const { user } = useAuth()
  const tenantId = user?.tenant?.id || 'tenant-default'
  const canMonitorAllSessions = user?.role === 'owner' || user?.role === 'super_admin'
  const statusTone = waState.status === 'offline' ? 'offline' : waState.isReady ? 'ready' : 'pending'
  const apiSource = getApiBaseUrl() || 'Proxy lokal /api'

  useEffect(() => {
    let timer;
    let stopped = false;
    
    const checkWaStatus = async () => {
      try {
        const res = await apiFetch(`/api/wa/status?tenant_id=${encodeURIComponent(tenantId)}`)
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`)
        }

        setWaState(data)
        setLastError('')
      } catch (err) {
        setWaState({ status: 'offline', isReady: false, qrCode: null })
        setLastError(err?.message || 'Koneksi API gagal')
      }

      if (stopped) return
      const nextIntervalMs = waState?.isReady ? 3000 : 1200
      timer = setTimeout(checkWaStatus, nextIntervalMs)
    }

    checkWaStatus()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [waState?.isReady, tenantId])

  useEffect(() => {
    if (!canMonitorAllSessions) return

    let timer
    let stopped = false

    const loadSessions = async () => {
      try {
        const res = await apiFetch('/api/wa/sessions')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setTenantSessions(Array.isArray(data?.sessions) ? data.sessions : [])
        setSessionsError('')
      } catch (err) {
        setSessionsError(err?.message || 'Gagal memuat monitor sesi tenant')
      }

      if (stopped) return
      timer = setTimeout(loadSessions, 5000)
    }

    loadSessions()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [canMonitorAllSessions])

  const handleLogout = async () => {
    if (isDisconnecting) return
    setIsDisconnecting(true)

    try {
      const res = await apiFetch(`/api/wa/logout?tenant_id=${encodeURIComponent(tenantId)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.success === false) {
        const msg = data?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }

      setWaState({ status: 'qr', isReady: false, qrCode: null })
      if (data?.warning) {
        toast.warning('Session di-reset dengan catatan', data.warning)
      } else {
        toast.info('Session WhatsApp diputuskan.')
      }
    } catch (err) {
      toast.error('Gagal memutus server', err?.message || 'Pastikan Bot Server menyala.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleRegenerateQr = async () => {
    if (isRegeneratingQr || isDisconnecting) return
    setIsRegeneratingQr(true)

    try {
      const res = await apiFetch(`/api/wa/logout?tenant_id=${encodeURIComponent(tenantId)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }

      setWaState({ status: 'qr', isReady: false, qrCode: null })
      setLastError('')
      toast.info('QR diperbarui', 'Silakan scan kode QR terbaru.')
    } catch (err) {
      toast.error('Gagal membuat QR baru', err?.message || 'Coba lagi beberapa detik.')
    } finally {
      setIsRegeneratingQr(false)
    }
  }

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Tautkan Perangkat (Bot WA)</h1>
          <p>Kelola koneksi nomor WhatsApp panitia untuk pengiriman tiket otomatis.</p>
        </div>
      </div>

      <div className="admin-grid-2">
        {/* Kolom Informasi & Status */}
        <div className="card admin-panel">
          <div className="status-head">
            <div className={`status-bubble ${statusTone}`}>
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="status-title">Status Koneksi Server</h3>
              <div className="status-subtitle">
                {waState.status === 'offline' ? 'Server Terputus' : waState.isReady ? 'Sedang Aktif' : 'Menunggu Login'}
              </div>
            </div>
          </div>

          <div className="admin-note">
            <h4 className="admin-note-title">
              <ShieldAlert size={16} /> Cara Kerja Sistem Otomatis
            </h4>
            <ul className="admin-note-list">
              <li>Sistem ini akan meminjam nomor WhatsApp yang sedang kalian "Tautkan" (Scan).</li>
              <li>Aplikasi web membutuhkan server lokal (`Mulai_Event_Platform.bat`) aktif di memori untuk mengirimnya.</li>
              <li>Tampilan QR akan disegarkan (*refresh*) otomatis jika kadaluwarsa.</li>
            </ul>
          </div>

          {waState.isReady && (
            <button onClick={handleLogout} className="btn btn-danger admin-full-btn" disabled={isDisconnecting}>
              {isDisconnecting ? <RefreshCw size={18} className="animate-spin" /> : <LogOut size={18} />} {isDisconnecting ? 'Memutuskan koneksi...' : 'Putuskan Koneksi WA (Logout)'}
            </button>
          )}
        </div>

        {/* Kolom Scanner layaknya Web WhatsApp */}
        <div className="card admin-qr-shell">
          {!['offline', 'ready', 'qr'].includes(waState.status) && (
            <div className="admin-center">
              <div className="status-icon-danger"><RefreshCw size={64} className="animate-spin" /></div>
              <h2>Menunggu Kode QR</h2>
              <p className="status-note">Server sedang menyiapkan QR login WhatsApp. Jika terlalu lama, tekan tombol di bawah untuk memaksa refresh sesi.</p>
              <p className="status-note"><b>Status:</b> {waState.status}</p>
              <p className="status-note"><b>API Target:</b> {apiSource}</p>
              <button onClick={handleRegenerateQr} className="btn btn-primary admin-full-btn" disabled={isRegeneratingQr || isDisconnecting}>
                {isRegeneratingQr ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />} {isRegeneratingQr ? 'Memproses...' : 'Generate Ulang QR'}
              </button>
            </div>
          )}

          {waState.status === 'offline' && (
            <div className="admin-center">
              <div className="status-icon-danger"><RefreshCw size={64} /></div>
              <h2>Bot Server Terputus</h2>
              <p className="status-note">Sistem gagal mendeteksi server bot. Pastikan backend WhatsApp berjalan di URL yang diatur lewat <b>VITE_API_BASE_URL</b> atau, saat development lokal, lewat proxy Vite ke port 3001.</p>
              <p className="status-note"><b>API Target:</b> {apiSource}</p>
              {lastError && <p className="status-note"><b>Detail:</b> {lastError}</p>}
              <button onClick={handleRegenerateQr} className="btn btn-primary admin-full-btn" disabled={isRegeneratingQr || isDisconnecting}>
                {isRegeneratingQr ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />} {isRegeneratingQr ? 'Memproses...' : 'Coba Sambungkan Lagi'}
              </button>
            </div>
          )}

          {waState.status === 'ready' && (
            <div className="admin-center">
              <div className="status-icon-success"><CheckCircle size={80} /></div>
              <h2>Perangkat Terhubung Sempurna!</h2>
              <p className="status-note">Nomor penyelenggara yang digunakan saat scan tadi akan bertugas mengirim tiket setiap kali Anda mencentang tombol "Simpan & Auto-Kirim" di halaman pendaftaran peserta.</p>
            </div>
          )}

          {waState.status === 'qr' && (
            <div className="wa-qr-box">
              {waState.qrCode ? (
                <>
                  <h3 className="wa-qr-title">
                    <MessageCircle size={20} /> Pindai Kode Berikut
                  </h3>
                  <img src={waState.qrCode} alt="WhatsApp QR" className="wa-qr-image" />
                  <p className="wa-qr-help">1. Buka <b>WhatsApp</b> di Ponsel<br/>2. Ketuk <b>Titik Tiga</b> atau <b>Pengaturan</b><br/>3. Pilih <b>Perangkat Tertaut</b><br/>4. <b>Tautkan Perangkat</b> ke layar ini.</p>
                </>
              ) : (
                <div className="wa-qr-loading">
                  <RefreshCw size={40} className="animate-spin qr-spinner" />
                  <div className="wa-qr-loading-text">Meracik QR Code baru...</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {canMonitorAllSessions && (
        <div className="card mt-16">
          <div className="card-header">
            <h3 className="card-title">Monitor Sesi WA Semua Tenant</h3>
          </div>
          {sessionsError ? (
            <p className="status-note"><b>Gagal memuat:</b> {sessionsError}</p>
          ) : tenantSessions.length === 0 ? (
            <p className="status-note">Belum ada sesi tenant aktif.</p>
          ) : (
            <div className="admin-note-list">
              {tenantSessions.map((session) => (
                <div key={session.tenant_id} className="status-note" style={{ marginBottom: 8 }}>
                  <b>{session.tenant_id}</b> - {session.status} {session.isReady ? '(ready)' : ''} {session.hasQr ? '(qr)' : ''}
                  {session.lastError ? ` - error: ${session.lastError}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
