// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function _getParticipants() { return []; }
function _getActiveTenant() { return { id: 'tenant-default' }; }
function _getAvailableDays() { return [1]; }
function _getCurrentDay() { return 1; }
function _setCurrentDay() {}
function _bootstrapStoreFromFirebase() { return Promise.resolve(); }
function getWaTemplate() { return ''; }
function getWaSendMode() { return ''; }
function getMaxPendingAttempts() { return 3; }
function getEventsWithOptions() { return [{ id: 'event-default', name: 'Event Default', isArchived: false }]; }
function getCurrentEventId() { return 'event-default'; }
function getStoreBackups() { return []; }
function resetCheckIns() { return { success: true }; }
function deleteAllParticipants() { return { success: true }; }
function setWaTemplate() { return true; }
function setWaSendMode() { return true; }
function setMaxPendingAttempts(val) { return val; }
function renameEvent() { return { success: true }; }
function archiveEvent() { return { success: true }; }
function deleteEvent() { return { success: true }; }
function restoreStoreBackup() { return { success: true }; }
function exportStoreBackup() { return { success: true, content: '{}', fileName: 'backup.json' }; }
function deleteStoreBackup() { return { success: true }; }
function deleteInvalidStoreBackups() { return { success: true, deleted: 0 }; }
const isSupabaseEnabled = true;
import { useEffect, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/useAuth'
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

  const handleResetCheckIn = (e) => {
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
    
    const result = resetCheckIns(user, resetReason)
    if (!result?.success) {
      toast.error('Gagal', humanizeUserMessage(result?.error, { fallback: 'Validasi alasan gagal.' }))
      return
    }
    toast.success('Sukses', 'Semua riwayat check-in telah dibersihkan.')
    clearResetModalState()
  }

  const handleDeleteAll = (e) => {
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
    
    const result = deleteAllParticipants(user, deleteReason)
    if (!result?.success) {
      toast.error('Gagal', humanizeUserMessage(result?.error, { fallback: 'Validasi alasan gagal.' }))
      return
    }
    toast.success('Sukses', 'Semua data peserta telah dihapus dari sistem.')
    clearDeleteModalState()
  }

  const handleSaveTemplate = (e) => {
    e.preventDefault()
    setWaTemplate(waTemplate, user)
    setWaSendMode(waSendMode, user)
    toast.success('Disimpan', 'Template pesan WhatsApp berhasil diperbarui.')
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
