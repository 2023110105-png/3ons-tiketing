import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getCurrentDay, setCurrentDay, getEvents, getCurrentEventId, setCurrentEvent, createEvent } from '../../store/mockData'
import {
  LayoutDashboard, Users, Camera, MonitorSmartphone,
  BarChart3, QrCode, LogOut, Settings, X, Menu, Smartphone, Plus
} from 'lucide-react'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentDay, setDay] = useState(getCurrentDay())
  const [dayInput, setDayInput] = useState(String(getCurrentDay()))
  const [events, setEvents] = useState(getEvents())
  const [activeEventId, setActiveEventId] = useState(getCurrentEventId())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleDayChange = (day) => {
    setCurrentDay(day, user)
    setDay(day)
    setDayInput(String(day))
  }

  const refreshEventState = () => {
    setEvents(getEvents())
    setActiveEventId(getCurrentEventId())
    const d = getCurrentDay()
    setDay(d)
    setDayInput(String(d))
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
    if (user?.role === 'super_admin') {
      return [
        { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
        { path: '/admin/participants', icon: <Users size={18} />, label: 'Peserta' },
        { path: '/gate/scan', icon: <Camera size={18} />, label: 'Scan' }
      ]
    }
    if (user?.role === 'gate_front') {
      return [{ path: '/gate/scan', icon: <Camera size={18} />, label: 'Scan QR' }]
    }
    if (user?.role === 'gate_back') {
      return [{ path: '/gate/monitor', icon: <MonitorSmartphone size={18} />, label: 'Monitor' }]
    }
    return []
  }

  const adminNav = [
    { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { path: '/admin/participants', icon: <Users size={18} />, label: 'Peserta' },
    { path: '/admin/connect', icon: <Smartphone size={18} />, label: 'Connect Device' },
    { path: '/admin/qr-generate', icon: <QrCode size={18} />, label: 'Generate QR' },
    { path: '/admin/reports', icon: <BarChart3 size={18} />, label: 'Laporan' },
    { path: '/admin/settings', icon: <Settings size={18} />, label: 'Pengaturan' },
  ]

  const gateNav = [
    { path: '/gate/scan', icon: <Camera size={18} />, label: 'Scan QR' },
    { path: '/gate/monitor', icon: <MonitorSmartphone size={18} />, label: 'Monitor' },
  ]

  const mobileNavItems = getNavItems()

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/brand-logo.svg" alt="3oNs" />
          </div>
          <div className="sidebar-brand">
            <h2>
              <span style={{ color: 'var(--brand-blue)' }}>3</span>
              <span style={{ color: 'var(--brand-green)' }}>o</span>
              <span style={{ color: 'var(--brand-primary)' }}>N</span>
              <span style={{ color: 'var(--brand-pink)' }}>s</span>
            </h2>
            <span>Project Platform</span>
          </div>
          {isMobile && (
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {user?.role === 'super_admin' && (
            <>
              <div className="nav-section">
                <div className="nav-section-title">Admin Panel</div>
                {adminNav.map(item => (
                  <Link key={item.path} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="nav-section">
                <div className="nav-section-title">Gate Access</div>
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
              <div className="nav-section-title">Scanner</div>
              <Link to="/gate/scan" className={`nav-item ${isActive('/gate/scan') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="nav-icon"><Camera size={18} /></span>
                Scan QR Code
              </Link>
            </div>
          )}

          {user?.role === 'gate_back' && (
            <div className="nav-section">
              <div className="nav-section-title">Monitor</div>
              <Link to="/gate/monitor" className={`nav-item ${isActive('/gate/monitor') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="nav-icon"><MonitorSmartphone size={18} /></span>
                Live Monitor
              </Link>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role?.replace('_', ' ')}</div>
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
          </div>
          <div className="header-right">
            {user?.role === 'super_admin' && (
              <>
                <select
                  className="form-select"
                  value={activeEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  style={{ width: isMobile ? 130 : 180, height: 34, fontSize: '0.8rem' }}
                  title="Pilih project aktif"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
                <button className="header-btn" onClick={handleCreateEvent} title="Tambah event" style={{ borderColor: 'var(--border-color)' }}>
                  <Plus size={16} />
                </button>
              </>
            )}
            <form onSubmit={handleDaySubmit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>HARI</span>
              <input
                type="number"
                min="1"
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                onBlur={handleDaySubmit}
                className="form-input"
                style={{ width: isMobile ? 64 : 78, height: 34, padding: '6px 10px', fontWeight: 700 }}
                title="Isi hari aktif event (custom)"
              />
            </form>
            <button className="header-btn danger" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="page-wrapper" key={activeEventId}>
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
          {user?.role === 'super_admin' && (
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
