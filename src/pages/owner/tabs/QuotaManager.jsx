import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { 
  BarChart3, Users, Smartphone, LayoutGrid, 
  Search, AlertTriangle, AlertCircle, Save 
} from 'lucide-react'
import { getTenants, updateTenantQuota, getTenantHealth, bootstrapStoreFromFirebase } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/useAuth'

export default function QuotaManager() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants, setTenants] = useState(getTenants())
  const [healthData, setHealthData] = useState(getTenantHealth())
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(null)
  const [editData, setEditData] = useState({})

  const initialHydrationDoneRef = useRef(false)

  const runFirebaseHydrate = useCallback(async () => {
    if (typeof bootstrapStoreFromFirebase !== 'function') return
    try {
      await bootstrapStoreFromFirebase(true)
    } catch {
      // Keep owner UI responsive when Firebase hydrate is unavailable.
    }
  }, [])

  const refreshQuotaData = useCallback(async (forceFirebase = true) => {
    if (forceFirebase) {
      await runFirebaseHydrate()
    }
    setTenants(getTenants())
    setHealthData(getTenantHealth())
  }, [runFirebaseHydrate])

  // Only hydrate once on initial mount, not on every render
  useEffect(() => {
    if (initialHydrationDoneRef.current) return
    initialHydrationDoneRef.current = true
    void refreshQuotaData(true)
  }, [])

  const handleEdit = (tenant) => {
    setIsEditing(tenant.id)
    setEditData({
      maxParticipants: tenant.quota?.maxParticipants || 500,
      maxGateDevices: tenant.quota?.maxGateDevices || 3,
      maxActiveEvents: tenant.quota?.maxActiveEvents || 1
    })
  }

  const handleSave = async (tenantId) => {
    const result = updateTenantQuota(tenantId, editData, currentUser)
    if (result.success) {
      toast.success('Sukses', 'Kuota akun berhasil diperbarui')
      await refreshQuotaData(true)
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
    <div className="quota-manager-container owner-fade-in-up">
      <div className="owner-toolbar">
        <div className="owner-toolbar-left">
          <div className="owner-search-input" style={{ width: '300px' }}>
            <Search size={16} />
            <input 
              className="owner-form-input" 
              placeholder="Cari akun untuk kuota..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="owner-grid-cols-3 mt-24">
        {filteredHealth.map(health => {
          const tenant = tenants.find(t => t.id === health.tenantId)
          if (!tenant) return null
          
          const isWarning = health.usageParticipants >= 80
          const isCritical = health.usageParticipants >= 100

          return (
            <div key={health.tenantId} className="owner-card-container">
              <div className="owner-card-header">
                <div className="owner-card-title">{health.brandName}</div>
              </div>
              
              <div className="owner-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {health.tenantId}</span>
                  {isEditing === health.tenantId ? (
                    <button className="owner-action-btn" onClick={() => setIsEditing(null)}>Batal</button>
                  ) : (
                    <button className="owner-action-btn" onClick={() => handleEdit(tenant)}>Ubah Batas</button>
                  )}
                </div>

                {isEditing === health.tenantId ? (
                   <div className="quota-edit-form">
                      <div className="owner-form-group mb-12">
                        <label className="owner-form-label">Batas Peserta Total</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Users size={18} className="text-muted" />
                          <input 
                            type="number"
                            className="owner-form-input"
                            onChange={e => setEditData({...editData, maxParticipants: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                      <div className="owner-form-group mb-12">
                        <label className="owner-form-label">Batas Perangkat Gate</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Smartphone size={18} className="text-muted" />
                          <input 
                            type="number"
                            className="owner-form-input"
                            onChange={e => setEditData({...editData, maxGateDevices: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                      <div className="owner-form-group mb-12">
                        <label className="owner-form-label">Batas Event Aktif</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <LayoutGrid size={18} className="text-muted" />
                          <input 
                            type="number"
                            className="owner-form-input"
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
                          style={{ height: '100%', width: `${Math.min(100, health.usageParticipants)}%` }}
                        ></div>
                      </div>
                      {isCritical && (
                         <div className="text-xs text-red mt-8 font-bold flex items-center gap-4">
                           <AlertTriangle size={12} /> Melebihi kuota! Akun ini tidak dapat menambah peserta lagi.
                         </div>
                      )}
                    </div>

                    <div className="grid-responsive gap-16 mt-24">
                      <div className="p-12 bg-subtle rounded border border-color">
                         <div className="text-xs text-muted mb-4 font-bold">BATAS PERANGKAT</div>
                         <div className="flex items-center gap-8">
                            <Smartphone size={16} className="text-primary" />
                            <span className="text-lg font-bold">{tenant.quota?.maxGateDevices}</span>
                            <span className="text-muted text-xs">perangkat aktif</span>
                         </div>
                      </div>
                      <div className="p-12 bg-subtle rounded border border-color">
                         <div className="text-xs text-muted mb-4 font-bold">BATAS ACARA</div>
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
