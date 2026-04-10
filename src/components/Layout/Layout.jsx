// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getCurrentEventId() { return 'event-default'; }
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'

import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'
import {
  LayoutDashboard, Users, Camera, MonitorSmartphone,
  BarChart3, QrCode, LogOut, Settings, X, Menu, Smartphone, Plus, ShieldCheck,
  FileText, Eye, History, Activity, Database, Bell, MessageCircle
} from 'lucide-react'

const RELEASE_MORNING_MODE = true
const REALTIME_SYNC_INTERVAL_MS = 2500
const OWNER_FEATURES_ENABLED = String(import.meta.env.VITE_ENABLE_OWNER_FEATURES || 'false').trim().toLowerCase() === 'true'
const OWNER_RELEASE_VISIBLE_PATHS = new Set([
  '/owner/users',
  '/owner/billing',
  '/owner/audit',
  '/owner/health',
  '/owner/notifications'
])

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // const [currentDay, setDay] = useState(getCurrentDay())
  // const [dayInput, setDayInput] = useState(String(getCurrentDay()))
  // const [events, setEvents] = useState(getEvents())
  const [activeEventId, setActiveEventId] = useState(getCurrentEventId())
  const isMobile = useIsMobileLayout()
  const [tenantBranding, setTenantBranding] = useState(getTenantBranding())

  const roleLabel = {
    super_admin: 'Admin Utama',
    admin_client: 'Admin Acara',
    gate_front: 'Petugas Pintu Depan',
    gate_back: 'Petugas Pintu Belakang',
    owner: 'Pemilik Platform'
  }

  const refreshEventState = () => {
    setEvents(getEvents())
    setActiveEventId(getCurrentEventId())
    const d = getCurrentDay()
    setDay(d)
    setDayInput(String(d))
  }

  useEffect(() => {
    const refreshTenantBranding = () => setTenantBranding(getTenantBranding())
    const onWorkspaceSynced = () => {
      refreshEventState()
      setTenantBranding(getTenantBranding())
    }
    window.addEventListener('ons-tenant-changed', refreshTenantBranding)
    window.addEventListener('ons-workspace-synced', onWorkspaceSynced)
    window.addEventListener('focus', refreshTenantBranding)
    return () => {
      window.removeEventListener('ons-tenant-changed', refreshTenantBranding)
      window.removeEventListener('ons-workspace-synced', onWorkspaceSynced)
      window.removeEventListener('focus', refreshTenantBranding)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'owner') return

    let stopped = false

    const pullLatestWorkspace = async () => {
      try {
        const changed = await bootstrapStoreFromFirebase(true)
        if (!changed || stopped) return

        refreshEventState()
        setTenantBranding(getTenantBranding())
      } catch {
        // Keep UI running even if sync pull fails temporarily.
      }
    }

    const id = window.setInterval(() => {
      void pullLatestWorkspace()
    }, REALTIME_SYNC_INTERVAL_MS)

    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [user?.role])

  const handleDayChange = (day) => {
    setCurrentDay(day, user)
    setDay(day)
    setDayInput(String(day))
  }

  const handleEventChange = (eventId) => {
    setCurrentEvent(eventId, user)
    refreshEventState()
  }

  const handleCreateEvent = () => {
    const name = window.prompt('Nama event baru:', '')
    if (name === null) return
    const result = createEvent(name, user)
    setCurrentEvent(result.id, user)
    refreshEventState()
  }

  const handleDaySubmit = (e) => {
    e.preventDefault()
    const day = Number(dayInput)
    if (!Number.isInteger(day) || day < 1) {
      setDayInput(String(currentDay))
      return
    }
    handleDayChange(day)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const getNavItems = () => {
    if (user?.role === 'super_admin' || user?.role === 'admin_client') {
      return [
        { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Ringkasan' },
        { path: '/admin/participants', icon: <Users size={18} />, label: 'Peserta' },
        { path: '/gate/scan', icon: <Camera size={18} />, label: 'Pindai' }
      ]
    }
    if (user?.role === 'owner' && OWNER_FEATURES_ENABLED) {
      return [{ path: '/owner', icon: <ShieldCheck size={18} />, label: 'Pemilik' }]
    }
    if (user?.role === 'gate_front') {
      return [{ path: '/gate/scan', icon: <Camera size={18} />, label: 'Pindai QR' }]
    }
    if (user?.role === 'gate_back') {
      return [{ path: '/gate/monitor', icon: <MonitorSmartphone size={18} />, label: 'Monitor' }]
    }
    return []
  }

  const adminNav = [
    { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Ringkasan' },
    { path: '/admin/participants', icon: <Users size={18} />, label: 'Peserta' },
    { path: '/admin/ops', icon: <Activity size={18} />, label: 'Ops Monitor' },
    { path: '/admin/wa-delivery', icon: <MessageCircle size={18} />, label: 'WA Delivery' },
    { path: '/admin/connect', icon: <Smartphone size={18} />, label: 'Sambungkan Perangkat' },
    { path: '/admin/qr-generate', icon: <QrCode size={18} />, label: 'Buat QR' },
    { path: '/admin/reports', icon: <BarChart3 size={18} />, label: 'Laporan' },
    { path: '/admin/settings', icon: <Settings size={18} />, label: 'Pengaturan' },
  ]

  const gateNav = [
    { path: '/gate/scan', icon: <Camera size={18} />, label: 'Pindai QR' },
    { path: '/gate/monitor', icon: <MonitorSmartphone size={18} />, label: 'Pantau Langsung' },
  ]

  const ownerNav = [
    { path: '/owner/tenants', icon: <LayoutDashboard size={18} />, label: 'Akun Brand' },
    { path: '/owner/contracts', icon: <FileText size={18} />, label: 'Kontrak Sewa' },
    { path: '/owner/quotas', icon: <BarChart3 size={18} />, label: 'Kuota Akun Brand' },
    { path: '/owner/users', icon: <Users size={18} />, label: 'Kelola Pengguna' },
    { path: '/owner/impersonate', icon: <Eye size={18} />, label: 'Masuk sebagai Pengguna' },
    { path: '/owner/billing', icon: <History size={18} />, label: 'Tagihan' },
    { path: '/owner/audit', icon: <ShieldCheck size={18} />, label: 'Riwayat Aktivitas' },
    { path: '/owner/health', icon: <Activity size={18} />, label: 'Kesehatan Sistem' },
    { path: '/owner/backup', icon: <Database size={18} />, label: 'Cadangan Data' },
    { path: '/owner/branding', icon: <Settings size={18} />, label: 'Tampilan Brand' },
    { path: '/owner/notifications', icon: <Bell size={18} />, label: 'Pemberitahuan' },
    { path: '/owner/tech-tools', icon: <ShieldCheck size={18} />, label: 'Alat IT' },
  ]
  const ownerNavVisible = RELEASE_MORNING_MODE
    ? ownerNav.filter((item) => OWNER_RELEASE_VISIBLE_PATHS.has(item.path))
    : ownerNav

  const mobileNavItems = getNavItems()

  const scopeLabels = {
    super_admin: 'Admin Acara',
    admin_client: 'Admin Acara',
    owner: 'Pemilik Platform',
    gate_front: 'Pemindaian QR',
    gate_back: 'Monitor Pintu',
  }

  const scopeClass = user?.role
    ? `app-scope app-scope--${user.role.replace(/_/g, '-')}`
    : 'app-scope'
  const supportPhone = '6285800366090'
  const supportText = encodeURIComponent(
    `Halo Admin, saya mengalami kendala di aplikasi.\n` +
    `Nama: ${user?.name || '-'}\n` +
    `Peran: ${roleLabel[user?.role] || 'Pengguna'}\n` +
    `Tenant: ${tenantBranding?.brandName || '-'}\n` +
    `Halaman: ${location.pathname}\n` +
    `Detail kendala:`
  )
  const supportLink = `https://wa.me/${supportPhone}?text=${supportText}`

  return (
    <div className={`app-layout ${scopeClass}`}>
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          {isMobile && (
            <button type="button" className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu">
              <X size={16} />
            </button>
          )}
          <div className={`sidebar-product-mark${isMobile ? ' sidebar-product-mark--mobile' : ''}`}>
            <span className="sidebar-product-mark-badge">{tenantBranding?.brandName || '3ons'}</span>
            <span className="sidebar-product-mark-role">{scopeLabels[user?.role] ?? 'Digital'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {(user?.role === 'super_admin' || user?.role === 'admin_client') && (
            <>
              <div className="nav-section">
                <div className="nav-section-title">Panel Admin</div>
                {adminNav.map(item => (
                  <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="nav-section">
                <div className="nav-section-title">Akses Pintu</div>
                {gateNav.map(item => (
                  <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}

          {user?.role === 'gate_front' && (
            <div className="nav-section">
              <div className="nav-section-title">Pemindai</div>
              <Link to="/gate/scan" className={`nav-item ${isActive('/gate/scan') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="nav-icon"><Camera size={18} /></span>
                Pindai Kode QR
              </Link>
            </div>
          )}

          {user?.role === 'gate_back' && (
            <div className="nav-section">
              <div className="nav-section-title">Monitor</div>
              <Link to="/gate/monitor" className={`nav-item ${isActive('/gate/monitor') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="nav-icon"><MonitorSmartphone size={18} /></span>
                Pantau Langsung
              </Link>
            </div>
          )}

          {user?.role === 'owner' && OWNER_FEATURES_ENABLED && (
            <div className="nav-section">
              <div className="nav-section-title">Panel Pemilik</div>
              {ownerNavVisible.map(item => (
                <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {user?.role !== 'owner' && (
            <a
              href={supportLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp btn-sm"
              style={{ width: '100%', marginBottom: 10 }}
              title="Lapor kendala ke admin lewat WhatsApp"
            >
              <MessageCircle size={14} /> Lapor Admin
            </a>
          )}
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{roleLabel[user?.role] || 'Pengguna'}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
            <Link to="/" className="logo-3ons" aria-label="3oNs Digital">
              <span className="l3">3</span>
              <span className="lo">o</span>
              <span className="lN">N</span>
              <span className="ls">s</span>
              <span className="digital-tag">Digital</span>
            </Link>
          </div>
          <div className="header-right">
            {user?.role === 'super_admin' && (
              <>
                <select
                  className="form-select header-event-select"
                  value={activeEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  style={{ height: 34, fontSize: '0.8rem' }}
                  title="Pilih acara aktif"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
                <button className="header-btn" onClick={handleCreateEvent} title="Tambah acara" style={{ borderColor: 'var(--border-color)' }}>
                  <Plus size={16} />
                </button>
              </>
            )}
            {user?.role !== 'owner' && (
              <form className="header-day-form" onSubmit={handleDaySubmit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="header-day-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>HARI</span>
                <input
                  type="number"
                  min="1"
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  onBlur={handleDaySubmit}
                  className="form-input header-day-input"
                  style={{ height: 34, padding: '6px 10px', fontWeight: 700 }}
                  title="Isi hari aktif acara"
                />
              </form>
            )}
            <button className="header-btn danger" onClick={handleLogout} title="Keluar">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="page-wrapper">
          {RELEASE_MORNING_MODE && user?.role === 'owner' && OWNER_FEATURES_ENABLED && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(251, 191, 36, 0.14)',
                color: '#7c2d12',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              Mode Rilis Pagi Aktif: menu owner dibatasi ke operasi aman untuk menjaga stabilitas layanan tenant default.
            </div>
          )}
          {children}
        </div>
      </main>

      {isMobile && (
        <nav className="mobile-bottom-nav">
          {mobileNavItems.map(item => (
            <Link key={item.path} to={item.path} className={`mobile-nav-item ${isActive(item.path) ? 'active' : ''}`}>
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
              {isActive(item.path) && <span className="mobile-nav-indicator"></span>}
            </Link>
          ))}
          {(user?.role === 'super_admin' || user?.role === 'admin_client') && (
            <button className="mobile-nav-item" onClick={() => setSidebarOpen(true)}>
              <span className="mobile-nav-icon"><Menu size={18} /></span>
              <span className="mobile-nav-label">Lainnya</span>
            </button>
          )}
        </nav>
      )}
    </div>
  )
}
