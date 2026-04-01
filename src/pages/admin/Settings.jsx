import { useEffect, useState } from 'react'
import { resetCheckIns, deleteAllParticipants, getWaTemplate, setWaTemplate, getMaxPendingAttempts, setMaxPendingAttempts, getEventsWithOptions, getCurrentEventId, renameEvent, archiveEvent, deleteEvent, getStoreBackups, restoreStoreBackup, exportStoreBackup, deleteStoreBackup, deleteInvalidStoreBackups, getTenants, getActiveTenant, createTenant, setTenantStatus, switchActiveTenant, deleteTenant } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { AlertCircle, RotateCcw, Trash2, ShieldAlert, History, Download, Search } from 'lucide-react'

const BACKUP_AUTO_REFRESH_KEY = 'ons_backup_auto_refresh'
const BACKUP_AUTO_REFRESH_INTERVAL_KEY = 'ons_backup_auto_refresh_interval'

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
  const [maxRetryAttempts, setMaxRetryAttemptsState] = useState(getMaxPendingAttempts())
  const [events, setEvents] = useState(getEventsWithOptions({ includeArchived: true }))
  const [activeEventId, setActiveEventId] = useState(getCurrentEventId())
  const [tenants, setTenants] = useState(getTenants())
  const [activeTenantId, setActiveTenantId] = useState(getActiveTenant().id)
  const [tenantBrandName, setTenantBrandName] = useState('')
  const [tenantEventName, setTenantEventName] = useState('')
  const [tenantToken, setTenantToken] = useState('')
  const [tenantExpiresAt, setTenantExpiresAt] = useState('')
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState('all')
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

  const refreshTenants = () => {
    setTenants(getTenants())
    setActiveTenantId(getActiveTenant().id)
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
  const normalizedTenantSearch = tenantSearch.toLowerCase().trim()

  const visibleTenants = tenants
    .filter(tenant => {
      if (tenantFilter === 'active') return tenant.status === 'active' && !tenant.isExpired
      if (tenantFilter === 'inactive') return tenant.status !== 'active'
      if (tenantFilter === 'expired') return tenant.isExpired
      return true
    })
    .filter(tenant => {
      if (!normalizedTenantSearch) return true
      const haystack = `${tenant.brandName} ${tenant.eventName} ${tenant.token}`.toLowerCase()
      return haystack.includes(normalizedTenantSearch)
    })

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

  const handleCreateTenant = (e) => {
    e.preventDefault()

    if (!tenantBrandName.trim()) {
      toast.error('Gagal', 'Nama brand tenant wajib diisi')
      return
    }

    if (!tenantToken.trim()) {
      toast.error('Gagal', 'Token tenant wajib diisi')
      return
    }

    const result = createTenant({
      brandName: tenantBrandName,
      eventName: tenantEventName,
      token: tenantToken,
      expiresAt: tenantExpiresAt || null
    }, user)

    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal membuat tenant')
      return
    }

    setTenantBrandName('')
    setTenantEventName('')
    setTenantToken('')
    setTenantExpiresAt('')
    refreshTenants()
    toast.success('Sukses', 'Tenant baru berhasil dibuat')
  }

  const handleActivateTenant = (tenant) => {
    const result = switchActiveTenant(tenant.id, user)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal mengaktifkan tenant')
      return
    }
    refreshTenants()
    toast.success('Sukses', `Tenant aktif: ${tenant.brandName}`)
  }

  const handleToggleTenantStatus = (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'inactive' : 'active'
    const result = setTenantStatus(tenant.id, nextStatus, user)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal update status tenant')
      return
    }
    refreshTenants()
    toast.success('Sukses', `Status tenant ${tenant.brandName} menjadi ${nextStatus}`)
  }

  const handleDeleteTenant = (tenant) => {
    const confirmation = window.prompt(`Hapus tenant ${tenant.brandName}? Ketik HAPUS untuk lanjut:`, '')
    if (confirmation === null) return
    if (confirmation !== 'HAPUS') {
      toast.error('Gagal', 'Konfirmasi harus HAPUS')
      return
    }

    const result = deleteTenant(tenant.id, user)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal hapus tenant')
      return
    }

    refreshTenants()
    toast.success('Sukses', `Tenant ${tenant.brandName} berhasil dihapus`)
  }


  const handleResetCheckIn = (e) => {
    e.preventDefault()
    if (resetInput !== 'HAPUS') {
      toast.error('Gagal', 'Kata konfirmasi salah')
      return
    }
    if (resetApprovalInput !== 'SETUJU') {
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
      toast.error('Gagal', result?.error || 'Validasi alasan gagal')
      return
    }
    toast.success('Sukses', 'Semua riwayat check-in telah dibersihkan.')
    setShowResetModal(false)
    setResetInput('')
    setResetApprovalInput('')
    setResetReason('')
  }

  const handleDeleteAll = (e) => {
    e.preventDefault()
    if (deleteInput !== 'HAPUS') {
      toast.error('Gagal', 'Kata konfirmasi salah')
      return
    }
    if (deleteApprovalInput !== 'SETUJU') {
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
      toast.error('Gagal', result?.error || 'Validasi alasan gagal')
      return
    }
    toast.success('Sukses', 'Semua data peserta telah dihapus dari sistem.')
    setShowDeleteModal(false)
    setDeleteInput('')
    setDeleteApprovalInput('')
    setDeleteReason('')
  }

  const handleSaveTemplate = (e) => {
    e.preventDefault()
    setWaTemplate(waTemplate, user)
    toast.success('Disimpan', 'Template pesan WhatsApp berhasil diperbarui.')
  }

  const handleSaveOfflineConfig = (e) => {
    e.preventDefault()
    const value = Number(maxRetryAttempts)
    if (!Number.isInteger(value) || value < 1 || value > 20) {
      toast.error('Gagal', 'Batas retry harus angka 1 sampai 20')
      return
    }
    const saved = setMaxPendingAttempts(value, user)
    setMaxRetryAttemptsState(saved)
    toast.success('Disimpan', `Batas retry offline diset ke ${saved}x`) 
  }

  const handleRenameEvent = (event) => {
    const nextName = window.prompt('Nama event baru:', event.name)
    if (nextName === null) return
    const res = renameEvent(event.id, nextName, user)
    if (!res.success) return toast.error('Gagal', res.error || 'Gagal rename event')
    refreshEvents()
    toast.success('Sukses', 'Nama event berhasil diperbarui')
  }

  const handleArchiveEvent = (event) => {
    const confirmWord = window.prompt(`Arsipkan event "${event.name}"? Ketik SETUJU`, '')
    if (confirmWord === null) return
    if (confirmWord !== 'SETUJU') return toast.error('Gagal', 'Konfirmasi harus SETUJU')
    const reason = window.prompt('Alasan arsip event (minimal 15 karakter):', '')
    if (reason === null) return
    const res = archiveEvent(event.id, user, reason)
    if (!res.success) return toast.error('Gagal', res.error || 'Gagal arsip event')
    refreshEvents()
    toast.success('Sukses', 'Event berhasil diarsipkan')
  }

  const handleDeleteEvent = (event) => {
    const confirmWord = window.prompt(`Hapus event "${event.name}" permanen? Ketik HAPUS`, '')
    if (confirmWord === null) return
    if (confirmWord !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus event (minimal 15 karakter):', '')
    if (reason === null) return
    const res = deleteEvent(event.id, user, reason)
    if (!res.success) return toast.error('Gagal', res.error || 'Gagal hapus event')
    refreshEvents()
    toast.success('Sukses', 'Event berhasil dihapus')
  }

  const handleRestoreBackup = (backup) => {
    if (!backup?.isValid) {
      toast.error('Gagal', 'Backup tidak valid dan tidak bisa direstore')
      return
    }
    const confirmWord = window.prompt('Restore backup akan menimpa data aktif. Ketik RESTORE untuk lanjut:', '')
    if (confirmWord === null) return
    if (confirmWord !== 'RESTORE') return toast.error('Gagal', 'Konfirmasi harus RESTORE')
    const reason = window.prompt('Alasan restore backup (minimal 15 karakter):', '')
    if (reason === null) return

    const res = restoreStoreBackup(backup.key, user, reason)
    if (!res.success) return toast.error('Gagal', res.error || 'Restore backup gagal')

    refreshEvents()
    toast.success('Sukses', 'Backup berhasil direstore. Muat ulang halaman untuk sinkron penuh jika diperlukan.')
  }

  const handleDownloadBackup = (backup) => {
    const result = exportStoreBackup(backup.key)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Backup gagal diexport')
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

    toast.success('Sukses', 'Backup JSON berhasil didownload')
  }

  const handleDeleteBackup = (backup) => {
    const confirmWord = window.prompt('Hapus backup ini? Ketik HAPUS untuk lanjut:', '')
    if (confirmWord === null) return
    if (confirmWord !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus backup (minimal 15 karakter):', '')
    if (reason === null) return

    const result = deleteStoreBackup(backup.key, user, reason)
    if (!result.success) return toast.error('Gagal', result.error || 'Gagal hapus backup')

    refreshEvents()
    toast.success('Sukses', 'Backup berhasil dihapus')
  }

  const handleDeleteInvalidBackups = () => {
    if (invalidBackupCount === 0) {
      toast.error('Info', 'Tidak ada backup invalid untuk dihapus')
      return
    }
    const confirmWord = window.prompt(`Hapus ${invalidBackupCount} backup invalid? Ketik HAPUS untuk lanjut:`, '')
    if (confirmWord === null) return
    if (confirmWord !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus backup invalid (minimal 15 karakter):', '')
    if (reason === null) return

    const result = deleteInvalidStoreBackups(user, reason)
    if (!result.success) return toast.error('Gagal', result.error || 'Gagal hapus backup invalid')

    refreshEvents()
    toast.success('Sukses', `${result.deleted} backup invalid berhasil dihapus`)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Pengaturan Sistem</h1>
        <p>Kelola data dan konfigurasi aplikasi</p>
      </div>

      <div className="settings-wrap">
        {/* BOT TEMPLATE EDITOR */}
        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            Teks Pesan WhatsApp Bot
          </h3>
          <p className="text-note">
            Ubah teks yang akan dikirim secara otomatis ke peserta. Gunakan "Kata Sakti" di bawah ini agar sistem bisa mengubahnya menjadi data asli peserta:
            <br />
            <code className="token-code">{'{{nama}}'}</code>
            <code className="token-code ml-8">{'{{tiket}}'}</code>
            <code className="token-code ml-8">{'{{hari}}'}</code>
            <code className="token-code ml-8">{'{{kategori}}'}</code>
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
              <button type="submit" className="btn btn-primary">Simpan Teks WhatsApp</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Pengaturan Offline Queue</h3>
          <p className="text-note">
            Atur batas percobaan retry untuk antrean scan offline. Jika melebihi batas, item akan dipurge otomatis dan masuk history post-mortem.
          </p>

          <form onSubmit={handleSaveOfflineConfig}>
            <div className="form-group">
              <label className="form-label">Batas Retry Maksimum (1 - 20)</label>
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
              <button type="submit" className="btn btn-primary">Simpan Pengaturan Offline</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Panel Owner Tenant</h3>
          <p className="text-note">
            Buat token sewa per brand/event, aktifkan tenant yang dipakai saat ini, dan kontrol status tenant.
          </p>

          <form onSubmit={handleCreateTenant}>
            <div className="form-group">
              <label className="form-label">Nama Brand</label>
              <input
                className="form-input"
                value={tenantBrandName}
                onChange={e => setTenantBrandName(e.target.value)}
                placeholder="Contoh: Yamaha Indonesia"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Event</label>
              <input
                className="form-input"
                value={tenantEventName}
                onChange={e => setTenantEventName(e.target.value)}
                placeholder="Contoh: Yamaha Roadshow 2026"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Token Tenant</label>
              <input
                className="form-input"
                value={tenantToken}
                onChange={e => setTenantToken(e.target.value.toUpperCase())}
                placeholder="Contoh: YAMAHA-ROADSHOW-2026"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Expired (opsional)</label>
              <input
                className="form-input"
                type="date"
                value={tenantExpiresAt}
                onChange={e => setTenantExpiresAt(e.target.value)}
              />
            </div>
            <div className="actions-right">
              <button type="submit" className="btn btn-primary">Tambah Tenant</button>
            </div>
          </form>

          <div className="tenant-toolbar mt-16">
            <div className="admin-search-wrap backup-search-wrap">
              <Search size={14} className="admin-search-icon" />
              <input
                className="form-input"
                type="text"
                placeholder="Cari brand, event, atau token tenant..."
                value={tenantSearch}
                onChange={e => setTenantSearch(e.target.value)}
              />
            </div>
            <select className="form-select backup-select" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}>
              <option value="all">Semua Tenant</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="tenant-stats-row">
            <span className="badge badge-gray">Total: {tenants.length}</span>
            <span className="badge badge-green">Aktif: {tenants.filter(t => t.status === 'active' && !t.isExpired).length}</span>
            <span className="badge badge-yellow">Nonaktif: {tenants.filter(t => t.status !== 'active').length}</span>
            <span className="badge badge-red">Expired: {tenants.filter(t => t.isExpired).length}</span>
          </div>

          <div className="event-list mt-16">
            {visibleTenants.length === 0 && (
              <div className="event-meta">Tidak ada tenant sesuai filter/pencarian.</div>
            )}
            {visibleTenants.map(tenant => (
              <div key={tenant.id} className="event-item">
                <div className="event-row">
                  <div>
                    <div className="event-name">{tenant.brandName}</div>
                    <div className="event-meta">
                      {tenant.eventName} • Token: {tenant.token}
                    </div>
                    <div className="tenant-meta-badges">
                      <span className={`badge ${tenant.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>
                        {tenant.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {tenant.isExpired && <span className="badge badge-red">Expired</span>}
                      {tenant.id === activeTenantId && <span className="badge badge-blue">Sedang Dipakai</span>}
                    </div>
                  </div>
                  <div className="event-actions">
                    {tenant.id !== activeTenantId && tenant.status === 'active' && !tenant.isExpired && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleActivateTenant(tenant)}>Pakai</button>
                    )}
                    {tenant.id !== 'tenant-default' && (
                      <button className="btn btn-ghost btn-warning btn-sm" onClick={() => handleToggleTenantStatus(tenant)}>
                        {tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                    {tenant.id !== 'tenant-default' && tenant.id !== activeTenantId && (
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteTenant(tenant)}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                      {event.id === activeEventId ? 'Event Aktif' : 'Nonaktif'} {event.isArchived ? '• Archived' : ''}
                    </div>
                  </div>
                  <div className="event-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRenameEvent(event)}>Rename</button>
                    {!event.isArchived && event.id !== activeEventId && (
                      <button className="btn btn-ghost btn-warning btn-sm" onClick={() => handleArchiveEvent(event)}>Archive</button>
                    )}
                    {event.id !== activeEventId && (
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteEvent(event)}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            <History size={18} /> Backup Data Store
          </h3>
          <p className="text-note">
            Sistem menyimpan snapshot otomatis sebelum data store ditulis ulang. Backup ini bisa dipakai untuk pemulihan cepat jika data aktif bermasalah.
          </p>

          <div className="backup-toolbar">
            <div className="admin-search-wrap backup-search-wrap">
              <Search size={14} className="admin-search-icon" />
              <input
                className="form-input"
                type="text"
                placeholder="Cari key / tanggal backup..."
                value={backupSearch}
                onChange={e => setBackupSearch(e.target.value)}
              />
            </div>
            <select className="form-select backup-select" value={backupFilter} onChange={e => setBackupFilter(e.target.value)}>
              <option value="all">Semua Backup</option>
              <option value="valid">Valid Saja</option>
              <option value="invalid">Invalid Saja</option>
            </select>
            <select className="form-select backup-select" value={backupSort} onChange={e => setBackupSort(e.target.value)}>
              <option value="newest">Urut Terbaru</option>
              <option value="oldest">Urut Terlama</option>
              <option value="largest">Ukuran Terbesar</option>
            </select>
            <button className="btn btn-ghost btn-danger btn-sm" onClick={handleDeleteInvalidBackups} disabled={invalidBackupCount === 0}>
              <Trash2 size={14} className="mr-6" /> Hapus Invalid ({invalidBackupCount})
            </button>
            <button
              className={`btn btn-ghost btn-sm ${backupAutoRefreshEnabled ? 'btn-green-soft' : 'btn-gray-soft'}`}
              onClick={handleToggleBackupAutoRefresh}
            >
              Auto Refresh: {backupAutoRefreshEnabled ? 'ON' : 'OFF'}
            </button>
            <select
              className="form-select backup-select"
              value={backupAutoRefreshInterval}
              onChange={handleChangeBackupRefreshInterval}
              disabled={!backupAutoRefreshEnabled}
              title="Interval auto refresh"
            >
              <option value={5000}>Refresh 5 detik</option>
              <option value={8000}>Refresh 8 detik</option>
              <option value={15000}>Refresh 15 detik</option>
            </select>
            <button
              className="btn btn-ghost btn-sm"
              onClick={resetBackupView}
              disabled={!backupSearch && backupFilter === 'all' && backupSort === 'newest'}
            >
              Reset View
            </button>
          </div>

          <div className="backup-presets">
            <button className="btn btn-ghost btn-sm" onClick={applyTodayPreset}>Backup Hari Ini</button>
            <button className="btn btn-ghost btn-sm" onClick={applyLargePreset}>Backup Terbesar</button>
            <button className="btn btn-ghost btn-warning btn-sm" onClick={applyInvalidLatestPreset}>Invalid Terbaru</button>
          </div>

          <div className="backup-stats-row">
            <span className="badge badge-gray">Total: {storeBackups.length}</span>
            <span className="badge badge-green">Valid: {validBackupCount}</span>
            <span className="badge badge-red">Invalid: {invalidBackupCount}</span>
            <span className="badge badge-yellow">Ukuran: {formatBackupSize(totalBackupSize)}</span>
            <span className={`badge ${backupSessionDelta > 0 ? 'badge-green' : backupSessionDelta < 0 ? 'badge-red' : 'badge-gray'}`}>
              Sesi: {backupSessionDelta > 0 ? `+${backupSessionDelta}` : backupSessionDelta}
            </span>
            <span className={`badge badge-gray ${backupAutoRefreshEnabled && isBackupTabVisible && backupRefreshCountdown <= 1 ? 'countdown-pulse' : ''}`}>
              Refresh: {backupRefreshLabel}
            </span>
            <span className="badge badge-gray">Updated: {backupLastRefreshLabel}</span>
            <span className={`badge ${isBackupTabVisible ? 'badge-green' : 'badge-yellow'}`}>
              Tab: {isBackupTabVisible ? 'aktif' : 'nonaktif'}
            </span>
          </div>

          <div className="event-meta mb-16">Menampilkan {visibleBackups.length} dari {storeBackups.length} backup</div>

          {visibleBackups.length === 0 ? (
            <div className="event-meta">Belum ada backup tersedia.</div>
          ) : (
            <div className="event-list">
              {visibleBackups.map(backup => (
                <div key={backup.key} className="event-item">
                  <div className="event-row">
                    <div>
                      <div className="event-name">{backup.timestamp ? new Date(backup.timestamp).toLocaleString('id-ID') : '-'}</div>
                      <div className="event-meta">
                        {formatBackupSize(backup.size)} • {backup.eventCount} event • {backup.isValid ? 'Valid' : 'Invalid'}
                      </div>
                    </div>
                    <div className="event-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDownloadBackup(backup)}>
                        <Download size={14} className="mr-6" /> Download
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRestoreBackup(backup)} disabled={!backup.isValid}>Restore</button>
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteBackup(backup)}>
                        <Trash2 size={14} className="mr-6" /> Delete
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
            <ShieldAlert size={20} /> Danger Zone (Zona Berbahaya)
          </h3>
          <p className="text-note mb-24">
            Aksi di bawah ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda melakukan ini hanya untuk <strong>persiapan hari-H</strong> atau setelah event selesai.
          </p>

          <div className="danger-list">
            {/* Reset Checkin Item */}
            <div className="danger-item split">
              <div>
                <div className="danger-item-title">Reset Status Check-in</div>
                <div className="danger-item-desc">Mengembalikan semua status peserta menjadi "Belum Hadir". Nama peserta akan tetap ada.</div>
              </div>
              <button className="btn btn-secondary btn-warning btn-shrink" onClick={() => setShowResetModal(true)}>
                <RotateCcw size={14} className="mr-6" /> Reset
              </button>
            </div>

            {/* Delete All Item */}
            <div className="danger-item">
              <div>
                <div className="danger-item-title">Hapus Semua Peserta</div>
                <div className="danger-item-desc">Menghapus <strong>seluruh database peserta</strong> dan riwayat check-in. Sistem akan kosong.</div>
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
        <div className="modal-overlay" onClick={() => { setShowResetModal(false); setResetInput(''); setResetApprovalInput(''); setResetReason('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title card-title-inline modal-title-warning">
                <AlertCircle size={18} /> Konfirmasi Reset Status
              </h3>
              <button className="modal-close" onClick={() => { setShowResetModal(false); setResetInput(''); setResetApprovalInput(''); setResetReason('') }}>✕</button>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary btn-warning">Reset Check-in</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteInput(''); setDeleteApprovalInput(''); setDeleteReason('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title card-title-inline modal-title-danger">
                <AlertCircle size={18} /> Konfirmasi Hapus Database
              </h3>
              <button className="modal-close" onClick={() => { setShowDeleteModal(false); setDeleteInput(''); setDeleteApprovalInput(''); setDeleteReason('') }}>✕</button>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Batal</button>
                <button type="submit" className="btn btn-danger">Hapus Semua Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
