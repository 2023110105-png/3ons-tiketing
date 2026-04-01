import { useMemo, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { getTenants, getActiveTenant, createTenant, setTenantStatus, switchActiveTenant, deleteTenant } from '../../store/mockData'
import { Search, ShieldCheck } from 'lucide-react'

export default function OwnerPanel() {
  const toast = useToast()
  const { user } = useAuth()

  const [tenants, setTenants] = useState(getTenants())
  const [activeTenantId, setActiveTenantId] = useState(getActiveTenant().id)

  const [tenantBrandName, setTenantBrandName] = useState('')
  const [tenantEventName, setTenantEventName] = useState('')
  const [tenantExpiresAt, setTenantExpiresAt] = useState('')

  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState('all')

  const refreshTenants = () => {
    setTenants(getTenants())
    setActiveTenantId(getActiveTenant().id)
  }

  const handleCreateTenant = (e) => {
    e.preventDefault()

    if (!tenantBrandName.trim()) {
      toast.error('Gagal', 'Nama brand tenant wajib diisi')
      return
    }

    const result = createTenant({
      brandName: tenantBrandName,
      eventName: tenantEventName,
      expiresAt: tenantExpiresAt || null
    }, user)

    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal membuat tenant')
      return
    }

    setTenantBrandName('')
    setTenantEventName('')
    setTenantExpiresAt('')
    refreshTenants()
    toast.success('Sukses', 'Tenant baru berhasil dibuat')
  }

  const handleActivateTenant = (tenant) => {
    const result = switchActiveTenant(tenant.id, user)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal mengaktifkan tenant')
      return
    }
    refreshTenants()
    toast.success('Sukses', `Tenant aktif: ${tenant.brandName}`)
  }

  const handleToggleTenantStatus = (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'inactive' : 'active'
    const result = setTenantStatus(tenant.id, nextStatus, user)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal update status tenant')
      return
    }
    refreshTenants()
    toast.success('Sukses', `Status tenant ${tenant.brandName} menjadi ${nextStatus}`)
  }

  const handleDeleteTenant = (tenant) => {
    const confirmation = window.prompt(`Hapus tenant ${tenant.brandName}? Ketik HAPUS untuk lanjut:`, '')
    if (confirmation === null) return
    if (confirmation !== 'HAPUS') {
      toast.error('Gagal', 'Konfirmasi harus HAPUS')
      return
    }

    const result = deleteTenant(tenant.id, user)
    if (!result.success) {
      toast.error('Gagal', result.error || 'Gagal hapus tenant')
      return
    }

    refreshTenants()
    toast.success('Sukses', `Tenant ${tenant.brandName} berhasil dihapus`)
  }

  const normalizedTenantSearch = tenantSearch.toLowerCase().trim()

  const visibleTenants = useMemo(() => {
    return tenants
      .filter(tenant => {
        if (tenantFilter === 'active') return tenant.status === 'active' && !tenant.isExpired
        if (tenantFilter === 'inactive') return tenant.status !== 'active'
        if (tenantFilter === 'expired') return tenant.isExpired
        return true
      })
      .filter(tenant => {
        if (!normalizedTenantSearch) return true
        const haystack = `${tenant.brandName} ${tenant.eventName}`.toLowerCase()
        return haystack.includes(normalizedTenantSearch)
      })
  }, [tenants, tenantFilter, normalizedTenantSearch])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Owner Panel</h1>
        <p>Kelola client sewa: brand, event, dan status akses tenant</p>
      </div>

      <div className="settings-wrap">
        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline"><ShieldCheck size={18} /> Buat Client/Tenant Baru</h3>
          <form onSubmit={handleCreateTenant}>
            <div className="form-group">
              <label className="form-label">Nama Brand</label>
              <input className="form-input" value={tenantBrandName} onChange={e => setTenantBrandName(e.target.value)} placeholder="Contoh: Yamaha Indonesia" required />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Event</label>
              <input className="form-input" value={tenantEventName} onChange={e => setTenantEventName(e.target.value)} placeholder="Contoh: Yamaha Roadshow 2026" />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Expired (opsional)</label>
              <input className="form-input" type="date" value={tenantExpiresAt} onChange={e => setTenantExpiresAt(e.target.value)} />
            </div>
            <div className="actions-right">
              <button type="submit" className="btn btn-primary">Tambah Tenant</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Daftar Client/Tenant</h3>
          <div className="tenant-toolbar">
            <div className="admin-search-wrap backup-search-wrap">
              <Search size={14} className="admin-search-icon" />
              <input className="form-input" type="text" placeholder="Cari brand atau event tenant..." value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} />
            </div>
            <select className="form-select backup-select" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}>
              <option value="all">Semua Tenant</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="tenant-stats-row">
            <span className="badge badge-gray">Total: {tenants.length}</span>
            <span className="badge badge-green">Aktif: {tenants.filter(t => t.status === 'active' && !t.isExpired).length}</span>
            <span className="badge badge-yellow">Nonaktif: {tenants.filter(t => t.status !== 'active').length}</span>
            <span className="badge badge-red">Expired: {tenants.filter(t => t.isExpired).length}</span>
          </div>

          <div className="event-list mt-16">
            {visibleTenants.length === 0 && <div className="event-meta">Tidak ada tenant sesuai filter/pencarian.</div>}
            {visibleTenants.map(tenant => (
              <div key={tenant.id} className="event-item">
                <div className="event-row">
                  <div>
                    <div className="event-name">{tenant.brandName}</div>
                    <div className="event-meta">{tenant.eventName}</div>
                    <div className="tenant-meta-badges">
                      <span className={`badge ${tenant.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>{tenant.status === 'active' ? 'Aktif' : 'Nonaktif'}</span>
                      {tenant.isExpired && <span className="badge badge-red">Expired</span>}
                      {tenant.id === activeTenantId && <span className="badge badge-blue">Sedang Dipakai</span>}
                    </div>
                  </div>
                  <div className="event-actions">
                    {tenant.id !== activeTenantId && tenant.status === 'active' && !tenant.isExpired && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleActivateTenant(tenant)}>Pakai</button>
                    )}
                    {tenant.id !== 'tenant-default' && (
                      <button className="btn btn-ghost btn-warning btn-sm" onClick={() => handleToggleTenantStatus(tenant)}>
                        {tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                    {tenant.id !== 'tenant-default' && tenant.id !== activeTenantId && (
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteTenant(tenant)}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
