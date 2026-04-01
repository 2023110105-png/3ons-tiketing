import { useState, useMemo } from 'react'
import { 
  Settings, Palette, Type, Image as ImageIcon, 
  Save, Search, ShieldCheck, Layout 
} from 'lucide-react'
import { getTenants, updateTenantBranding } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function WhiteLabel() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants, setTenants] = useState(getTenants())
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [branding, setBranding] = useState({
    primaryColor: '#0ea5e9',
    appName: '',
    logo: ''
  })

  const selectedTenant = useMemo(() => 
    tenants.find(t => t.id === selectedTenantId), 
  [tenants, selectedTenantId])

  const handleSelectTenant = (tenantId) => {
    setSelectedTenantId(tenantId)
    const t = tenants.find(t => t.id === tenantId)
    if (t) {
      setBranding({
        primaryColor: t.branding?.primaryColor || '#0ea5e9',
        appName: t.branding?.appName || t.brandName,
        logo: t.branding?.logo || ''
      })
    }
  }

  const handleSave = () => {
    const result = updateTenantBranding(selectedTenantId, branding, currentUser)
    if (result.success) {
      toast.success('Sukses', 'Branding tenant berhasil diperbarui')
      setTenants(getTenants())
    }
  }

  return (
    <div className="white-label-container">
      <div className="toolbar mb-16">
        <select 
          className="form-select" 
          style={{ maxWidth: '400px' }}
          value={selectedTenantId}
          onChange={e => handleSelectTenant(e.target.value)}
        >
          <option value="">-- Pilih Tenant untuk Kustomisasi --</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.brandName}</option>
          ))}
        </select>
      </div>

      {selectedTenant ? (
        <div className="grid grid-2-1 gap-24">
          <div className="card">
            <div className="card-pad">
              <h3 className="card-title mb-24">Pengaturan Branding</h3>
              
              <div className="form-group mb-20">
                <label className="form-label">Nama Aplikasi Kustom</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Type size={18} className="text-muted" />
                  <input 
                    className="form-input" 
                    value={branding.appName}
                    onChange={e => setBranding({...branding, appName: e.target.value})}
                    placeholder={selectedTenant.brandName}
                  />
                </div>
                <p className="text-xs text-muted mt-4">Nama ini akan muncul di sidebar dan judul halaman client.</p>
              </div>

              <div className="form-group mb-20">
                <label className="form-label">Warna Tema Utama</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Palette size={18} className="text-muted" />
                  <input 
                    type="color" 
                    className="form-input"
                    style={{ width: '60px', padding: '2px', height: '38px' }}
                    value={branding.primaryColor}
                    onChange={e => setBranding({...branding, primaryColor: e.target.value})}
                  />
                  <input 
                    className="form-input" 
                    value={branding.primaryColor}
                    onChange={e => setBranding({...branding, primaryColor: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group mb-24">
                <label className="form-label">Logo Tenant (URL atau Base64)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ImageIcon size={18} className="text-muted" />
                  <input 
                    className="form-input" 
                    value={branding.logo}
                    onChange={e => setBranding({...branding, logo: e.target.value})}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>

              <button className="btn btn-primary w-full" onClick={handleSave}>
                <Save size={18} /> Simpan Perubahan Branding
              </button>
            </div>
          </div>

          <div className="preview-section">
            <div className="card bg-subtle">
              <div className="card-pad">
                <h4 className="text-xs font-bold text-muted mb-16 uppercase">PREVIEW SIDEBAR</h4>
                <div style={{ 
                  background: 'white', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: branding.primaryColor, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                      {branding.appName?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{branding.appName || selectedTenant.brandName}</div>
                      <div style={{ fontSize: '10px', color: '#666' }}>{selectedTenant.eventName}</div>
                    </div>
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div style={{ height: '30px', background: `${branding.primaryColor}22`, borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                      <div style={{ width: '14px', height: '14px', background: branding.primaryColor, borderRadius: '2px', marginRight: '8px' }}></div>
                      <div style={{ height: '8px', width: '60px', background: branding.primaryColor, borderRadius: '2px' }}></div>
                    </div>
                    <div style={{ height: '30px', background: 'transparent', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                       <div style={{ width: '14px', height: '14px', background: '#ccc', borderRadius: '2px', marginRight: '8px' }}></div>
                       <div style={{ height: '8px', width: '80px', background: '#ddd', borderRadius: '2px' }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-24 p-12 bg-white rounded text-center border-dashed border-color" style={{ fontSize: '0.75rem' }}>
                   <Layout size={16} className="mx-auto mb-8 text-muted" />
                   Perubahan warna tema akan diaplikasikan ke seluruh dashboard tenant tersebut.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card card-pad text-center p-64">
           <Settings size={48} className="text-muted mx-auto mb-16" />
           <p className="text-muted">Pilih tenant untuk mulai mengatur tampilan aplikasi mereka.</p>
        </div>
      )}
    </div>
  )
}
