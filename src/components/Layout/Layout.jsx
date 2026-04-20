// ===== IMPORT SHARED UTILITIES =====
// Using tenantUtils.js to avoid function duplication across pages
import {
  bootstrapStoreFromServer as _bootstrapStoreFromServer,
  setWorkspaceSnapshot
} from '../../lib/tenantUtils';

// Layout-specific functions using hardcoded tenant (Primavera Production)
let _workspaceSnapshot = null;

async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await _bootstrapStoreFromServer();
  // Sync with tenantUtils
  setWorkspaceSnapshot(_workspaceSnapshot);
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

function getTenantBranding() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { primaryColor: '#0ea5e9', appName: 'Platform', brandName: '3ons' };
  const tenantId = 'Primavera Production';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.branding || { primaryColor: '#0ea5e9', appName: 'Platform', brandName: '3ons' };
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContextSaaS'

import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'
import {
  LayoutDashboard, Users, Camera, MonitorSmartphone,
  BarChart3, QrCode, LogOut, Settings, X, Menu, Smartphone, Plus, ShieldCheck,
  FileText, Eye, History, Activity, Database, Bell, MessageCircle, TrendingUp,
  Building2, ClipboardList
} from 'lucide-react'

// Import Event Service for Supabase integration
import {
  fetchEventsByTenant,
  createEventInDB,
  setActiveEventInDB,
  getActiveEventIdFromDB,
  subscribeToEvents
} from '../../lib/eventService'

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
  const [events, setEvents] = useState([])
  const [activeEventId, setActiveEventId] = useState(null)
  const isMobile = useIsMobileLayout()
  const [tenantBranding, setTenantBranding] = useState(getTenantBranding())

  // Get tenant ID from user context (dynamic, not hardcoded)
  const getTenantId = useCallback(() => user?.tenant_id || user?.tenantId || null, [user?.tenant_id, user?.tenantId])

  // roleLabel not used anymore - using scopeLabels with user_type

  // Fetch events from Supabase on mount and when tenant changes
  useEffect(() => {
    const loadEvents = async () => {
      const tenantId = getTenantId()
      if (!tenantId) return

      try {
        const fetchedEvents = await fetchEventsByTenant(tenantId)
        setEvents(fetchedEvents)

        // Get active event from DB
        const activeId = await getActiveEventIdFromDB(tenantId)
        if (activeId) {
          setActiveEventId(activeId)
        } else if (fetchedEvents.length > 0) {
          // If no active event set, use first event
          setActiveEventId(fetchedEvents[0].id)
        }
      } catch (err) {
        console.error('Error loading events:', err)
      }
    }

    loadEvents()
  }, [user?.tenant_id, user?.tenantId, getTenantId])

  // Subscribe to realtime events changes
  useEffect(() => {
    const tenantId = getTenantId()
    if (!tenantId) return

    const unsubscribe = subscribeToEvents(tenantId, (payload) => {
      // Refresh events when there's a change
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
        fetchEventsByTenant(tenantId).then(setEvents)
      }
    })

    return unsubscribe
  }, [user?.tenant_id, user?.tenantId, getTenantId])

  const refreshEventState = useCallback(async () => {
    const tenantId = getTenantId()
    if (!tenantId) return

    try {
      const fetchedEvents = await fetchEventsByTenant(tenantId)
      setEvents(fetchedEvents)

      const activeId = await getActiveEventIdFromDB(tenantId)
      if (activeId) setActiveEventId(activeId)
    } catch (err) {
      console.error('Error refreshing events:', err)
    }
  }, [getTenantId])

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
  }, [refreshEventState])

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
  }, [user?.user_type, refreshEventState])

  const handleEventChange = async (eventId) => {
    const tenantId = getTenantId()
    if (!tenantId) return

    try {
      // Update active event in database
      const success = await setActiveEventInDB(tenantId, eventId)
      if (success) {
        setActiveEventId(eventId)
      }
    } catch (err) {
      console.error('Error changing event:', err)
    }
  }

  const handleCreateEvent = async () => {
    const tenantId = getTenantId()
    if (!tenantId) {
      alert('Tenant ID tidak ditemukan')
      return
    }

    const name = window.prompt('Nama event baru:', '')
    if (!name || name.trim() === '') return

    try {
      // Create event in database
      const newEvent = await createEventInDB(tenantId, name.trim())
      if (newEvent) {
        // Refresh events list
        await refreshEventState()
        // Set new event as active
        await handleEventChange(newEvent.id)
        alert(`Event "${newEvent.name}" berhasil dibuat!`)
      }
    } catch (err) {
      console.error('Error creating event:', err)
      alert('Gagal membuat event. Silakan coba lagi.')
    }
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
            <div className="nav-section">
              <div className="nav-section-title">Panel Admin</div>
              {tenantAdminNav.map(item => (
                <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {user?.user_type === 'system_admin' && (
            <div className="nav-section">
              <div className="nav-section-title">System Admin</div>
              {systemAdminNav.map(item => (
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
                  value={activeEventId || ''}
                  onChange={(e) => handleEventChange(e.target.value)}
                  style={{ height: 34, fontSize: '0.8rem' }}
                  title="Pilih acara aktif"
                >
                  <option value="" disabled={events.length > 0}>
                    {events.length === 0 ? 'Belum ada event' : 'Pilih event...'}
                  </option>
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
