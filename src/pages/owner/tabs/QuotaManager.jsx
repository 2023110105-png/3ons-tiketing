import { useState, useMemo } from 'react'
import { 
  BarChart3, Users, Smartphone, LayoutGrid, 
  Search, AlertTriangle, AlertCircle, Save 
} from 'lucide-react'
import { getTenants, updateTenantQuota, getTenantHealth } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function QuotaManager() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants, setTenants] = useState(getTenants())
  const [healthData, setHealthData] = useState(getTenantHealth())
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(null)
  const [editData, setEditData] = useState({})

  const handleEdit = (tenant) => {
    setIsEditing(tenant.id)
    setEditData({
      maxParticipants: tenant.quota?.maxParticipants || 500,
      maxGateDevices: tenant.quota?.maxGateDevices || 3,
      maxActiveEvents: tenant.quota?.maxActiveEvents || 1
    })
  }

  const handleSave = (tenantId) => {
    const result = updateTenantQuota(tenantId, editData, currentUser)
    if (result.success) {
      toast.success('Sukses', 'Kuota tenant berhasil diperbarui')
      setTenants(getTenants())
      setHealthData(getTenantHealth())
      setIsEditing(null)
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const filteredHealth = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return healthData.filter(h => 
      !q || h.brandName.toLowerCase().includes(q)
    )
  }, [healthData, searchQuery])

  return (
    <div className="quota-manager-container">
      <div className="toolbar mb-16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="admin-search-wrap" style={{ width: '300px' }}>
          <Search size={14} className="admin-search-icon" />
          <input 
            className="form-input" 
            placeholder="Cari tenant untuk kuota..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-2 gap-16">
        {filteredHealth.map(health => {
          const tenant = tenants.find(t => t.id === health.tenantId)
          if (!tenant) return null
          
          const isWarning = health.usageParticipants >= 80
          const isCritical = health.usageParticipants >= 100

          return (
            <div key={health.tenantId} className="card">
              <div className="card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h3 className="card-title">{health.brandName}</h3>
                    <p className="text-muted text-xs">ID: {health.tenantId}</p>
                  </div>
                  {isEditing === health.tenantId ? (
                    <button className="btn btn-ghost btn-sm text-muted" onClick={() => setIsEditing(null)}>Batal</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(tenant)}>Edit Batas</button>
                  )}
                </div>

                {isEditing === health.tenantId ? (
                   <div className="quota-edit-form">
                      <div className="form-group mb-12">
                        <label className="form-label text-xs">Batas Peserta Total</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Users size={18} className="text-muted" />
                          <input 
                            type="number"
                            className="form-input"
                            value={editData.maxParticipants}
                            onChange={e => setEditData({...editData, maxParticipants: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                      <div className="form-group mb-12">
                        <label className="form-label text-xs">Batas Perangkat Gate</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Smartphone size={18} className="text-muted" />
                          <input 
                            type="number"
                            className="form-input"
                            value={editData.maxGateDevices}
                            onChange={e => setEditData({...editData, maxGateDevices: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                      <div className="form-group mb-12">
                        <label className="form-label text-xs">Batas Event Aktif</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <LayoutGrid size={18} className="text-muted" />
                          <input 
                            type="number"
                            className="form-input"
                            value={editData.maxActiveEvents}
                            onChange={e => setEditData({...editData, maxActiveEvents: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                      <button className="btn btn-primary w-full mt-16" onClick={() => handleSave(health.tenantId)}>
                        <Save size={16} /> Simpan Perubahan Kuota
                      </button>
                   </div>
                ) : (
                  <div className="quota-display-grid">
                    <div className="usage-item mb-16">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="text-sm font-bold flex items-center gap-4">
                          <Users size={14} className="text-primary" /> Peserta Terdaftar
                        </span>
                        <span className={`text-sm font-bold ${isCritical ? 'text-red' : isWarning ? 'text-warning' : 'text-muted'}`}>
                          {health.totalParticipants} / {tenant.quota?.maxParticipants} ({health.usageParticipants}%)
                        </span>
                      </div>
                      <div className="progress-bar-bg" style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          className={`progress-bar-fill ${isCritical ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-primary'}`} 
                          style={{ height: '100%', width: `${Math.min(100, health.usageParticipants)}%`, transition: 'width 1s ease' }}
                        ></div>
                      </div>
                      {isCritical && (
                         <div className="text-xs text-red mt-8 font-bold flex items-center gap-4">
                            <AlertTriangle size={12} /> Melebihi kuota! Client tidak dapat menambah peserta lagi.
                         </div>
                      )}
                    </div>

                    <div className="grid grid-2 gap-16 mt-24">
                      <div className="p-12 bg-subtle rounded border border-color">
                         <div className="text-xs text-muted mb-4 font-bold">DEVICE LIMIT</div>
                         <div className="flex items-center gap-8">
                            <Smartphone size={16} className="text-primary" />
                            <span className="text-lg font-bold">{tenant.quota?.maxGateDevices}</span>
                            <span className="text-muted text-xs">perangkat aktif</span>
                         </div>
                      </div>
                      <div className="p-12 bg-subtle rounded border border-color">
                         <div className="text-xs text-muted mb-4 font-bold">PROJECT LIMIT</div>
                         <div className="flex items-center gap-8">
                            <LayoutGrid size={16} className="text-primary" />
                            <span className="text-lg font-bold">{tenant.quota?.maxActiveEvents}</span>
                            <span className="text-muted text-xs">event aktif</span>
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
