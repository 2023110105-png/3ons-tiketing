import { useState, useMemo, useEffect } from 'react'
import {
  Users, ShieldCheck, FileText, BarChart3, 
  Settings, Key, History, Activity, Database, 
  Bell, Eye, LayoutGrid, X, Menu, Search, LogOut
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getOwnerNotifications, markNotificationRead } from '../../store/mockData'

// Tabs
import TenantList from './tabs/TenantList'
import ContractManager from './tabs/ContractManager'
import QuotaManager from './tabs/QuotaManager'
import UserManagement from './tabs/UserManager'
import AuditLog from './tabs/AuditLog'
import TenantHealth from './tabs/TenantHealth'
import BillingInvoice from './tabs/BillingInvoice'
import BackupRestore from './tabs/BackupRestore'
import WhiteLabel from './tabs/WhiteLabel'
import NotificationCenter from './tabs/NotificationCenter'
import ImpersonateView from './tabs/ImpersonateView'

export default function OwnerPanel() {
  const { user } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('tenants')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [notifications, setNotifications] = useState(getOwnerNotifications())
  const [showNotifications, setShowNotifications] = useState(false)

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false)
      else setIsSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const menuItems = [
    { id: 'tenants', label: 'Tenants', icon: <LayoutGrid size={20} /> },
    { id: 'contracts', label: 'Kontrak Sewa', icon: <FileText size={20} /> },
    { id: 'quotas', label: 'Kuota Tenant', icon: <BarChart3 size={20} /> },
    { id: 'users', label: 'User Management', icon: <Users size={20} /> },
    { id: 'impersonate', label: 'Impersonate', icon: <Eye size={20} /> },
    { id: 'billing', label: 'Billing & Invoice', icon: <History size={20} /> },
    { id: 'audit', label: 'Audit Log', icon: < ShieldCheck size={20} /> },
    { id: 'health', label: 'Health Dashboard', icon: <Activity size={20} /> },
    { id: 'backup', label: 'Backup / Restore', icon: <Database size={20} /> },
    { id: 'branding', label: 'White-Label', icon: <Settings size={20} /> },
    { id: 'notifications', label: 'Pemberitahuan', icon: <Bell size={20} /> },
  ]

  const handleNotificationClick = (id) => {
    markNotificationRead(id)
    setNotifications(getOwnerNotifications())
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'tenants':
        return <TenantList 
                  onManageUsers={(tenant) => { setActiveTab('users'); }} 
                  onEditContract={(tenant) => { setActiveTab('contracts'); }} 
                />
      case 'contracts':
        return <ContractManager />
      case 'quotas':
        return <QuotaManager />
      case 'users':
        return <UserManagement />
      case 'impersonate':
        return <ImpersonateView />
      case 'billing':
        return <BillingInvoice />
      case 'audit':
        return <AuditLog />
      case 'health':
        return <TenantHealth />
      case 'backup':
        return <BackupRestore />
      case 'branding':
        return <WhiteLabel />
      case 'notifications':
        return <NotificationCenter />
      default:
        return <TenantList />
    }
  }

  return (
    <div className="owner-panel-shell" style={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 120px)', background: 'var(--bg-subtle)' }}>
      {/* Internal Sidebar for Owner Console */}
      <aside className={`owner-sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ 
        width: isSidebarOpen ? '260px' : '0', 
        overflow: 'hidden', 
        transition: 'width 0.3s ease',
        background: 'var(--card-bg)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 10
      }}>
        <div className="owner-sidebar-header p-20" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck className="text-primary" size={24} /> 
            Owner Console
          </h3>
        </div>
        <nav className="owner-sidebar-nav p-12">
          {menuItems.map(item => (
            <button 
              key={item.id} 
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', marginBottom: '4px' }}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'notifications' && unreadCount > 0 && (
                <span className="badge badge-red ml-auto" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Container */}
      <div className="owner-main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="owner-header p-16" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-ghost p-8" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold">{menuItems.find(m => m.id === activeTab)?.label}</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost p-8" onClick={() => setShowNotifications(!showNotifications)}>
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="notification-dot"></span>}
                </button>
                {showNotifications && (
                  <div className="notifications-dropdown card" style={{ position: 'absolute', top: '100%', right: 0, width: '320px', zIndex: 100, maxHeight: '400px', overflowY: 'auto' }}>
                    <div className="card-pad p-12" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <h4 className="card-title text-sm">Pemberitahuan Kontrol</h4>
                    </div>
                    <div className="p-4">
                      {notifications.length === 0 ? (
                        <div className="p-16 text-center text-muted text-sm">Tidak ada pemberitahuan baru</div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            className={`p-12 text-sm notification-item ${!n.read ? 'unread' : ''}`} 
                            style={{ cursor: 'pointer', borderRadius: '4px' }}
                            onClick={() => handleNotificationClick(n.id)}
                          >
                            <div className="font-bold">{n.message}</div>
                            <div className="text-xs text-muted mt-4">{new Date(n.created_at).toLocaleString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
             </div>
             <div className="owner-user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <div className="avatar avatar-sm bg-primary">{user?.name?.charAt(0)}</div>
               <span className="text-sm font-bold">{user?.name}</span>
             </div>
          </div>
        </header>

        <div className="owner-content p-24" style={{ flex: 1, overflowY: 'auto' }}>
          {renderActiveTab()}
        </div>
      </div>
    </div>
  )
}
