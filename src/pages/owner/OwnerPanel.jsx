import { useParams, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, ClipboardList, Settings } from 'lucide-react'

// Simplified Owner Tabs - only 4 essential menus
import OwnerOverview from './tabs/OwnerOverview'
import OwnerTenants from './tabs/OwnerTenants'
import OwnerAudit from './tabs/OwnerAudit'
import OwnerSystem from './tabs/OwnerSystem'

const OWNER_MENU = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/owner' },
  { id: 'tenants', label: 'Tenants', icon: Building2, path: '/owner/tenants' },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList, path: '/owner/audit' },
  { id: 'system', label: 'System', icon: Settings, path: '/owner/system' }
]

export default function OwnerPanel() {
  const { activeTab } = useParams()
  const navigate = useNavigate()
  const currentTab = activeTab || 'overview'

  const handleTabChange = (tabId) => {
    const menu = OWNER_MENU.find(m => m.id === tabId)
    if (menu) navigate(menu.path)
  }

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'overview':
        return <OwnerOverview onNavigate={handleTabChange} />
      case 'tenants':
        return <OwnerTenants />
      case 'audit':
        return <OwnerAudit />
      case 'system':
        return <OwnerSystem />
      default:
        return <OwnerOverview onNavigate={handleTabChange} />
    }
  }

  return (
    <div className="owner-panel-container">
      {/* Sidebar Navigation */}
      <aside className="owner-sidebar">
        <div className="owner-brand">
          <div className="owner-brand-icon">3o</div>
          <div className="owner-brand-text">
            <span className="owner-brand-name">Owner Panel</span>
            <span className="owner-brand-sub">Platform Management</span>
          </div>
        </div>

        <nav className="owner-nav">
          {OWNER_MENU.map(item => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`owner-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="owner-sidebar-footer">
          <button onClick={() => navigate('/admin')} className="owner-nav-item">
            ← Kembali ke Admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="owner-main">
        <header className="owner-header">
          <h1>{OWNER_MENU.find(m => m.id === currentTab)?.label || 'Overview'}</h1>
          <div className="owner-header-actions">
            <span className="owner-role-badge">Platform Owner</span>
          </div>
        </header>

        <div className="owner-content">
          {renderActiveTab()}
        </div>
      </main>
    </div>
  )
}
