import { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  Users, UserPlus, Key, Trash2, ShieldCheck, 
  Search, ShieldAlert, ArrowLeft, Check, X 
} from 'lucide-react'
import { 
  getTenants, getTenantUsers, createTenantUser, 
  updateTenantUser, deleteTenantUser, bootstrapStoreFromFirebase
} from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/useAuth'

const OWNER_USER_SELECTED_TENANT_KEY = 'ons_owner_users_selected_tenant'

function loadSelectedTenantId(initialTenant) {
  if (initialTenant?.id) return initialTenant.id
  try {
    return window.sessionStorage.getItem(OWNER_USER_SELECTED_TENANT_KEY) || ''
  } catch {
    return ''
  }
}

export default function UserManager({ selectedTenant: initialTenant = null }) {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants, setTenants] = useState(getTenants())
  const [selectedTenantId, setSelectedTenantId] = useState(() => loadSelectedTenantId(initialTenant))
  const [users, setUsers] = useState([])
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({ 
    username: '', 
    email: '',
    password: '', 
    name: '', 
    role: 'gate_front' 
  })

  const [searchQuery, setSearchQuery] = useState('')

  const runFirebaseHydrate = useCallback(async () => {
    if (typeof bootstrapStoreFromFirebase !== 'function') return
    try {
      await bootstrapStoreFromFirebase(true)
    } catch {
      // Keep owner UI responsive when Firebase hydrate is unavailable.
    }
  }, [])

  const refreshTenantData = useCallback(async (tenantId = selectedTenantId, forceFirebase = true) => {
    if (forceFirebase) {
      await runFirebaseHydrate()
    }
    const nextTenants = getTenants()
    setTenants(nextTenants)
    if (tenantId) {
      setUsers(getTenantUsers(tenantId))
    } else {
      setUsers([])
    }
  }, [runFirebaseHydrate, selectedTenantId])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshTenantData(selectedTenantId, true)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [selectedTenantId, refreshTenantData])

  useEffect(() => {
    try {
      if (selectedTenantId) {
        window.sessionStorage.setItem(OWNER_USER_SELECTED_TENANT_KEY, selectedTenantId)
      } else {
        window.sessionStorage.removeItem(OWNER_USER_SELECTED_TENANT_KEY)
      }
    } catch {
      // Ignore storage failures.
    }
  }, [selectedTenantId])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!selectedTenantId) return
    
    const result = await createTenantUser(selectedTenantId, newUser, currentUser)
    if (result.success) {
      toast.success('Sukses', `User ${newUser.username} berhasil dibuat`)
      await refreshTenantData(selectedTenantId, true)
      setShowAddModal(false)
      setNewUser({ username: '', email: '', password: '', name: '', role: 'gate_front' })
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const handleToggleStatus = async (user) => {
    const result = updateTenantUser(selectedTenantId, user.id, { is_active: !user.is_active }, currentUser)
    if (result.success) {
      await refreshTenantData(selectedTenantId, true)
      toast.success('Update', `Status user ${user.username} diperbarui`)
    }
  }

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Hapus user ${user.username}?`)) {
      const result = deleteTenantUser(selectedTenantId, user.id, currentUser)
      if (result.success) {
        await refreshTenantData(selectedTenantId, true)
        toast.success('Dihapus', `User ${user.username} berhasil dihapus`)
      }
    }
  }

  const handleResetPassword = (user) => {
    const newPass = window.prompt(`Masukkan password baru untuk ${user.username}:`, '123456')
    if (newPass === null) return
    
    const result = updateTenantUser(selectedTenantId, user.id, { password: newPass }, currentUser)
    if (result.success) {
      toast.success('Sukses', `Password ${user.username} berhasil direset`)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return users.filter(u => 
      !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  const selectedTenant = tenants.find(t => t.id === selectedTenantId)

  if (!selectedTenantId) {
    return (
      <div className="owner-empty-state owner-fade-in-up" style={{ padding: '64px 24px' }}>
        <div className="owner-empty-icon">👥</div>
        <div className="owner-empty-title">Pilih Akun Brand untuk Mengelola Pengguna</div>
        <p className="text-muted mb-24">Setiap akun brand dapat memiliki admin acara dan petugas pintu sendiri.</p>
        <div className="grid-responsive mt-24" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="form-group mb-0">
            <select 
              className="form-select" 
              name="selectedTenant"
              value={selectedTenantId} 
              onChange={e => setSelectedTenantId(e.target.value)}
            >
              <option value="">-- Pilih Akun Brand --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.brandName} ({t.eventName})</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="user-manager-container owner-fade-in-up">
      <div className="owner-toolbar">
        <button className="btn btn-ghost p-0" onClick={() => setSelectedTenantId('')}>
          <ArrowLeft size={18} /> Kembali ke daftar akun
        </button>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} /> Tambah Pengguna Baru
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="card-pad p-16 bg-subtle border-bottom">
           <div className="flex justify-between items-center flex-wrap gap-12">
              <div>
                <h3 className="card-title">{selectedTenant.brandName}</h3>
                <p className="text-muted text-xs">ID Akun: {selectedTenant.id}</p>
              </div>
              <div className="admin-search-wrap" style={{ minWidth: '240px', flex: 1 }}>
                <Search size={14} className="admin-search-icon" />
                <input 
                  className="form-input" 
                  name="searchUser"
                  placeholder="Cari pengguna..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
           </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Pengguna</th>
                <th>Email Login</th>
                <th>Nama</th>
                <th>Peran</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-32 text-muted">Belum ada pengguna untuk akun ini.</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td><div className="font-bold">{u.username}</div></td>
                    <td className="text-muted text-xs">{u.email || '-'}</td>
                    <td>{u.name}</td>
                    <td>
                      <span className={`badge ${
                        u.role === 'admin_client' ? 'badge-blue' : 
                        u.role === 'gate_front' ? 'badge-green' : 'badge-yellow'
                      }`}>
                        {u.role?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" title="Reset Password" onClick={() => handleResetPassword(u)}>
                          <Key size={14} />
                        </button>
                        <button 
                          className={`btn btn-ghost btn-sm ${u.is_active ? 'btn-warning' : 'badge-green text-green'}`} 
                          title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.is_active ? <X size={14} /> : <Check size={14} />}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-danger" title="Hapus User" onClick={() => handleDeleteUser(u)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '450px' }}>
            <div className="card-pad">
              <h3 className="card-title mb-16">Buat Pengguna Baru</h3>
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label htmlFor="new-user-username" className="form-label">Username</label>
                  <input 
                    id="new-user-username"
                    name="username"
                    className="form-input" 
                    required 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    placeholder="Contoh: admin_acme" 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-email" className="form-label">Email Login (opsional)</label>
                  <input
                    id="new-user-email"
                    name="email"
                    className="form-input"
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    placeholder="contoh: admin.client@brand.com"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-password" className="form-label">Password Awal</label>
                  <input 
                    id="new-user-password"
                    name="password"
                    className="form-input" 
                    type="password"
                    required 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Minimal 6 karakter" 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-name" className="form-label">Nama Lengkap</label>
                  <input 
                    id="new-user-name"
                    name="fullName"
                    className="form-input" 
                    required 
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Contoh: Budi Santoso" 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-role" className="form-label">Peran</label>
                  <select 
                    id="new-user-role"
                    name="role"
                    className="form-select"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="admin_client">Admin Acara (Akses Penuh)</option>
                    <option value="gate_front">Petugas Pintu Depan (Pindai Saja)</option>
                    <option value="gate_back">Petugas Pintu Belakang (Pantau Saja)</option>
                  </select>
                </div>
                
                <div className="bg-subtle p-12 mb-20 rounded" style={{ fontSize: '0.75rem', border: '1px dashed var(--border-color)' }}>
                  <ShieldAlert size={14} className="inline mr-4 text-warning" />
                  <strong>Peringatan!</strong> Petugas pintu hanya akan memiliki akses terbatas ke menu Pindai atau Pantau untuk akun ini.
                </div>

                <div className="actions-right mt-24">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Pengguna</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
