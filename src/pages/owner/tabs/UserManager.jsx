// Komponen UserManager dinonaktifkan sementara (fokus ke tenant only, owner diputus)
export default function UserManager() {
  return null;
}
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
