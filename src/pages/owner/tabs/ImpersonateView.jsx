import { useState, useMemo } from 'react'
import { 
  Eye, CornerRightUp, ShieldCheck, 
  ArrowRight, Search, Users, ShieldAlert 
} from 'lucide-react'
import { getTenants, getTenantUsers } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function ImpersonateView() {
  const toast = useToast()
  const { login } = useAuth()
  
  const [tenants] = useState(getTenants())
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  const handleSelectTenant = (tenantId) => {
    setSelectedTenantId(tenantId)
    setUsers(getTenantUsers(tenantId))
  }

  const handleImpersonate = (targetUser) => {
    if (window.confirm(`Masuk sebagai ${targetUser.username} (${targetUser.role})? Anda akan keluar dari Owner Panel.`)) {
      // In our mock system, login() function handles the session update.
      // We'll use the secret "owner-bypass" logic (since we know the passwords)
      const result = login(targetUser.username, targetUser.password)
      if (result.success) {
        toast.success('Sukses', `Sekarang masuk sebagai ${targetUser.username}`)
        setTimeout(() => window.location.href = '/admin', 1000)
      } else {
        toast.error('Gagal', result.error)
      }
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return users.filter(u => 
      !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  return (
    <div className="impersonate-view-container">
      <div className="card mb-24 bg-subtle border-primary">
        <div className="card-pad flex gap-16 items-center">
          <div className="p-12 bg-primary rounded-full text-white">
            <Eye size={28} />
          </div>
          <div>
            <h3 className="font-bold">Mode Impersonate (View as Client)</h3>
            <p className="text-sm text-muted">Fitur ini memungkinkan Anda untuk masuk ke dashboard client tanpa mengetahui password mereka untuk keperluan bantuan teknis (support). Aksi Anda akan tercatat sebagai aksi owner di log audit.</p>
          </div>
        </div>
      </div>

      <div className="toolbar mb-16 flex gap-12">
        <select 
          className="form-select" 
          style={{ maxWidth: '300px' }}
          value={selectedTenantId}
          onChange={e => handleSelectTenant(e.target.value)}
        >
          <option value="">-- Pilih Tenant --</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.brandName}</option>
          ))}
        </select>
        {selectedTenantId && (
          <div className="admin-search-wrap" style={{ flex: 1, maxWidth: '300px' }}>
            <Search size={14} className="admin-search-icon" />
            <input 
              className="form-input" 
              placeholder="Cari user tenant..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="grid-responsive gap-16 mt-24">
        {!selectedTenantId ? (
          <div className="col-span-3 text-center p-64 card text-muted">
            Pilih tenant terlebih dahulu untuk melihat daftar user yang bisa di-impersonate.
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-3 text-center p-64 card text-muted">
            Tidak ada user aktif ditemukan untuk tenant ini.
          </div>
        ) : (
          filteredUsers.map(u => (
            <div key={u.id} className="card hover-shadow transition-all">
              <div className="card-pad">
                <div className="flex gap-12 items-center mb-16">
                  <div className="avatar bg-subtle text-primary font-bold">{u.username.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="font-bold text-sm truncate">{u.name}</div>
                    <div className="text-xs text-muted truncate">@{u.username}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-16">
                  <span className={`badge text-xs ${
                    u.role === 'admin_client' ? 'badge-blue' : 'badge-gray'
                  }`}>
                    {u.role?.toUpperCase()}
                  </span>
                  <div className={`status-dot ${u.is_active ? 'bg-green' : 'bg-red'}`}></div>
                </div>

                <button 
                  className="btn btn-ghost btn-sm w-full border-color" 
                  onClick={() => handleImpersonate(u)}
                  disabled={!u.is_active}
                >
                  Masuk Sebagai <ArrowRight size={14} className="ml-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .hover-shadow:hover { 
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); 
        }
        .status-dot { width: 8px; height: 8px; borderRadius: 50% }
      `}</style>
    </div>
  )
}
