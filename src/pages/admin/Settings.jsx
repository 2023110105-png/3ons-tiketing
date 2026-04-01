import { useState } from 'react'
import { resetCheckIns, deleteAllParticipants, getCurrentDay, getWaTemplate, setWaTemplate, getMaxPendingAttempts, setMaxPendingAttempts } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { AlertCircle, RotateCcw, Trash2, ShieldAlert } from 'lucide-react'

export default function Settings() {
  const currentDay = getCurrentDay()
  const toast = useToast()
  const { user } = useAuth()
  
  // State for Reset Check-in modal
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetInput, setResetInput] = useState('')
  const [resetApprovalInput, setResetApprovalInput] = useState('')
  const [resetReason, setResetReason] = useState('')
  
  // State for Delete All modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteApprovalInput, setDeleteApprovalInput] = useState('')
  const [deleteReason, setDeleteReason] = useState('')

  // State for WA Template
  const [waTemplate, setWaTemplateState] = useState(getWaTemplate())
  const [maxRetryAttempts, setMaxRetryAttemptsState] = useState(getMaxPendingAttempts())


  const handleResetCheckIn = (e) => {
    e.preventDefault()
    if (resetInput !== 'HAPUS') {
      toast.error('Gagal', 'Kata konfirmasi salah')
      return
    }
    if (resetApprovalInput !== 'SETUJU') {
      toast.error('Gagal', 'Konfirmasi kedua harus SETUJU')
      return
    }
    if (!resetReason.trim()) {
      toast.error('Gagal', 'Alasan wajib diisi')
      return
    }
    if (resetReason.trim().length < 15) {
      toast.error('Gagal', 'Alasan minimal 15 karakter')
      return
    }
    
    const result = resetCheckIns(user, resetReason)
    if (!result?.success) {
      toast.error('Gagal', result?.error || 'Validasi alasan gagal')
      return
    }
    toast.success('Sukses', 'Semua riwayat check-in telah dibersihkan.')
    setShowResetModal(false)
    setResetInput('')
    setResetApprovalInput('')
    setResetReason('')
  }

  const handleDeleteAll = (e) => {
    e.preventDefault()
    if (deleteInput !== 'HAPUS') {
      toast.error('Gagal', 'Kata konfirmasi salah')
      return
    }
    if (deleteApprovalInput !== 'SETUJU') {
      toast.error('Gagal', 'Konfirmasi kedua harus SETUJU')
      return
    }
    if (!deleteReason.trim()) {
      toast.error('Gagal', 'Alasan wajib diisi')
      return
    }
    if (deleteReason.trim().length < 15) {
      toast.error('Gagal', 'Alasan minimal 15 karakter')
      return
    }
    
    const result = deleteAllParticipants(user, deleteReason)
    if (!result?.success) {
      toast.error('Gagal', result?.error || 'Validasi alasan gagal')
      return
    }
    toast.success('Sukses', 'Semua data peserta telah dihapus dari sistem.')
    setShowDeleteModal(false)
    setDeleteInput('')
    setDeleteApprovalInput('')
    setDeleteReason('')
  }

  const handleSaveTemplate = (e) => {
    e.preventDefault()
    setWaTemplate(waTemplate, user)
    toast.success('Disimpan', 'Template pesan WhatsApp berhasil diperbarui.')
  }

  const handleSaveOfflineConfig = (e) => {
    e.preventDefault()
    const value = Number(maxRetryAttempts)
    if (!Number.isInteger(value) || value < 1 || value > 20) {
      toast.error('Gagal', 'Batas retry harus angka 1 sampai 20')
      return
    }
    const saved = setMaxPendingAttempts(value, user)
    setMaxRetryAttemptsState(saved)
    toast.success('Disimpan', `Batas retry offline diset ke ${saved}x`) 
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Pengaturan Sistem</h1>
        <p>Kelola data dan konfigurasi aplikasi</p>
      </div>

      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* BOT TEMPLATE EDITOR */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="card-title mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Teks Pesan WhatsApp Bot
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Ubah teks yang akan dikirim secara otomatis ke peserta. Gunakan "Kata Sakti" di bawah ini agar sistem bisa mengubahnya menjadi data asli peserta:
            <br />
            <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{'{{nama}}'}</code>
            <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>{'{{tiket}}'}</code>
            <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>{'{{hari}}'}</code>
            <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>{'{{kategori}}'}</code>
          </p>

          <form onSubmit={handleSaveTemplate}>
            <div className="form-group">
              <textarea 
                className="form-input" 
                rows="8"
                value={waTemplate}
                onChange={e => setWaTemplateState(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.5 }}
                required
              ></textarea>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">Simpan Teks WhatsApp</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="card-title mb-16">Pengaturan Offline Queue</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Atur batas percobaan retry untuk antrean scan offline. Jika melebihi batas, item akan dipurge otomatis dan masuk history post-mortem.
          </p>

          <form onSubmit={handleSaveOfflineConfig}>
            <div className="form-group">
              <label className="form-label">Batas Retry Maksimum (1 - 20)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="20"
                value={maxRetryAttempts}
                onChange={e => setMaxRetryAttemptsState(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">Simpan Pengaturan Offline</button>
            </div>
          </form>
        </div>

        {/* DANGER ZONE */}
        <div className="card" style={{ border: '1px solid var(--danger)', background: 'var(--danger-bg)' }}>
          <h3 className="card-title mb-16" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={20} /> Danger Zone (Zona Berbahaya)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
            Aksi di bawah ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda melakukan ini hanya untuk <strong>persiapan hari-H</strong> atau setelah event selesai.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Reset Checkin Item */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Reset Status Check-in</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mengembalikan semua status peserta menjadi "Belum Hadir". Nama peserta akan tetap ada.</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowResetModal(true)} style={{ color: 'var(--warning)', borderColor: 'var(--warning)', flexShrink: 0 }}>
                <RotateCcw size={14} style={{ marginRight: 6 }} /> Reset
              </button>
            </div>

            {/* Delete All Item */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Hapus Semua Peserta</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Menghapus <strong>seluruh database peserta</strong> dan riwayat check-in. Sistem akan kosong.</div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowDeleteModal(true)} style={{ background: 'var(--danger)', borderColor: 'var(--danger)', flexShrink: 0 }}>
                <Trash2 size={14} style={{ marginRight: 6 }} /> Hapus Semua
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Check-in Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => { setShowResetModal(false); setResetInput(''); setResetApprovalInput(''); setResetReason('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} /> Konfirmasi Reset Status
              </h3>
              <button className="modal-close" onClick={() => { setShowResetModal(false); setResetInput(''); setResetApprovalInput(''); setResetReason('') }}>✕</button>
            </div>
            <form onSubmit={handleResetCheckIn}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', marginBottom: 16 }}>
                  Anda akan mengubah status semua peserta menjadi <strong>Belum Hadir</strong>.
                  Data diri peserta tidak akan dihapus.
                </p>
                <div className="form-group">
                  <label className="form-label">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                  <input 
                    className="form-input" 
                    placeholder="HAPUS"
                    value={resetInput}
                    onChange={(e) => setResetInput(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Konfirmasi kedua: ketik <strong>SETUJU</strong></label>
                  <input
                    className="form-input"
                    placeholder="SETUJU"
                    value={resetApprovalInput}
                    onChange={(e) => setResetApprovalInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Alasan tindakan (wajib)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Contoh: Persiapan simulasi ulang gate sebelum event dimulai"
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}>Reset Check-in</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteInput(''); setDeleteApprovalInput(''); setDeleteReason('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} /> Konfirmasi Hapus Database
              </h3>
              <button className="modal-close" onClick={() => { setShowDeleteModal(false); setDeleteInput(''); setDeleteApprovalInput(''); setDeleteReason('') }}>✕</button>
            </div>
            <form onSubmit={handleDeleteAll}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', marginBottom: 16 }}>
                  Anda akan <strong>menghapus semua peserta</strong> beserta riwayat check-in-nya. Data yang dihapus tidak bisa dikembalikan.
                </p>
                <div className="form-group">
                  <label className="form-label">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                  <input 
                    className="form-input" 
                    placeholder="HAPUS"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Konfirmasi kedua: ketik <strong>SETUJU</strong></label>
                  <input
                    className="form-input"
                    placeholder="SETUJU"
                    value={deleteApprovalInput}
                    onChange={(e) => setDeleteApprovalInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Alasan tindakan (wajib)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Contoh: Event selesai, data dibersihkan sesuai SOP"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>Hapus Semua Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
