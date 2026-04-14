import { useParams, Navigate } from 'react-router-dom'
import { LayoutDashboard, Building2, ClipboardList, Settings, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContextSaaS'

// Admin Tabs
import AdminOverview from './tabs/AdminOverview'
import AdminTenants from './tabs/AdminTenants'
import AdminAudit from './tabs/AdminAudit'
import AdminSystem from './tabs/AdminSystem'
import GateUsers from './GateUsers'

// All tabs config
const allTabsConfig = {
  overview: {
    component: AdminOverview,
    title: 'Overview',
    description: 'Ringkasan sistem dan statistik utama platform.',
    icon: LayoutDashboard,
    kicker: 'Dashboard',
    allowedTypes: ['system_admin'] // Only system admin
  },
  tenants: {
    component: AdminTenants,
    title: 'Manajemen Tenant',
    description: 'Kelola tenant, pengguna, dan akses gate.',
    icon: Building2,
    kicker: 'Organisasi',
    allowedTypes: ['system_admin'] // Only system admin
  },
  'gate-users': {
    component: GateUsers,
    title: 'Gate Users',
    description: 'Kelola petugas gate untuk check-in.',
    icon: Users,
    kicker: 'Manajemen',
    allowedTypes: ['system_admin', 'tenant_admin'] // Both can access
  },
  audit: {
    component: AdminAudit,
    title: 'Audit Log',
    description: 'Riwayat aktivitas dan jejak audit sistem.',
    icon: ClipboardList,
    kicker: 'Kepatuhan',
    allowedTypes: ['system_admin'] // Only system admin
  },
  system: {
    component: AdminSystem,
    title: 'System Health',
    description: 'Status kesehatan sistem dan tindakan pemeliharaan.',
    icon: Settings,
    kicker: 'Infrastruktur',
    allowedTypes: ['system_admin'] // Only system admin
  }
}

// Default tab for each user type
const defaultTab = {
  system_admin: 'overview',
  tenant_admin: 'gate-users'
}

export default function AdminPanel() {
  const { activeTab } = useParams()
  const { user } = useAuth()
  const userType = user?.user_type || 'tenant_admin'
  
  // Filter tabs based on user type
  const tabConfig = Object.fromEntries(
    Object.entries(allTabsConfig).filter(([tabKey, config]) => 
      config.allowedTypes.includes(userType)
    )
  )
  
  // Redirect to default tab if current tab not allowed
  const currentTab = activeTab || defaultTab[userType]
  if (!tabConfig[currentTab]) {
    return <Navigate to={`/admin-panel/${defaultTab[userType]}`} replace />
  }
  
  const config = tabConfig[currentTab]
  const ActiveComponent = config.component
  const IconComponent = config.icon

  return (
    <div className="admin-console-wrapper">
      {/* Header Konsisten */}
      <div className="admin-tab-intro">
        <span className="page-kicker">{config.kicker}</span>
        <div className="admin-tab-header">
          <div className="admin-tab-title-group">
            <h2>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <div className="admin-tab-icon">
            <IconComponent size={28} />
          </div>
        </div>
      </div>

      {/* Konten Tab */}
      <div className="admin-tab-content">
        <ActiveComponent />
      </div>
    </div>
  )
}
