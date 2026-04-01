import { useMemo, useState } from 'react'
import { Search, Plus, UserPlus, FileEdit, Trash2, Smartphone, Users } from 'lucide-react'
import { getTenants, getActiveTenant, switchActiveTenant, setTenantStatus, deleteTenant, createTenant } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function TenantList({ onManageUsers, onEditContract }) {
  const toast = useToast()
  const { user } = useAuth()
  const [tenants, setTenants] = useState(getTenants())
  const [activeTenantId, setActiveTenantId] = useState(getActiveTenant().id)
  
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState('all')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTenant, setNewTenant] = useState({ brandName: '', eventName: '', expiresAt: '' })

  const refreshTenants = () => {
    setTenants(getTenants())
    setActiveTenantId(getActiveTenant().id)
  }

  const handleCreate = (e) => {
    e.preventDefault()
    const result = createTenant(newTenant, user)
    if (result.success) {
      toast.success('Sukses', 'Tenant baru berhasil dibuat')
      setShowCreateModal(false)
      setNewTenant({ brandName: '', eventName: '', expiresAt: '' })
      refreshTenants()
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const handleActivate = (tenant) => {
    const result = switchActiveTenant(tenant.id, user)
    if (result.success) {
      refreshTenants()
      toast.success('Aktif', `Sekarang mengelola: ${tenant.brandName}`)
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const handleToggleStatus = (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'inactive' : 'active'
    const result = setTenantStatus(tenant.id, nextStatus, user)
    if (result.success) {
      refreshTenants()
      toast.success('Update', `Status ${tenant.brandName} menjadi ${nextStatus}`)
    }
  }

  const handleDelete = (tenant) => {
    if (window.confirm(`Hapus tenant ${tenant.brandName}? Semua data terkait akan hilang.`)) {
      const result = deleteTenant(tenant.id, user)
      if (result.success) {
        refreshTenants()
        toast.success('Dihapus', `Tenant ${tenant.brandName} berhasil dihapus`)
      }
    }
  }

  const visibleTenants = useMemo(() => {
    return tenants
      .filter(t => {
        if (tenantFilter === 'active') return t.status === 'active' && !t.isExpired
        if (tenantFilter === 'inactive') return t.status !== 'active'
        if (tenantFilter === 'expired') return t.isExpired
        return true
      })
      .filter(t => {
        const q = tenantSearch.toLowerCase().trim()
        return !q || `${t.brandName} ${t.eventName}`.toLowerCase().includes(q)
      })
  }, [tenants, tenantFilter, tenantSearch])

  return (
    <div className="tenant-list-container">
      <div className="actions-bar mb-16" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <div className="admin-search-wrap" style={{ flex: 1, maxWidth: '400px' }}>
            <Search size={14} className="admin-search-icon" />
            <input 
              className="form-input" 
              placeholder="Cari tenant..." 
              value={tenantSearch} 
              onChange={e => setTenantSearch(e.target.value)} 
            />
          </div>
          <select 
            className="form-select" 
            style={{ width: 'auto' }} 
            value={tenantFilter} 
            onChange={e => setTenantFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> Tambah Tenant
        </button>
      </div>

      <div className="grid-responsive mt-24">
        {visibleTenants.map(tenant => (
          <div key={tenant.id} className={`card tenant-card ${tenant.id === activeTenantId ? 'border-primary' : ''}`}>
            <div className="card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="card-title" style={{ marginBottom: '4px' }}>{tenant.brandName}</h3>
                  <p className="text-muted text-sm">{tenant.eventName}</p>
                </div>
                <div className={`badge ${tenant.status === 'active' ? (tenant.isExpired ? 'badge-red' : 'badge-green') : 'badge-yellow'}`}>
                  {tenant.isExpired ? 'Expired' : (tenant.status === 'active' ? 'Aktif' : 'Nonaktif')}
                </div>
              </div>

              <div className="tenant-meta mt-16" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paket:</span>
                  <span className="text-primary font-bold">{tenant.contract?.package?.toUpperCase() || 'STARTER'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span>Status Bayar:</span>
                  <span className={tenant.contract?.payment_status === 'paid' ? 'text-green' : 'text-red'}>
                    {tenant.contract?.payment_status?.toUpperCase() || 'UNPAID'}
                  </span>
                </div>
              </div>

              <div className="card-actions mt-16 pt-16" style={{ borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {tenant.id !== activeTenantId && tenant.status === 'active' && !tenant.isExpired && (
                  <button className="btn btn-ghost btn-sm btn-primary" onClick={() => handleActivate(tenant)}>Pakai</button>
                )}
                <button className="btn btn-ghost btn-sm" title="Manage Users" onClick={() => onManageUsers(tenant)}>
                  <Users size={14} />
                </button>
                <button className="btn btn-ghost btn-sm" title="Edit Contract" onClick={() => onEditContract(tenant)}>
                  <FileEdit size={14} />
                </button>
                <button 
                  className={`btn btn-ghost btn-sm ${tenant.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleStatus(tenant)}
                  title={tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                >
                  <Smartphone size={14} />
                </button>
                {tenant.id !== 'tenant-default' && (
                  <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(tenant)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {tenant.id === activeTenantId && <div className="card-badge-top">Sedang Digunakan</div>}
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '500px' }}>
            <div className="card-pad">
              <h3 className="card-title mb-16">Tambah Tenant Baru</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label">Nama Brand</label>
                  <input 
                    className="form-input" 
                    required 
                    value={newTenant.brandName}
                    onChange={e => setNewTenant({...newTenant, brandName: e.target.value})}
                    placeholder="Contoh: Yamaha Indonesia" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nama Event</label>
                  <input 
                    className="form-input" 
                    value={newTenant.eventName}
                    onChange={e => setNewTenant({...newTenant, eventName: e.target.value})}
                    placeholder="Contoh: Yamaha Roadshow 2026" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Expired (Opsional)</label>
                  <input 
                    className="form-input" 
                    type="date"
                    value={newTenant.expiresAt}
                    onChange={e => setNewTenant({...newTenant, expiresAt: e.target.value})}
                  />
                </div>
                <div className="actions-right mt-24">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Tenant</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
