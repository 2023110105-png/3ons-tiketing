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
import ServerVerifyTools from './tabs/ServerVerifyTools'

const RELEASE_MORNING_MODE = true
const OWNER_RELEASE_ALLOWED_TABS = new Set(['users', 'billing', 'audit', 'health', 'notifications'])

export default function OwnerPanel() {
  const { activeTab } = useParams()
  const navigate = useNavigate()
  
  const renderActiveTab = () => {
    if (RELEASE_MORNING_MODE && activeTab && !OWNER_RELEASE_ALLOWED_TABS.has(activeTab)) {
      return (
        <div className="owner-empty-state" style={{ padding: '42px 20px' }}>
          <div className="owner-empty-icon">🛡️</div>
          <div className="owner-empty-title">Menu dikunci sementara</div>
          <p className="owner-empty-message" style={{ maxWidth: 560, margin: '10px auto 18px' }}>
            Mode rilis pagi aktif. Untuk menjaga sistem tetap stabil saat handover ke user, menu ini dinonaktifkan sementara.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/owner/users')}>
            Buka Kelola Pengguna
          </button>
        </div>
      )
    }

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
      case 'tech-tools':
        return <ServerVerifyTools />
      default:
        return RELEASE_MORNING_MODE ? <UserManagement /> : <TenantList />
    }
  }

  return (
    <div className="owner-console-wrapper animate-fade-in">
      <header className="owner-console-hero">
        <span className="page-kicker">Platform</span>
        <h1>Pusat kendali pemilik</h1>
        <p>Kelola akun brand, kuota, kontrak, audit, dan kesehatan sistem. Perubahan di lingkungan ini berdampak ke banyak tenant—gunakan dengan hati-hati.</p>
      </header>

      <div className="owner-tab-content card owner-workspace-card">
        <div className="card-pad">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  )
}
