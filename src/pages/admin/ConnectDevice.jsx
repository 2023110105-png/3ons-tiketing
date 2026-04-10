// ===== REAL FUNCTIONS FOR CONNECT DEVICE =====
import { fetchFirebaseWorkspaceSnapshot } from '../../lib/dataSync';
let _workspaceSnapshot = null;
async function bootstrapStoreFromFirebase() {
  _workspaceSnapshot = await fetchFirebaseWorkspaceSnapshot();
  return _workspaceSnapshot;
}
function getActiveTenant() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: 'tenant-default' };
  const activeTenantId = _workspaceSnapshot.tenantRegistry?.activeTenantId || 'tenant-default';
  return { id: activeTenantId };
}
import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle, RefreshCw, Smartphone, LogOut, ShieldAlert } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/useAuth'
import { apiFetch, getApiBaseUrl } from '../../utils/api'
import { humanizeUserMessage } from '../../utils/userFriendlyMessage'
import { supabase } from '../../lib/supabase'

// Load tenant WA connection status from Supabase (siap pakai untuk integrasi)
async function _loadTenantWASettings(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Failed to load WA settings:', err);
    return null;
  }
}

// Save tenant WA connection status to Supabase (siap pakai untuk integrasi)
async function _saveTenantWASettings(tenantId, settings) {
  try {
    const { error } = await supabase
      .from('tenant_settings')
      .upsert({
        tenant_id: tenantId,
        wa_connection_status: settings.status || 'disconnected',
        wa_enabled: settings.enabled !== false,
        updated_at: new Date().toISOString(),
        ...settings
      }, { onConflict: 'tenant_id' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to save WA settings:', err);
    return false;
  }
}

function formatConnectionError(message) {
  const text = String(message || '').trim()
  if (!text) return 'Sambungan ke server belum berhasil.'

  const isPortIssue = /failed to fetch|networkerror|err_connection_refused/i.test(text)
  const looksLocalPort = /localhost|127\.0\.0\.1|0\.0\.0\.0|:3001/i.test(text)

  if (isPortIssue && looksLocalPort) {
    return 'Aplikasi belum tersambung ke server. Muat ulang halaman atau hubungi tim pendukung.'
  }

  return humanizeUserMessage(text, { fallback: 'Sambungan ke server belum berhasil. Coba lagi.' })
}

export default function ConnectDevice() {
    // Initial load tenant dari Supabase
    useEffect(() => {
      const load = async () => {
        await bootstrapStoreFromFirebase();
      };
      load();
    }, []);
  const resolveTenantId = (userValue) => {
    // admin_client harus selalu terkunci ke tenant miliknya (dari session user),
    // jangan dipengaruhi activeTenant di store.
    const fromUser = String(userValue?.tenant?.id || '').trim()
    if (userValue?.role === 'admin_client' && fromUser) return fromUser

    const fromStore = String(getActiveTenant()?.id || '').trim()
    if (fromStore) return fromStore
    return fromUser || 'tenant-default'
  }
  const [waState, setWaState] = useState({ status: 'checking', isReady: false, qrCode: null })
  const [tenantSessions, setTenantSessions] = useState([])
  const [sessionsError, setSessionsError] = useState('')
  const [sessionQuery, setSessionQuery] = useState('')
  const [sessionStatusFilter, setSessionStatusFilter] = useState('all')
  const [sessionActionTenantId, setSessionActionTenantId] = useState('')
  const [isBulkResetting, setIsBulkResetting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false)
  const [lastError, setLastError] = useState('')
  const toast = useToast()
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState(() => resolveTenantId(user))
  const canMonitorAllSessions = user?.role === 'owner'
  const canAccessConnectDevice = user?.role === 'owner' || user?.role === 'super_admin' || user?.role === 'admin_client' || user?.role === 'admin'
  const normalizedWaStatus = String(waState?.status || '').toLowerCase()
  const isOfflineState = normalizedWaStatus === 'offline' || normalizedWaStatus === 'disconnected'
  const statusTone = isOfflineState ? 'offline' : waState.isReady ? 'ready' : 'pending'
  const apiSource = getApiBaseUrl() ? 'Terhubung ke server pusat' : 'Tanpa server online (lokal)'
  const filteredSessions = tenantSessions.filter((session) => {
    const q = sessionQuery.trim().toLowerCase()
    const textHaystack = `${String(session.tenant_id || '')} ${String(session.tenant_brand || '')}`.toLowerCase()
    const textMatch = !q || textHaystack.includes(q)

    if (sessionStatusFilter === 'all') return textMatch
    if (sessionStatusFilter === 'offline') {
      const key = String(session?.status || '').toLowerCase()
      return textMatch && (key === 'offline' || key === 'disconnected')
    }

    return textMatch && String(session?.status || '').toLowerCase() === sessionStatusFilter
  })
  const sessionSummary = filteredSessions.reduce((acc, session) => {
    const key = String(session?.status || 'unknown').toLowerCase()
    if (key === 'ready') acc.ready += 1
    else if (key === 'qr') acc.qr += 1
    else if (key === 'offline' || key === 'disconnected') acc.offline += 1
    else if (key === 'checking') acc.checking += 1
    else acc.other += 1
    return acc
  }, { ready: 0, qr: 0, offline: 0, checking: 0, other: 0 })

  useEffect(() => {
    const syncTenantId = () => setTenantId(resolveTenantId(user))
    syncTenantId()
    window.addEventListener('ons-tenant-changed', syncTenantId)
    window.addEventListener('focus', syncTenantId)
    return () => {
      window.removeEventListener('ons-tenant-changed', syncTenantId)
      window.removeEventListener('focus', syncTenantId)
    }
  }, [user])

  useEffect(() => {
    let timer
    let stopped = false
    let inFlight = false

    const getNextIntervalMs = (status, isReady) => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      if (hidden) return 8000
      if (isReady || status === 'ready') return 5000
      if (status === 'checking') return 1500
      if (status === 'offline' || status === 'disconnected') return 3500
      return 2500
    }
    
    const checkWaStatus = async () => {
      if (inFlight || stopped) return
      inFlight = true
      let nextStatus = 'offline'
      let nextIsReady = false

      try {
        const res = await apiFetch(`/api/wa/status?tenant_id=${encodeURIComponent(tenantId)}`)
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`)
        }

        const nextState = {
          status: String(data?.status || 'checking').toLowerCase(),
          isReady: !!data?.isReady,
          qrCode: data?.qrCode || data?.qr_code || null,
          lastError: data?.lastError || null
        }
        setWaState(nextState)
        setLastError('')
        nextStatus = nextState.status
        nextIsReady = nextState.isReady
      } catch (err) {
        setWaState({ status: 'offline', isReady: false, qrCode: null })
        setLastError(formatConnectionError(err?.message))
        nextStatus = 'offline'
        nextIsReady = false
      } finally {
        inFlight = false
      }

      if (stopped) return
      const nextIntervalMs = getNextIntervalMs(nextStatus, nextIsReady)
      timer = setTimeout(checkWaStatus, nextIntervalMs)
    }

    checkWaStatus()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [tenantId])

  useEffect(() => {
    if (!canMonitorAllSessions) return

    let timer
    let stopped = false
    let inFlight = false

    const loadSessions = async () => {
      if (inFlight || stopped) return
      inFlight = true
      try {
        const res = await apiFetch('/api/wa/sessions')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setTenantSessions(Array.isArray(data?.sessions) ? data.sessions : [])
        setSessionsError('')
      } catch (err) {
        setSessionsError(humanizeUserMessage(err?.message, { fallback: 'Gagal memuat daftar sambungan akun.' }))
      } finally {
        inFlight = false
      }

      if (stopped) return
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      timer = setTimeout(loadSessions, hidden ? 12000 : 7000)
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
        toast.warning('Sambungan diatur ulang dengan catatan', data.warning)
      } else {
        toast.info('Sambungan WhatsApp diputuskan.')
      }
    } catch (err) {
      toast.error('Gagal memutus sambungan', humanizeUserMessage(err?.message, { fallback: 'Pastikan layanan WhatsApp berjalan lalu coba lagi.' }))
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
      toast.error('Gagal membuat QR baru', humanizeUserMessage(err?.message, { fallback: 'Coba lagi beberapa detik.' }))
    } finally {
      setIsRegeneratingQr(false)
    }
  }

  const handleResetTenantSession = async (targetTenantId) => {
    if (!targetTenantId) return
    if (sessionActionTenantId) return

    setSessionActionTenantId(targetTenantId)
    try {
      const res = await apiFetch(`/api/wa/logout?tenant_id=${encodeURIComponent(targetTenantId)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }

      toast.success('Sambungan akun direset', targetTenantId)

      // If owner resets currently active tenant, reflect state immediately.
      if (targetTenantId === tenantId) {
        setWaState({ status: 'qr', isReady: false, qrCode: null })
      }

      // Refresh monitor data after reset.
      const sessionRes = await apiFetch('/api/wa/sessions')
      const sessionData = await sessionRes.json().catch(() => ({}))
      if (sessionRes.ok) {
        setTenantSessions(Array.isArray(sessionData?.sessions) ? sessionData.sessions : [])
      }
    } catch (err) {
      toast.error('Gagal reset sambungan akun', humanizeUserMessage(err?.message, { fallback: 'Coba lagi beberapa detik.' }))
    } finally {
      setSessionActionTenantId('')
    }
  }

  const handleBulkReset = async (mode = 'offline') => {
    if (isBulkResetting || sessionActionTenantId) return

    const targets = filteredSessions
      .filter((session) => {
        const key = String(session?.status || '').toLowerCase()
        if (mode === 'offline') return key === 'offline' || key === 'disconnected'
        if (mode === 'qr') return key === 'qr'
        return key !== 'ready'
      })
      .map((session) => session.tenant_id)

    if (targets.length === 0) {
      toast.info('Tidak ada target reset', 'Sambungan pada filter saat ini tidak memerlukan reset.')
      return
    }

    const modeLabel = mode === 'offline' ? 'tidak terhubung' : mode === 'qr' ? 'kode QR' : 'belum siap'
    const confirmed = window.confirm(
      `Konfirmasi reset massal\n\nMode: ${modeLabel}\nTarget akun: ${targets.length}\n\nLanjutkan reset sambungan?`
    )
    if (!confirmed) return

    setIsBulkResetting(true)
    let successCount = 0
    let failedCount = 0

    for (const target of targets) {
      try {
        const res = await apiFetch(`/api/wa/logout?tenant_id=${encodeURIComponent(target)}`, { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.success === false) {
          failedCount += 1
        } else {
          successCount += 1
        }
      } catch {
        failedCount += 1
      }
    }

    try {
      const sessionRes = await apiFetch('/api/wa/sessions')
      const sessionData = await sessionRes.json().catch(() => ({}))
      if (sessionRes.ok) {
        setTenantSessions(Array.isArray(sessionData?.sessions) ? sessionData.sessions : [])
      }
    } catch {
      // ignore refresh errors; next polling tick will update data.
    }

    if (failedCount === 0) {
      toast.success('Reset massal selesai', `${successCount} akun berhasil direset.`)
    } else {
      toast.warning('Reset massal selesai sebagian', `Berhasil: ${successCount}, gagal: ${failedCount}`)
    }
    setIsBulkResetting(false)
  }

  if (!canAccessConnectDevice) {
    return (
      <div className="page-container animate-fade-in-up">
        <div className="card" style={{ margin: '20px auto', maxWidth: '500px', textAlign: 'center' }}>
          <h2>Akses Ditolak</h2>
          <p>Anda tidak memiliki izin untuk mengakses halaman Sambungkan WhatsApp. Hubungi admin untuk mendapatkan akses.</p>
          <p><small>Peran akun: {user?.role === 'super_admin' ? 'Admin utama' : user?.role === 'admin_client' ? 'Admin acara' : user?.role === 'admin' ? 'Admin' : user?.role === 'owner' ? 'Pemilik platform' : user?.role === 'gate_front' ? 'Petugas pintu depan' : user?.role === 'gate_back' ? 'Petugas pintu belakang' : 'Tidak diketahui'}</small></p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-kicker">Integrasi</span>
          <h1>Sambungkan WhatsApp</h1>
          <p>Hubungkan nomor layanan untuk kirim tiket otomatis. Pastikan ponsel tetap berkuasa dan terhubung internet saat sesi kirim massal.</p>
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
              <h3 className="status-title">Status Sambungan</h3>
              <div className="status-subtitle">
                {isOfflineState ? 'Tidak Terhubung' : waState.isReady ? 'Siap Digunakan' : 'Menunggu Sambungan'}
              </div>
            </div>
          </div>

          <div className="admin-note">
            <h4 className="admin-note-title">
              <ShieldAlert size={16} /> Cara Kerja
            </h4>
            <ul className="admin-note-list">
              <li>Sistem akan memakai nomor WhatsApp yang sedang disambungkan.</li>
              <li>Pastikan aplikasi dan layanan WhatsApp aktif saat digunakan.</li>
              <li>Kode QR akan diperbarui otomatis jika sudah kedaluwarsa.</li>
            </ul>
          </div>

          {waState.isReady && (
            <button onClick={handleLogout} className="btn btn-danger admin-full-btn" disabled={isDisconnecting}>
              {isDisconnecting ? <RefreshCw size={18} className="animate-spin" /> : <LogOut size={18} />} {isDisconnecting ? 'Memutuskan sambungan...' : 'Putuskan Sambungan WhatsApp'}
            </button>
          )}
        </div>

        {/* Kolom Scanner layaknya Web WhatsApp */}
        <div className="card admin-qr-shell">
          {!['offline', 'disconnected', 'ready', 'qr'].includes(normalizedWaStatus) && (
            <div className="admin-center">
              <div className="status-icon-danger"><RefreshCw size={64} className="animate-spin" /></div>
              <h2>Menunggu Kode QR</h2>
              <p className="status-note">Kode QR sedang disiapkan. Jika terlalu lama, tekan tombol di bawah untuk mencoba lagi.</p>
              <p className="status-note"><b>Status:</b> {normalizedWaStatus || '-'}</p>
              <p className="status-note"><b>Sumber sambungan:</b> {apiSource}</p>
              <button onClick={handleRegenerateQr} className="btn btn-primary admin-full-btn" disabled={isRegeneratingQr || isDisconnecting}>
                {isRegeneratingQr ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />} {isRegeneratingQr ? 'Memproses...' : 'Buat QR Baru'}
              </button>
            </div>
          )}

          {isOfflineState && (
            <div className="admin-center">
              <div className="status-icon-danger"><RefreshCw size={64} /></div>
              <h2>WhatsApp Belum Tersambung</h2>
              <p className="status-note">Sistem belum mendeteksi sambungan WhatsApp. Coba lagi dalam beberapa saat atau hubungi tim teknis.</p>
              <p className="status-note"><b>Sumber sambungan:</b> {apiSource}</p>
              {lastError && <p className="status-note"><b>Detail:</b> {lastError}</p>}
              <button onClick={handleRegenerateQr} className="btn btn-primary admin-full-btn" disabled={isRegeneratingQr || isDisconnecting}>
                {isRegeneratingQr ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />} {isRegeneratingQr ? 'Memproses...' : 'Coba Lagi'}
              </button>
            </div>
          )}

          {normalizedWaStatus === 'ready' && (
            <div className="admin-center">
              <div className="status-icon-success"><CheckCircle size={80} /></div>
              <h2>WhatsApp Sudah Siap Digunakan!</h2>
              <p className="status-note">Nomor penyelenggara yang digunakan saat scan tadi akan bertugas mengirim tiket setiap kali Anda mencentang tombol "Simpan & Auto-Kirim" di halaman pendaftaran peserta.</p>
            </div>
          )}

          {normalizedWaStatus === 'qr' && (
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
            <h3 className="card-title">Pantau Sambungan Semua Akun</h3>
          </div>
          <div className="admin-note" style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                type="text"
                value={sessionQuery}
                onChange={(e) => setSessionQuery(e.target.value)}
                placeholder="Cari akun..."
                className="input"
              />
              <select
                value={sessionStatusFilter}
                onChange={(e) => setSessionStatusFilter(e.target.value)}
                className="input"
              >
                <option value="all">Semua status</option>
                <option value="ready">Siap</option>
                <option value="qr">QR</option>
                <option value="checking">Memproses</option>
                <option value="offline">Tidak Terhubung</option>
              </select>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleBulkReset('offline')}
                  disabled={isBulkResetting || !!sessionActionTenantId}
                >
                  {isBulkResetting ? 'Memproses...' : 'Reset Semua Tidak Terhubung'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleBulkReset('qr')}
                  disabled={isBulkResetting || !!sessionActionTenantId}
                >
                  {isBulkResetting ? 'Memproses...' : 'Reset Semua Kode QR'}
                </button>
              </div>
            </div>
          </div>
          <div className="admin-note" style={{ marginBottom: 12 }}>
            <div className="admin-note-list" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-green">Siap: {sessionSummary.ready}</span>
              <span className="badge badge-blue">Kode QR: {sessionSummary.qr}</span>
              <span className="badge badge-red">Tidak Terhubung: {sessionSummary.offline}</span>
              <span className="badge badge-yellow">Menunggu: {sessionSummary.checking}</span>
              {sessionSummary.other > 0 && <span className="badge badge-gray">Lainnya: {sessionSummary.other}</span>}
              <span className="badge badge-gray">Total: {filteredSessions.length}</span>
            </div>
          </div>
          {sessionsError ? (
            <p className="status-note"><b>Gagal memuat:</b> {sessionsError}</p>
          ) : filteredSessions.length === 0 ? (
            <p className="status-note">Belum ada sambungan aktif.</p>
          ) : (
            <div className="admin-note-list">
              {filteredSessions.map((session) => (
                <div key={session.tenant_id} className="status-note" style={{ marginBottom: 10 }}>
                  <b>ID Akun:</b> {session.tenant_id}
                  {session.tenant_brand ? ` (${session.tenant_brand})` : ''}
                  {' - '}
                  {session.status} {session.isReady ? '(siap)' : ''} {session.hasQr ? '(kode QR)' : ''}
                  {session.lastError ? ` - kendala: ${session.lastError}` : ''}
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleResetTenantSession(session.tenant_id)}
                      disabled={!!sessionActionTenantId}
                    >
                      {sessionActionTenantId === session.tenant_id ? 'Memproses...' : 'Reset Sambungan'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
