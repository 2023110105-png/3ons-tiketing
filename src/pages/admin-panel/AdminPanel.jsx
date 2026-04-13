import { useParams, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, ClipboardList, Settings } from 'lucide-react'

// Simplified Admin Tabs - only 4 essential menus
import AdminOverview from './tabs/AdminOverview'
import AdminTenants from './tabs/AdminTenants'
import AdminAudit from './tabs/AdminAudit'
import AdminSystem from './tabs/AdminSystem'

const ADMIN_MENU = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin-panel' },
  { id: 'tenants', label: 'Tenants', icon: Building2, path: '/admin-panel/tenants' },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList, path: '/admin-panel/audit' },
  { id: 'system', label: 'System', icon: Settings, path: '/admin-panel/system' }
]

export default function AdminPanel() {
  const { activeTab } = useParams()
  const navigate = useNavigate()
  const currentTab = activeTab || 'overview'

  const handleTabChange = (tabId) => {
    const menu = ADMIN_MENU.find(m => m.id === tabId)
    if (menu) navigate(menu.path)
  }

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'overview':
        return <AdminOverview onNavigate={handleTabChange} />
      case 'tenants':
        return <AdminTenants />
      case 'audit':
        return <AdminAudit />
      case 'system':
        return <AdminSystem />
      default:
        return <AdminOverview onNavigate={handleTabChange} />
    }
  }

  return (
    <div className="admin-panel-container">
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">3o</div>
          <div className="admin-brand-text">
            <span className="admin-brand-name">Admin Panel</span>
            <span className="admin-brand-sub">System Management</span>
          </div>
        </div>

        <nav className="admin-nav">
          {ADMIN_MENU.map(item => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <button onClick={() => navigate('/operator')} className="admin-nav-item">
            ← Kembali ke Operator
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <h1>{ADMIN_MENU.find(m => m.id === currentTab)?.label || 'Overview'}</h1>
          <div className="admin-header-actions">
            <span className="admin-role-badge">System Admin</span>
          </div>
        </header>

        <div className="admin-content">
          {renderActiveTab()}
        </div>
      </main>
    </div>
  )
}
