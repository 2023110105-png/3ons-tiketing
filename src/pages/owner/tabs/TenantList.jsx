// Komponen TenantList dinonaktifkan sementara (fokus ke tenant only, owner diputus)
export default function TenantList() {
  return null;
}
          <div key={tenant.id} className="owner-card-container" style={{ opacity: tenant.isExpired ? 0.75 : 1 }}>
            <div className="owner-card-header">
              <div style={{ flex: 1 }}>
                <div className="owner-card-title">
                  {tenant.id === activeTenantId && <span style={{ color: 'var(--brand-primary)', fontSize: '0.8rem' }}>●</span>}
                  {getTenantDisplayName(tenant)}
                </div>
                <p style={{ marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tenant.eventName}</p>
              </div>
              <div className={`owner-status-badge ${tenant.isExpired ? 'expired' : (tenant.status === 'active' ? 'active' : 'inactive')}`}>
                {tenant.isExpired ? '⚠ Kedaluwarsa' : (tenant.status === 'active' ? '✓ Aktif' : '○ Nonaktif')}
              </div>
            </div>
            
            <div className="owner-card-body">
              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Paket</span>
                  <span className="badge badge-blue">{tenant.contract?.package?.toUpperCase() || 'STARTER'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pembayaran</span>
                  <span className={`badge ${tenant.contract?.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                    {tenant.contract?.payment_status === 'paid' ? 'LUNAS' : tenant.contract?.payment_status === 'overdue' ? 'TERLAMBAT' : 'BELUM LUNAS'}
                  </span>
                </div>
              </div>
              
              {tenant.expires_at && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {tenant.isExpired ? (
                    <span style={{ color: 'var(--danger)' }}>Kedaluwarsa: {new Date(tenant.expires_at).toLocaleDateString('id-ID')}</span>
                  ) : (
                    <span>Aktif sampai: {new Date(tenant.expires_at).toLocaleDateString('id-ID')}</span>
                  )}
                </div>
              )}
            </div>

            <div className="owner-card-footer">
              {tenant.id !== activeTenantId && tenant.status === 'active' && !tenant.isExpired && (
                <button className="owner-action-btn" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)' }} onClick={() => handleActivate(tenant)}>
                  Pakai
                </button>
              )}
              <button className="owner-action-btn" title="Kelola Pengguna" onClick={() => onManageUsers(tenant)}>
                <Users size={14} />
              </button>
              <button className="owner-action-btn" title="Kelola Kontrak" onClick={() => onEditContract(tenant)}>
                <FileEdit size={14} />
              </button>
              <button 
                className="owner-action-btn success"
                onClick={() => handleToggleStatus(tenant)}
                title={tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
              >
                <Smartphone size={14} />
              </button>
              {tenant.id !== 'tenant-default' && (
                <button className="owner-action-btn danger" onClick={() => handleDelete(tenant)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {visibleTenants.length === 0 && (
        <div className="owner-empty-state">
          <div className="owner-empty-icon">🔍</div>
          <div className="owner-empty-title">Tidak ada akun brand</div>
          <div className="owner-empty-message">Coba cari dengan kata lain atau buat akun brand baru</div>
        </div>
      )}

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
