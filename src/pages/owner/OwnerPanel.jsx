import { useParams, useNavigate } from 'react-router-dom'

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
  const { activeTab } = useParams()
  const navigate = useNavigate()
  
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'tenants':
        return <TenantList 
                  onManageUsers={() => navigate('/owner/users')} 
                  onEditContract={() => navigate('/owner/contracts')} 
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
    <div className="owner-console-wrapper animate-fade-in">
      <div className="page-header mb-24">
        <h1>Pusat Kontrol Pemilik</h1>
        <p>Kelola platform, akun, dan pemantauan sistem dari satu tempat.</p>
      </div>
      
      <div className="owner-tab-content card">
        <div className="card-pad">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  )
}
