// Komponen TenantList dinonaktifkan sementara (fokus ke tenant only, owner diputus)
export default function TenantList() {
  return null;
}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="owner-modal card">
            <div className="owner-modal-header">
              <div className="owner-modal-title">
                <Plus size={20} /> Tambah Akun Brand Baru
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
                    name="brandName"
                    required 
                    value={newTenant.brandName}
                    onChange={e => setNewTenant({...newTenant, brandName: e.target.value})}
                    placeholder="Contoh: Acme Corp" 
                  />
                </div>
                <div className="owner-form-group">
                  <label className="owner-form-label">Nama Event</label>
                  <input 
                    className="owner-form-input" 
                    name="eventName"
                    value={newTenant.eventName}
                    onChange={e => setNewTenant({...newTenant, eventName: e.target.value})}
                    placeholder="Contoh: Tech Expo 2026" 
                  />
                </div>
                <div className="owner-form-group">
                  <label className="owner-form-label">Tanggal Kedaluwarsa (Opsional)</label>
                  <input 
                    className="owner-form-input" 
                    name="expiresAt"
                    type="date"
                    value={newTenant.expiresAt}
                    onChange={e => setNewTenant({...newTenant, expiresAt: e.target.value})}
                  />
                </div>
              </form>
            </div>
            
            <div className="owner-modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Batal</button>
              <button onClick={handleCreate} className="btn btn-primary">Simpan Akun Brand</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
