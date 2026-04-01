import { useState, useMemo } from 'react'
import { 
  FileText, Calendar, DollarSign, Clock, 
  Search, CheckCircle, AlertCircle, Plus 
} from 'lucide-react'
import { getTenants, updateTenantContract } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function ContractManager() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants, setTenants] = useState(getTenants())
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(null)
  const [editData, setEditData] = useState({})

  const handleEdit = (tenant) => {
    setIsEditing(tenant.id)
    setEditData({
      package: tenant.contract?.package || 'starter',
      start_at: tenant.contract?.start_at || new Date().toISOString().split('T')[0],
      end_at: tenant.contract?.end_at || '',
      payment_status: tenant.contract?.payment_status || 'unpaid',
      amount: tenant.contract?.amount || 0,
      notes: tenant.contract?.notes || ''
    })
  }

  const handleSave = (tenantId) => {
    const result = updateTenantContract(tenantId, editData, currentUser)
    if (result.success) {
      toast.success('Sukses', 'Kontrak tenant berhasil diperbarui')
      setTenants(getTenants())
      setIsEditing(null)
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const filteredTenants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return tenants.filter(t => 
      !q || t.brandName.toLowerCase().includes(q) || t.eventName.toLowerCase().includes(q)
    )
  }, [tenants, searchQuery])

  return (
    <div className="contract-manager-container">
      <div className="toolbar mb-16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="admin-search-wrap" style={{ width: '300px' }}>
          <Search size={14} className="admin-search-icon" />
          <input 
            className="form-input" 
            placeholder="Cari tenant untuk kontrak..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-1 gap-16">
        {filteredTenants.map(tenant => (
          <div key={tenant.id} className="card">
            <div className="card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h3 className="card-title">{tenant.brandName}</h3>
                  <p className="text-muted text-sm">{tenant.eventName}</p>
                </div>

                <div className="contract-summary" style={{ display: 'flex', gap: '24px', flex: 2, flexWrap: 'wrap' }}>
                  <div className="stat-item">
                    <span className="text-xs text-muted font-bold block mb-4">PAKET</span>
                    <div className="badge badge-blue">{tenant.contract?.package?.toUpperCase() || 'STARTER'}</div>
                  </div>
                  <div className="stat-item">
                    <span className="text-xs text-muted font-bold block mb-4">MASA SEWA</span>
                    <div className="text-sm font-bold flex items-center gap-4">
                      <Calendar size={14} className="text-muted" />
                      {tenant.contract?.start_at ? new Date(tenant.contract.start_at).toLocaleDateString() : '-'}
                      <span className="text-muted mx-4">→</span>
                      {tenant.contract?.end_at ? new Date(tenant.contract.end_at).toLocaleDateString() : 'Auto-renew'}
                    </div>
                  </div>
                  <div className="stat-item">
                    <span className="text-xs text-muted font-bold block mb-4">STATUS PEMBAYARAN</span>
                    <div className={`badge ${tenant.contract?.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                      {tenant.contract?.payment_status?.toUpperCase() || 'BELUM BAYAR'}
                    </div>
                  </div>
                </div>

                <div className="actions text-right p-8">
                  {isEditing === tenant.id ? (
                    <button className="btn btn-ghost btn-sm text-muted" onClick={() => setIsEditing(null)}>Batal</button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(tenant)}>Kelola Kontrak</button>
                  )}
                </div>
              </div>

              {isEditing === tenant.id && (
                <div className="edit-form mt-24 pt-24" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div className="grid grid-3 gap-16">
                    <div className="form-group">
                      <label className="form-label">Paket Layanan</label>
                      <select 
                        className="form-select"
                        value={editData.package}
                        onChange={e => setEditData({...editData, package: e.target.value})}
                      >
                        <option value="starter">Starter (Event Kecil)</option>
                        <option value="pro">Pro (Corporate/Large)</option>
                        <option value="enterprise">Enterprise (Custom)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nominal (Rp)</label>
                      <input 
                        type="number"
                        className="form-input"
                        value={editData.amount}
                        onChange={e => setEditData({...editData, amount: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status Pembayaran</label>
                      <select 
                        className="form-select"
                        value={editData.payment_status}
                        onChange={e => setEditData({...editData, payment_status: e.target.value})}
                      >
                        <option value="unpaid">Belum Bayar (Draft)</option>
                        <option value="paid">Sudah Lunas (Paid)</option>
                        <option value="overdue">Terlambat (Overdue)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-3 gap-16 mt-16">
                    <div className="form-group">
                      <label className="form-label">Mulai Sewa</label>
                      <input 
                        type="date"
                        className="form-input"
                        value={editData.start_at}
                        onChange={e => setEditData({...editData, start_at: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Berakhir Sewa</label>
                      <input 
                        type="date"
                        className="form-input"
                        value={editData.end_at}
                        onChange={e => setEditData({...editData, end_at: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Catatan Kontrak</label>
                      <input 
                        className="form-input"
                        placeholder="Contoh: Termasuk support 24/7"
                        value={editData.notes}
                        onChange={e => setEditData({...editData, notes: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="actions-right mt-16">
                    <button className="btn btn-success" onClick={() => handleSave(tenant.id)}>Simpan Perubahan Kontrak</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
