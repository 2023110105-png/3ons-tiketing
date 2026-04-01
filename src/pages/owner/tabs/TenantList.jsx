import { useMemo, useState } from 'react'
import { Search, Plus, UserPlus, FileEdit, Trash2, Smartphone, Users, X } from 'lucide-react'
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
    <div className="tenant-list-container owner-fade-in-up">
      <div className="owner-toolbar">
        <div className="owner-toolbar-left">
          <div className="owner-search-input">
            <Search size={16} />
            <input 
              className="owner-form-input" 
              placeholder="Cari tenant..." 
              value={tenantSearch} 
              onChange={e => setTenantSearch(e.target.value)} 
            />
          </div>
          <select 
            className="owner-form-select" 
            style={{ width: '180px' }} 
            value={tenantFilter} 
            onChange={e => setTenantFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="active">✓ Aktif</option>
            <option value="inactive">○ Nonaktif</option>
            <option value="expired">⚠ Expired</option>
          </select>
        </div>
        <div className="owner-toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Tenant Baru
          </button>
        </div>
      </div>

      <div className="owner-grid-cols-2">
        {visibleTenants.map(tenant => (
          <div key={tenant.id} className="owner-card-container" style={{ opacity: tenant.isExpired ? 0.75 : 1 }}>
            <div className="owner-card-header">
              <div style={{ flex: 1 }}>
                <div className="owner-card-title">
                  {tenant.id === activeTenantId && <span style={{ color: 'var(--brand-primary)', fontSize: '0.8rem' }}>●</span>}
                  {tenant.brandName}
                </div>
                <p style={{ marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tenant.eventName}</p>
              </div>
              <div className={`owner-status-badge ${tenant.isExpired ? 'expired' : (tenant.status === 'active' ? 'active' : 'inactive')}`}>
                {tenant.isExpired ? '⚠ Expired' : (tenant.status === 'active' ? '✓ Aktif' : '○ Off')}
              </div>
            </div>
            
            <div className="owner-card-body">
              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Paket</span>
                  <span className="badge badge-blue">{tenant.contract?.package?.toUpperCase() || 'STARTER'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pembayaran</span>
                  <span className={`badge ${tenant.contract?.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                    {tenant.contract?.payment_status?.toUpperCase() || 'UNPAID'}
                  </span>
                </div>
              </div>
              
              {tenant.expires_at && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {tenant.isExpired ? (
                    <span style={{ color: 'var(--danger)' }}>Expired: {new Date(tenant.expires_at).toLocaleDateString('id-ID')}</span>
                  ) : (
                    <span>Aktif sampai: {new Date(tenant.expires_at).toLocaleDateString('id-ID')}</span>
                  )}
                </div>
              )}
            </div>

            <div className="owner-card-footer">
              {tenant.id !== activeTenantId && tenant.status === 'active' && !tenant.isExpired && (
                <button className="owner-action-btn" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)' }} onClick={() => handleActivate(tenant)}>
                  Pakai
                </button>
              )}
              <button className="owner-action-btn" title="Manage Users" onClick={() => onManageUsers(tenant)}>
                <Users size={14} />
              </button>
              <button className="owner-action-btn" title="Edit Contract" onClick={() => onEditContract(tenant)}>
                <FileEdit size={14} />
              </button>
              <button 
                className="owner-action-btn success"
                onClick={() => handleToggleStatus(tenant)}
                title={tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
              >
                <Smartphone size={14} />
              </button>
              {tenant.id !== 'tenant-default' && (
                <button className="owner-action-btn danger" onClick={() => handleDelete(tenant)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {visibleTenants.length === 0 && (
        <div className="owner-empty-state">
          <div className="owner-empty-icon">🔍</div>
          <div className="owner-empty-title">Tidak ada tenant</div>
          <div className="owner-empty-message">Coba cari dengan keyword lain atau buat tenant baru</div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="owner-modal card">
            <div className="owner-modal-header">
              <div className="owner-modal-title">
                <Plus size={20} /> Tambah Tenant Baru
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="owner-modal-body">
              <form onSubmit={handleCreate}>
                <div className="owner-form-group">
                  <label className="owner-form-label">Nama Brand</label>
                  <input 
                    className="owner-form-input" 
                    required 
                    value={newTenant.brandName}
                    onChange={e => setNewTenant({...newTenant, brandName: e.target.value})}
                    placeholder="Contoh: Yamaha Indonesia" 
                  />
                </div>
                <div className="owner-form-group">
                  <label className="owner-form-label">Nama Event</label>
                  <input 
                    className="owner-form-input" 
                    value={newTenant.eventName}
                    onChange={e => setNewTenant({...newTenant, eventName: e.target.value})}
                    placeholder="Contoh: Yamaha Roadshow 2026" 
                  />
                </div>
                <div className="owner-form-group">
                  <label className="owner-form-label">Tanggal Expired (Opsional)</label>
                  <input 
                    className="owner-form-input" 
                    type="date"
                    value={newTenant.expiresAt}
                    onChange={e => setNewTenant({...newTenant, expiresAt: e.target.value})}
                  />
                </div>
              </form>
            </div>
            
            <div className="owner-modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Batal</button>
              <button onClick={handleCreate} className="btn btn-primary">Simpan Tenant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
