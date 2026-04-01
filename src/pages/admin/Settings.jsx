import { useState } from 'react'
import { resetCheckIns, deleteAllParticipants, getCurrentDay, getWaTemplate, setWaTemplate, getMaxPendingAttempts, setMaxPendingAttempts, getEventsWithOptions, getCurrentEventId, renameEvent, archiveEvent, deleteEvent } from '../../store/mockData'
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
  const [events, setEvents] = useState(getEventsWithOptions({ includeArchived: true }))
  const [activeEventId, setActiveEventId] = useState(getCurrentEventId())

  const refreshEvents = () => {
    setEvents(getEventsWithOptions({ includeArchived: true }))
    setActiveEventId(getCurrentEventId())
  }


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

  const handleRenameEvent = (event) => {
    const nextName = window.prompt('Nama event baru:', event.name)
    if (nextName === null) return
    const res = renameEvent(event.id, nextName, user)
    if (!res.success) return toast.error('Gagal', res.error || 'Gagal rename event')
    refreshEvents()
    toast.success('Sukses', 'Nama event berhasil diperbarui')
  }

  const handleArchiveEvent = (event) => {
    const confirmWord = window.prompt(`Arsipkan event "${event.name}"? Ketik SETUJU`, '')
    if (confirmWord === null) return
    if (confirmWord !== 'SETUJU') return toast.error('Gagal', 'Konfirmasi harus SETUJU')
    const reason = window.prompt('Alasan arsip event (minimal 15 karakter):', '')
    if (reason === null) return
    const res = archiveEvent(event.id, user, reason)
    if (!res.success) return toast.error('Gagal', res.error || 'Gagal arsip event')
    refreshEvents()
    toast.success('Sukses', 'Event berhasil diarsipkan')
  }

  const handleDeleteEvent = (event) => {
    const confirmWord = window.prompt(`Hapus event "${event.name}" permanen? Ketik HAPUS`, '')
    if (confirmWord === null) return
    if (confirmWord !== 'HAPUS') return toast.error('Gagal', 'Konfirmasi harus HAPUS')
    const reason = window.prompt('Alasan hapus event (minimal 15 karakter):', '')
    if (reason === null) return
    const res = deleteEvent(event.id, user, reason)
    if (!res.success) return toast.error('Gagal', res.error || 'Gagal hapus event')
    refreshEvents()
    toast.success('Sukses', 'Event berhasil dihapus')
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Pengaturan Sistem</h1>
        <p>Kelola data dan konfigurasi aplikasi</p>
      </div>

      <div className="settings-wrap">
        {/* BOT TEMPLATE EDITOR */}
        <div className="card card-pad">
          <h3 className="card-title mb-16 card-title-inline">
            Teks Pesan WhatsApp Bot
          </h3>
          <p className="text-note">
            Ubah teks yang akan dikirim secara otomatis ke peserta. Gunakan "Kata Sakti" di bawah ini agar sistem bisa mengubahnya menjadi data asli peserta:
            <br />
            <code className="token-code">{'{{nama}}'}</code>
            <code className="token-code ml-8">{'{{tiket}}'}</code>
            <code className="token-code ml-8">{'{{hari}}'}</code>
            <code className="token-code ml-8">{'{{kategori}}'}</code>
          </p>

          <form onSubmit={handleSaveTemplate}>
            <div className="form-group">
              <textarea 
                className="form-input mono-input"
                rows="8"
                value={waTemplate}
                onChange={e => setWaTemplateState(e.target.value)}
                required
              ></textarea>
            </div>
            <div className="actions-right">
              <button type="submit" className="btn btn-primary">Simpan Teks WhatsApp</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Pengaturan Offline Queue</h3>
          <p className="text-note">
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
            <div className="actions-right">
              <button type="submit" className="btn btn-primary">Simpan Pengaturan Offline</button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 className="card-title mb-16">Manajemen Event</h3>
          <p className="text-note">
            Kelola nama event, arsipkan event lama, atau hapus event yang tidak dipakai.
          </p>

          <div className="event-list">
            {events.map(event => (
              <div key={event.id} className="event-item">
                <div className="event-row">
                  <div>
                    <div className="event-name">{event.name}</div>
                    <div className="event-meta">
                      {event.id === activeEventId ? 'Event Aktif' : 'Nonaktif'} {event.isArchived ? '• Archived' : ''}
                    </div>
                  </div>
                  <div className="event-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRenameEvent(event)}>Rename</button>
                    {!event.isArchived && event.id !== activeEventId && (
                      <button className="btn btn-ghost btn-warning btn-sm" onClick={() => handleArchiveEvent(event)}>Archive</button>
                    )}
                    {event.id !== activeEventId && (
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDeleteEvent(event)}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="card danger-card">
          <h3 className="card-title mb-16 card-title-inline danger-title">
            <ShieldAlert size={20} /> Danger Zone (Zona Berbahaya)
          </h3>
          <p className="text-note" style={{ marginBottom: 24 }}>
            Aksi di bawah ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda melakukan ini hanya untuk <strong>persiapan hari-H</strong> atau setelah event selesai.
          </p>

          <div className="danger-list">
            {/* Reset Checkin Item */}
            <div className="danger-item split">
              <div>
                <div className="danger-item-title">Reset Status Check-in</div>
                <div className="danger-item-desc">Mengembalikan semua status peserta menjadi "Belum Hadir". Nama peserta akan tetap ada.</div>
              </div>
              <button className="btn btn-secondary btn-warning btn-shrink" onClick={() => setShowResetModal(true)}>
                <RotateCcw size={14} className="mr-6" /> Reset
              </button>
            </div>

            {/* Delete All Item */}
            <div className="danger-item">
              <div>
                <div className="danger-item-title">Hapus Semua Peserta</div>
                <div className="danger-item-desc">Menghapus <strong>seluruh database peserta</strong> dan riwayat check-in. Sistem akan kosong.</div>
              </div>
              <button className="btn btn-danger btn-shrink" onClick={() => setShowDeleteModal(true)}>
                <Trash2 size={14} className="mr-6" /> Hapus Semua
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
              <h3 className="modal-title card-title-inline modal-title-warning">
                <AlertCircle size={18} /> Konfirmasi Reset Status
              </h3>
              <button className="modal-close" onClick={() => { setShowResetModal(false); setResetInput(''); setResetApprovalInput(''); setResetReason('') }}>✕</button>
            </div>
            <form onSubmit={handleResetCheckIn}>
              <div className="modal-body">
                <p className="modal-text">
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
                <button type="submit" className="btn btn-primary btn-warning">Reset Check-in</button>
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
              <h3 className="modal-title card-title-inline modal-title-danger">
                <AlertCircle size={18} /> Konfirmasi Hapus Database
              </h3>
              <button className="modal-close" onClick={() => { setShowDeleteModal(false); setDeleteInput(''); setDeleteApprovalInput(''); setDeleteReason('') }}>✕</button>
            </div>
            <form onSubmit={handleDeleteAll}>
              <div className="modal-body">
                <p className="modal-text">
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
                <button type="submit" className="btn btn-danger">Hapus Semua Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
