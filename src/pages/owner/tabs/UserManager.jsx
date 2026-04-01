import { useState, useMemo, useEffect } from 'react'
import { 
  Users, UserPlus, Key, Trash2, ShieldCheck, 
  Search, ShieldAlert, ArrowLeft, Check, X 
} from 'lucide-react'
import { 
  getTenants, getTenantUsers, createTenantUser, 
  updateTenantUser, deleteTenantUser 
} from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function UserManager({ selectedTenant: initialTenant = null }) {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants] = useState(getTenants())
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenant?.id || '')
  const [users, setUsers] = useState([])
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    role: 'gate_front' 
  })

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      if (selectedTenantId) {
        setUsers(getTenantUsers(selectedTenantId))
      } else {
        setUsers([])
      }
    }
    fetchUsers()
  }, [selectedTenantId])

  const handleCreateUser = (e) => {
    e.preventDefault()
    if (!selectedTenantId) return
    
    const result = createTenantUser(selectedTenantId, newUser, currentUser)
    if (result.success) {
      toast.success('Sukses', `User ${newUser.username} berhasil dibuat`)
      setUsers(getTenantUsers(selectedTenantId))
      setShowAddModal(false)
      setNewUser({ username: '', password: '', name: '', role: 'gate_front' })
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const handleToggleStatus = (user) => {
    const result = updateTenantUser(selectedTenantId, user.id, { is_active: !user.is_active }, currentUser)
    if (result.success) {
      setUsers(getTenantUsers(selectedTenantId))
      toast.success('Update', `Status user ${user.username} diperbarui`)
    }
  }

  const handleDeleteUser = (user) => {
    if (window.confirm(`Hapus user ${user.username}?`)) {
      const result = deleteTenantUser(selectedTenantId, user.id, currentUser)
      if (result.success) {
        setUsers(getTenantUsers(selectedTenantId))
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
        <div className="owner-empty-title">Pilih Tenant untuk Mengelola User</div>
        <p className="text-muted mb-24">Setiap tenant dapat memiliki admin client dan petugas gate sendiri.</p>
        <div className="grid-responsive mt-24" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="form-group mb-0">
            <select 
              className="form-select" 
              value={selectedTenantId} 
              onChange={e => setSelectedTenantId(e.target.value)}
            >
              <option value="">-- Pilih Tenant --</option>
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
          <ArrowLeft size={18} /> Kembali ke daftar tenant
        </button>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} /> Tambah User Baru
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="card-pad p-16 bg-subtle border-bottom">
           <div className="flex justify-between items-center flex-wrap gap-12">
              <div>
                <h3 className="card-title">{selectedTenant.brandName}</h3>
                <p className="text-muted text-xs">ID Tenant: {selectedTenant.id}</p>
              </div>
              <div className="admin-search-wrap" style={{ minWidth: '240px', flex: 1 }}>
                <Search size={14} className="admin-search-icon" />
                <input 
                  className="form-input" 
                  placeholder="Cari user..." 
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
                <th>Username</th>
                <th>Nama</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-32 text-muted">Belum ada user untuk tenant ini.</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td><div className="font-bold">{u.username}</div></td>
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
              <h3 className="card-title mb-16">Buat User Tenant Baru</h3>
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    className="form-input" 
                    required 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    placeholder="Contoh: admin_yamaha" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password Awal</label>
                  <input 
                    className="form-input" 
                    type="password"
                    required 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Minimal 6 karakter" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nama Lengkap</label>
                  <input 
                    className="form-input" 
                    required 
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Contoh: Budi Santoso" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select 
                    className="form-select"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="admin_client">Admin Client (Full Dashboard)</option>
                    <option value="gate_front">Gate Front (Scanner Only)</option>
                    <option value="gate_back">Gate Back (Monitor Only)</option>
                  </select>
                </div>
                
                <div className="bg-subtle p-12 mb-20 rounded" style={{ fontSize: '0.75rem', border: '1px dashed var(--border-color)' }}>
                  <ShieldAlert size={14} className="inline mr-4 text-warning" />
                  <strong>Peringatan!</strong> User petugas gate (Front/Back) hanya akan memiliki akses terbatas ke menu Scan atau Monitor untuk tenant ini.
                </div>

                <div className="actions-right mt-24">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan User</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
