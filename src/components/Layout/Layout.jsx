// ===== REAL FUNCTIONS FOR LAYOUT =====
import { fetchWorkspaceSnapshot } from '../../lib/dataSync';
let _workspaceSnapshot = null;

async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}

function _getParticipants() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'Primavera Production';
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
}

function _getActiveTenant() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: 'Primavera Production' };
  return _workspaceSnapshot.store.tenants?.['Primavera Production'] || { id: 'Primavera Production' };
}

function _getAvailableDays() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [1];
  const tenantId = 'Primavera Production';
  const eventId = 'event-default';
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  const days = [...new Set(participants.map(p => p.day_number || p.day || 1))];
  return days.length > 0 ? days.sort((a, b) => a - b) : [1];
}

function getCurrentEventId() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 'event-default';
  const tenantId = 'Primavera Production';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.activeEventId || 'event-default';
}

function getTenantBranding() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { primaryColor: '#0ea5e9', appName: 'Platform', brandName: '3ons' };
  const tenantId = 'Primavera Production';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.branding || { primaryColor: '#0ea5e9', appName: 'Platform', brandName: '3ons' };
}

function getEvents() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [{ id: 'event-default', name: 'Event Default', isArchived: false }];
  const tenantId = 'Primavera Production';
  const events = _workspaceSnapshot.store.tenants?.[tenantId]?.events || {};
  return Object.values(events).map(e => ({ id: e.id, name: e.name, isArchived: e.isArchived || false }));
}

function setCurrentEvent(eventId) {
  if (_workspaceSnapshot?.store?.tenants?.['Primavera Production']) {
    _workspaceSnapshot.store.tenants['Primavera Production'].activeEventId = eventId;
  }
}

function createEvent(name) { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: 'event-default', name };
  const tenantId = 'Primavera Production';
  const newEventId = 'event-' + Date.now();
  const newEvent = { id: newEventId, name, isArchived: false, participants: [], checkin_logs: [], created_at: new Date().toISOString() };
  if (!_workspaceSnapshot.store.tenants[tenantId].events) {
    _workspaceSnapshot.store.tenants[tenantId].events = {};
  }
  _workspaceSnapshot.store.tenants[tenantId].events[newEventId] = newEvent;
  return newEvent;
}

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContextSaaS'

import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'
import {
  LayoutDashboard, Users, Camera, MonitorSmartphone,
  BarChart3, QrCode, LogOut, Settings, X, Menu, Smartphone, Plus, ShieldCheck,
  FileText, Eye, History, Activity, Database, Bell, MessageCircle, TrendingUp,
  Building2, ClipboardList
} from 'lucide-react'

const RELEASE_MORNING_MODE = true
const REALTIME_SYNC_INTERVAL_MS = 2500
const ADMIN_FEATURES_ENABLED = String(import.meta.env.VITE_ENABLE_ADMIN_FEATURES || 'true').trim().toLowerCase() === 'true'
const ADMIN_RELEASE_VISIBLE_PATHS = new Set([
  '/admin-panel/overview',
  '/admin-panel/tenants',
  '/admin-panel/audit',
  '/admin-panel/system'
])

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [events, setEvents] = useState(getEvents())
  const [activeEventId, setActiveEventId] = useState(getCurrentEventId())
  const isMobile = useIsMobileLayout()
  const [tenantBranding, setTenantBranding] = useState(getTenantBranding())

  // roleLabel not used anymore - using scopeLabels with user_type

  const refreshEventState = () => {
    setEvents(getEvents())
    setActiveEventId(getCurrentEventId())
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
    if (user?.user_type === 'system_admin' || user?.user_type === 'tenant_admin') return

    let stopped = false

    const pullLatestWorkspace = async () => {
      try {
        const changed = await bootstrapStoreFromServer(true)
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
  }, [user?.user_type])

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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const getNavItems = () => {
    if (user?.user_type === 'gate_user') {
      return [
        { path: '/gate/front', icon: <Camera size={18} />, label: 'Scan QR' }
      ]
    }
    if (user?.user_type === 'system_admin') {
      return [{ path: '/admin-panel', icon: <ShieldCheck size={18} />, label: 'Admin Panel' }]
    }
    if (user?.user_type === 'tenant_admin') {
      return [{ path: '/admin-tenant', icon: <LayoutDashboard size={18} />, label: 'Dashboard' }]
    }
    return []
  }

  // Tenant Admin Navigation - goes to admin-tenant paths
  const tenantAdminNav = [
    { path: '/admin-tenant/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { path: '/admin-tenant/participants', icon: <Users size={18} />, label: 'Peserta' },
    { path: '/admin-tenant/analytics', icon: <TrendingUp size={18} />, label: 'Analitik' },
    { path: '/admin-tenant/ops-monitor', icon: <Activity size={18} />, label: 'Ops Monitor' },
    { path: '/admin-tenant/wa-delivery', icon: <MessageCircle size={18} />, label: 'WA Delivery' },
    { path: '/admin-tenant/connect-device', icon: <Smartphone size={18} />, label: 'Perangkat' },
    { path: '/admin-tenant/qr-generate', icon: <QrCode size={18} />, label: 'Buat QR' },
    { path: '/admin-tenant/reports', icon: <BarChart3 size={18} />, label: 'Laporan' },
    { path: '/admin-tenant/settings', icon: <Settings size={18} />, label: 'Pengaturan' },
  ]

  const gateNav = [
    { path: '/gate/scan', icon: <Camera size={18} />, label: 'Pindai QR' },
    { path: '/gate/monitor', icon: <MonitorSmartphone size={18} />, label: 'Pantau Langsung' },
  ]

  // System Admin Navigation - goes to admin-panel paths
  const systemAdminNav = [
    { path: '/admin-panel/overview', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { path: '/admin-panel/tenants', icon: <Building2 size={18} />, label: 'Tenants' },
    { path: '/admin-panel/gate-users', icon: <Users size={18} />, label: 'Gate Users' },
    { path: '/admin-panel/audit', icon: <ClipboardList size={18} />, label: 'Audit Log' },
    { path: '/admin-panel/system', icon: <Settings size={18} />, label: 'System' },
  ]
  
  const adminNav = user?.user_type === 'system_admin' ? systemAdminNav : tenantAdminNav
  const adminNavVisible = adminNav

  const mobileNavItems = getNavItems()

  const scopeLabels = {
    system_admin: 'System Admin',
    tenant_admin: 'Admin Panel',
    gate_user: 'Operator',
  }

  const scopeClass = user?.user_type
    ? `app-scope app-scope--${user.user_type.replace(/_/g, '-')}`
    : 'app-scope'
  const supportPhone = '6285800366090'
  const supportText = encodeURIComponent(
    `Halo Admin, saya mengalami kendala di aplikasi.\n` +
    `Nama: ${user?.name || '-'}\n` +
    `Peran: ${scopeLabels[user?.user_type] || 'Pengguna'}\n` +
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
            <span className="sidebar-product-mark-role">{scopeLabels[user?.user_type] ?? 'Digital'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {user?.user_type === 'gate_user' && (
            <>
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
          
          {user?.user_type === 'tenant_admin' && (
            <>
              <div className="nav-section">
                <div className="nav-section-title">Panel Admin</div>
                {tenantAdminNav.map(item => (
                  <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}

          {(user?.user_type === 'system_admin' || user?.user_type === 'tenant_admin') && (
            <div className="nav-section">
              <div className="nav-section-title">Admin Panel</div>
              {adminNavVisible.map(item => (
                <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {user?.user_type === 'gate_user' && (
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
              <div className="sidebar-user-role">{scopeLabels[user?.user_type] || 'Pengguna'}</div>
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
            {(user?.user_type === 'system_admin' || user?.user_type === 'tenant_admin') && (
              <>
                <select
                  id="header-event-select"
                  name="event_id"
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
            <button className="header-btn danger" onClick={handleLogout} title="Keluar">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="page-wrapper">
          {RELEASE_MORNING_MODE && user?.user_type === 'tenant_admin' && ADMIN_FEATURES_ENABLED && (
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
              Mode Rilis Pagi Aktif: fitur admin panel dibatasi ke operasi aman untuk menjaga stabilitas layanan.
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
          {(user?.user_type === 'system_admin' || user?.user_type === 'tenant_admin') && (
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
