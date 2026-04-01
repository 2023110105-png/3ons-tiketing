import { useState, useEffect, useRef } from 'react'
import { getParticipants, addParticipant, deleteParticipant, bulkAddParticipants, getCurrentDay, getWaTemplate, getAvailableDays } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { UserPlus, Search, Trash2, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Download, MessageCircle, Bot, Zap } from 'lucide-react'
import { getWhatsAppShareLink } from '../../utils/whatsapp'

export default function Participants() {
  const currentDay = getCurrentDay()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const [dayFilter, setDayFilter] = useState(currentDay)
  const [availableDays, setAvailableDays] = useState(getAvailableDays())
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [newParticipant, setNewParticipant] = useState({ name: '', phone: '', email: '', category: 'Regular', day_number: currentDay, auto_send: false })
  
  // Broadcast States
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  
  const toast = useToast()
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const refreshData = () => {
    setAvailableDays(getAvailableDays())
    let data = getParticipants(dayFilter)
    if (search) {
      data = data.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.ticket_id.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (categoryFilter !== 'all') data = data.filter(p => p.category === categoryFilter)
    if (statusFilter !== 'all') {
      if (statusFilter === 'checked') data = data.filter(p => p.is_checked_in)
      else data = data.filter(p => !p.is_checked_in)
    }
    setParticipants(data)
  }

  useEffect(() => { refreshData() }, [search, dayFilter, categoryFilter, statusFilter])

  const handleAdd = (e) => {
    e.preventDefault()
    if (!newParticipant.name.trim()) return
    const safeDay = Number(newParticipant.day_number)
    if (!Number.isInteger(safeDay) || safeDay < 1) {
      toast.error('Hari tidak valid', 'Nomor hari minimal 1')
      return
    }

    const p = addParticipant({ ...newParticipant, day_number: safeDay, actor: user })
    if (newParticipant.auto_send) {
      toast.success('Peserta ditambahkan', `${p.name} - Sedang dikirim via Bot...`)
    } else {
      toast.success('Peserta ditambahkan', `${p.name} (${p.ticket_id})`)
    }
    setNewParticipant({ name: '', phone: '', email: '', category: 'Regular', day_number: dayFilter, auto_send: false })
    setShowModal(false)
    refreshData()
  }

  // --- BOT BROADCAST FEATURES ---
  const sendTicketViaBot = async (participant) => {
    if (!participant.phone && !participant.email) return false;
    
    const template = getWaTemplate();
    const wa_message = template
      .replace(/\{\{nama\}\}/g, participant.name || '')
      .replace(/\{\{tiket\}\}/g, participant.ticket_id || '')
      .replace(/\{\{hari\}\}/g, participant.day_number || '')
      .replace(/\{\{kategori\}\}/g, participant.category || '');

    try {
      await fetch('http://localhost:3001/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...participant,
          send_wa: !!participant.phone,
          send_email: !!participant.email,
          wa_message
        })
      });
      return true;
    } catch (e) {
      console.error('Bot Server Offline:', e);
      return false;
    }
  }

  const handleSingleBotSend = async (participant) => {
    toast.info('Mengirim...', `Meneruskan tiket ${participant.name} ke Bot`);
    const success = await sendTicketViaBot(participant);
    if (success) toast.success('Terkirim!', `Tiket masuk antrean Bot WA untuk ${participant.name}`);
    else toast.error('Gagal', 'Bot Server sedang offline.');
  }

  const handleBroadcast = async () => {
    const targetParticipants = participants; // They can filter first, then broadcast the current view
    if (targetParticipants.length === 0) return toast.error('Kosong', 'Tidak ada peserta untuk dibroadcast');
    
    if (!window.confirm(`Perhatian!\nAnda akan membroadcast pesan tiket otomatis ke ${targetParticipants.length} peserta.\nPastikan ponsel WA server sudah "Connected" dan internet stabil.\nLanjutkan?`)) return;

    setIsBroadcasting(true);
    setBroadcastProgress({ current: 0, total: targetParticipants.length, success: 0, failed: 0 });

    let s = 0; let f = 0;
    
    for (let i = 0; i < targetParticipants.length; i++) {
      setBroadcastProgress(prev => ({ ...prev, current: i + 1 }));
      const success = await sendTicketViaBot(targetParticipants[i]);
      if (success) s++; else f++;
      
      // Artificial delay 2.5 seconds to prevent WA Ban
      if (i < targetParticipants.length - 1) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    setBroadcastProgress(prev => ({ ...prev, success: s, failed: f }));
    toast.success('Broadcast Selesai', `Terkirim: ${s}, Gagal: ${f}`);
    setTimeout(() => setIsBroadcasting(false), 3000);
  }



  const handleDelete = (p) => {
    if (confirm(`Hapus peserta ${p.name}?`)) {
      const reason = window.prompt('Masukkan alasan penghapusan peserta (wajib):', '')
      if (reason === null) return
      if (!String(reason).trim()) {
        toast.error('Alasan wajib', 'Isi alasan penghapusan terlebih dahulu')
        return
      }
      if (String(reason).trim().length < 15) {
        toast.error('Alasan terlalu pendek', 'Alasan minimal 15 karakter')
        return
      }

      const approval = window.prompt('Konfirmasi kedua: ketik SETUJU untuk melanjutkan', '')
      if (approval === null) return
      if (approval !== 'SETUJU') {
        toast.error('Dibatalkan', 'Konfirmasi kedua harus SETUJU')
        return
      }

      const result = deleteParticipant(p.id, user, reason)
      if (!result?.success) {
        toast.error('Gagal menghapus', result?.error || 'Validasi alasan gagal')
        return
      }
      toast.error('Peserta dihapus', p.name)
      refreshData()
    }
  }

  const getRowDayValue = (row) => row.day_number ?? row.day ?? row.hari ?? row.Hari ?? row.Day ?? row.Day_Number

  const validateImportRows = (rows) => {
    const invalidDayRows = []
    rows.forEach((row, index) => {
      const dayValue = getRowDayValue(row)
      if (dayValue === undefined || dayValue === null || String(dayValue).trim() === '') return
      const parsed = Number(dayValue)
      if (!Number.isInteger(parsed) || parsed < 1) {
        invalidDayRows.push({ row: index + 1, value: dayValue })
      }
    })
    return { invalidDayRows }
  }

  // ===== IMPORT EXCEL =====
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet)

      if (rows.length === 0) {
        toast.error('File kosong', 'Tidak ada data di file Excel')
        return
      }

      const { invalidDayRows } = validateImportRows(rows)

      setImportPreview({
        fileName: file.name,
        rows: rows,
        columns: Object.keys(rows[0]),
        preview: rows.slice(0, 5),
        invalidDayRows
      })

      if (invalidDayRows.length > 0) {
        toast.info('Cek kolom hari', `${invalidDayRows.length} baris memiliki nilai hari tidak valid dan akan pakai hari default (${dayFilter})`)
      }

      setShowImportModal(true)
    } catch (err) {
      toast.error('Gagal baca file', 'Pastikan format file Excel (.xlsx/.csv) valid')
      console.error(err)
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const confirmImport = () => {
    if (!importPreview) return
    if (importPreview.invalidDayRows?.length > 0) {
      toast.error('Import diblokir', 'Perbaiki nilai hari yang tidak valid terlebih dahulu')
      return
    }
    const result = bulkAddParticipants(importPreview.rows, dayFilter, user)
    setImportResult(result)
    toast.success('Import berhasil', `${result.added.length} peserta ditambahkan`)
    if (importPreview.invalidDayRows?.length > 0) {
      toast.info('Hari default digunakan', `${importPreview.invalidDayRows.length} baris memakai hari default (${dayFilter}) karena nilai hari tidak valid`)
    }
    refreshData()
  }

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx')
      const templateData = [
        { nama: 'Budi Santoso', telepon: '081234567890', kategori: 'Dealer', hari: 1 },
        { nama: 'Citra Dewi', telepon: '089876543210', kategori: 'VIP', hari: 2 },
        { nama: 'Dian Pratama', telepon: '08111222333', kategori: 'Regular', hari: 3 },
        { nama: 'Eko Wahyudi', telepon: '082233445566', kategori: 'Media', hari: 1 },
        { nama: 'Fajar Nugraha', telepon: '081998877665', kategori: 'Regular', hari: 2 },
        { nama: 'Gita Pertiwi', telepon: '083811223344', kategori: 'VIP', hari: 3 },
        { nama: 'Hendra Saputra', telepon: '085700112233', kategori: 'Dealer', hari: 4 },
        { nama: 'Intan Maharani', telepon: '082122334455', kategori: 'Media', hari: 5 }
      ]
      
      const ws = XLSX.utils.json_to_sheet(templateData)
      const guideData = [
        { kolom: 'nama', wajib: 'Ya', keterangan: 'Nama lengkap peserta', contoh: 'Budi Santoso' },
        { kolom: 'telepon', wajib: 'Tidak', keterangan: 'Nomor WA peserta', contoh: '081234567890' },
        { kolom: 'kategori', wajib: 'Tidak', keterangan: 'Kategori peserta: Regular/VIP/Dealer/Media', contoh: 'VIP' },
        { kolom: 'hari', wajib: 'Tidak', keterangan: 'Hari tiket (angka, minimal 1). Jika kosong, pakai hari default filter', contoh: '2' }
      ]
      const wsGuide = XLSX.utils.json_to_sheet(guideData)
      
      // Auto-size columns to make them neat
      const wscols = [
        { wch: 25 }, // nama
        { wch: 15 }, // telepon
        { wch: 15 }, // kategori
        { wch: 10 }  // hari
      ]
      ws['!cols'] = wscols
      wsGuide['!cols'] = [
        { wch: 16 }, // kolom
        { wch: 8 },  // wajib
        { wch: 64 }, // keterangan
        { wch: 26 }  // contoh
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Template Peserta")
      XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan")
      
      XLSX.writeFile(wb, "Template_Peserta_3ONS_Dengan_Hari.xlsx")
    } catch (err) {
      toast.error('Gagal', 'Gagal membuat file template Excel')
      console.error(err)
    }
  }

  const allParticipants = getParticipants(dayFilter)
  const checkedCount = allParticipants.filter(p => p.is_checked_in).length
  const hasInvalidImportDayRows = !!importPreview?.invalidDayRows?.length

  const getCategoryBadge = (cat) => {
    const map = { VIP: 'badge-red', Dealer: 'badge-blue', Media: 'badge-yellow', Regular: 'badge-gray' }
    return map[cat] || 'badge-gray'
  }

  // Hidden file input
  const FileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      onChange={handleFileUpload}
      style={{ display: 'none' }}
    />
  )

  // Import Modal Component
  const ImportModal = () => {
    if (!showImportModal) return null

    return (
      <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null) }}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
          <div className="modal-header">
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={18} /> Import Peserta
            </h3>
            <button className="modal-close" onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null) }}><X size={14} /></button>
          </div>
          <div className="modal-body">
            {importResult ? (
              // Results view
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--success)', marginBottom: 12 }}>
                  <CheckCircle size={48} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
                  Import Selesai!
                </h3>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{importResult.added.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Berhasil</div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>{importResult.errors.length}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gagal</div>
                    </div>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div style={{ textAlign: 'left', background: 'var(--danger-bg)', padding: 12, borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                    {importResult.errors.map((err, i) => (
                      <div key={i} style={{ color: 'var(--danger)' }}>
                        <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Baris {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : importPreview ? (
              // Preview view
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                  <FileSpreadsheet size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{importPreview.fileName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{importPreview.rows.length} baris data</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Kolom terdeteksi: {importPreview.columns.join(', ')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Hari default import saat ini: <strong>Hari {dayFilter}</strong> (dipakai jika kolom hari/day/day_number kosong)
                </div>
                {importPreview.invalidDayRows?.length > 0 && (
                  <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 10, fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      Ditemukan {importPreview.invalidDayRows.length} baris dengan nilai hari tidak valid.
                    </div>
                    <div>
                      Contoh baris: {importPreview.invalidDayRows.slice(0, 5).map(item => `${item.row} (${item.value})`).join(', ')}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Preview (5 baris pertama):</div>
                <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {importPreview.columns.slice(0, 4).map(col => (
                          <th key={col} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.preview.map((row, i) => (
                        <tr key={i}>
                          {importPreview.columns.slice(0, 4).map(col => (
                            <td key={col} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[col] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Kolom yang didukung: <strong>nama/name</strong>, <strong>telepon/phone</strong>, <strong>kategori/category</strong>, <strong>hari/day/day_number</strong> (VIP/Dealer/Media/Regular)
                </p>
              </>
            ) : null}
          </div>
          <div className="modal-footer">
            {importResult ? (
              <button className="btn btn-primary" onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null) }} style={{ flex: 1 }}>Selesai</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportPreview(null) }}>Batal</button>
                <button
                  className="btn btn-primary"
                  onClick={confirmImport}
                  disabled={hasInvalidImportDayRows}
                  title={hasInvalidImportDayRows ? 'Perbaiki nilai hari yang tidak valid sebelum import' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    opacity: hasInvalidImportDayRows ? 0.6 : 1,
                    cursor: hasInvalidImportDayRows ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Upload size={14} /> {hasInvalidImportDayRows ? 'Perbaiki Hari Dulu' : `Import ${importPreview?.rows.length} Peserta`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ===== MOBILE PARTICIPANTS =====
  if (isMobile) {
    return (
      <div className="page-container">
        <FileInput />
        <ImportModal />

        <div className="m-section-header" style={{ marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>Peserta</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checkedCount}/{allParticipants.length} hadir</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <UserPlus size={14} /> Tambah
          </button>
        </div>

        {/* Import & Template Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px' }}
          >
            <Upload size={14} /> Import Excel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBroadcast}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', background: '#25D366', borderColor: '#25D366' }}
          >
            <Zap size={14} /> Broadcast
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={downloadTemplate}
            style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', border: '1px dashed var(--border-color)' }}
          >
            <Download size={14} /> Template Excel
          </button>
        </div>

        {/* Mobile Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Cari nama atau ticket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36 }}
          />
        </div>

        <div className="m-filter-chips">
          <select className="m-filter-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
            {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
          </select>
          <select className="m-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">Semua</option>
            <option value="VIP">VIP</option>
            <option value="Dealer">Dealer</option>
            <option value="Media">Media</option>
            <option value="Regular">Regular</option>
          </select>
          <select className="m-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Semua</option>
            <option value="checked">✓ Hadir</option>
            <option value="unchecked">✗ Belum</option>
          </select>
        </div>

        {/* Mobile Card List */}
        <div className="m-card-list">
          {participants.length === 0 ? (
            <div className="m-empty">
              <span><Search size={28} /></span>
              <p>Tidak ada data ditemukan</p>
            </div>
          ) : (
            participants.map(p => (
              <div key={p.id} className="m-participant-card">
                <div className="m-p-avatar" style={{
                  background: p.is_checked_in ? 'var(--success)' : 'var(--bg-elevated)'
                }}>
                  {p.is_checked_in ? <CheckCircle size={16} /> : p.name.charAt(0)}
                </div>
                <div className="m-p-info">
                  <div className="m-p-name">{p.name}</div>
                  <div className="m-p-meta">
                    <span className={`badge ${getCategoryBadge(p.category)}`}>{p.category}</span>
                    <span className="m-p-ticket">{p.ticket_id}</span>
                  </div>
                  {p.checked_in_at && (
                    <div className="m-p-time">
                      Check-in {new Date(p.checked_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="m-p-delete" onClick={() => handleSingleBotSend(p)} style={{ color: 'var(--brand-blue)' }} title="Kirim via Bot">
                    <Bot size={16} />
                  </button>
                  <a href={getWhatsAppShareLink(p)} target="_blank" rel="noopener noreferrer" className="m-p-delete" style={{ color: '#25D366' }} title="Kirim WA">
                    <MessageCircle size={16} />
                  </a>
                  <button className="m-p-delete" onClick={() => handleDelete(p)} title="Hapus">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '12px 0', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {participants.length} dari {allParticipants.length} peserta
        </div>

        {isBroadcasting && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal" style={{ textAlign: 'center', padding: 30, maxWidth: 300 }}>
              <Bot size={44} style={{ display: 'block', color: '#25D366', margin: '0 auto 16px', animation: 'bounce 1s infinite' }} />
              <h3 style={{ marginBottom: 8, fontSize: '1.2rem' }}>Mengirim Pesan...</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>Mohon jangan tutup halaman ini.</p>
              
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, height: 10, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ 
                  background: '#25D366', height: '100%', 
                  width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                {broadcastProgress.current} / {broadcastProgress.total} Tiket
              </div>
              {(broadcastProgress.success > 0 || broadcastProgress.failed > 0) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>
                  <span style={{ color: 'var(--success)' }}>Sukses: {broadcastProgress.success}</span> • <span style={{ color: 'var(--danger)' }}>Gagal: {broadcastProgress.failed}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Tambah Peserta</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}><X size={14} /></button>
              </div>
              <form onSubmit={handleAdd}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Nama</label><input className="form-input" placeholder="Nama lengkap" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} required autoFocus /></div>
                  <div className="form-group"><label className="form-label">Telepon (WA)</label><input className="form-input" placeholder="08xxx (untuk WA)" value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@contoh.com" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Hari Tiket</label><input className="form-input" type="number" min="1" placeholder="Contoh: 1" value={newParticipant.day_number} onChange={e => setNewParticipant({ ...newParticipant, day_number: Number(e.target.value) || '' })} required /></div>
                  <div className="form-group"><label className="form-label">Kategori</label><select className="form-select" value={newParticipant.category} onChange={e => setNewParticipant({ ...newParticipant, category: e.target.value })}><option value="Regular">Regular</option><option value="VIP">VIP</option><option value="Dealer">Dealer</option><option value="Media">Media</option></select></div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input type="checkbox" id="m-auto-send" checked={newParticipant.auto_send} onChange={e => setNewParticipant({ ...newParticipant, auto_send: e.target.checked })} style={{ accentColor: 'var(--brand-primary)', width: 16, height: 16 }} />
                    <label htmlFor="m-auto-send" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Otomatis Kirim WA / Email (Bot Server)</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Tambah</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== DESKTOP PARTICIPANTS =====
  return (
    <div className="page-container">
      <FileInput />
      <ImportModal />

      <div className="page-header">
        <h1>Kelola Peserta</h1>
        <p>{allParticipants.length} peserta terdaftar, {checkedCount} sudah check-in</p>
      </div>

      <div className="participants-toolbar">
        <div className="search-bar participants-search">
          <span className="search-bar-icon"><Search size={16} /></span>
          <input placeholder="Cari nama atau ID tiket..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select select-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          <option value="Regular">Regular</option>
          <option value="VIP">VIP</option>
          <option value="Dealer">Dealer</option>
          <option value="Media">Media</option>
        </select>
        <select className="form-select select-sm" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
          {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
        </select>
        <select className="form-select select-md" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="checked">Sudah Check-in</option>
          <option value="unchecked">Belum Hadir</option>
        </select>
        <button className="btn btn-secondary btn-inline-icon" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Import Excel
        </button>
        <button className="btn btn-whatsapp btn-inline-icon" onClick={handleBroadcast}>
          <Zap size={14} /> Broadcast WA
        </button>
        <button className="btn btn-ghost btn-sm btn-inline-icon" onClick={downloadTemplate} title="Download template Excel">
          <Download size={14} /> Template Excel
        </button>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><UserPlus size={14} /> Tambah Peserta</button>
      </div>

      <div className="table-container animate-fade-in-up">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>Ticket ID</th><th>Nama</th><th>Telepon</th><th>Kategori</th><th>Status</th><th>Check-in</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state empty-pad-lg"><div className="empty-state-icon"><Search size={32} /></div><h3>Tidak ada data</h3><p>Coba ubah filter</p></div></td></tr>
            ) : participants.map((p, i) => (
              <tr key={p.id}>
                <td className="td-muted">{i + 1}</td>
                <td><code style={{ background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, border: '1px solid var(--border-color)' }}>{p.ticket_id}</code></td>
                <td className="td-strong">{p.name}</td>
                <td className="td-secondary">{p.phone}</td>
                <td><span className={`badge ${getCategoryBadge(p.category)}`}>{p.category}</span></td>
                <td>{p.is_checked_in ? <span className="badge badge-green"><CheckCircle size={10} /> Check-in</span> : <span className="badge badge-gray">Belum</span>}</td>
                <td className="td-time-muted">{p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString('id-ID') : '—'}</td>
                <td className="actions-cell">
                  <button className="btn btn-ghost btn-blue btn-sm" onClick={() => handleSingleBotSend(p)} title="Kirim Otomatis (Bot)">
                    <Bot size={14} />
                  </button>
                  <a href={getWhatsAppShareLink(p)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-whatsapp btn-sm" title="Kirim Manual (WA Web)">
                    <MessageCircle size={14} />
                  </a>
                  <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDelete(p)} title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="summary-muted">
        Menampilkan {participants.length} dari {allParticipants.length} peserta
      </div>

      {isBroadcasting && (
        <div className="modal-overlay">
          <div className="modal" style={{ textAlign: 'center', padding: 40, maxWidth: 400 }}>
            <Bot size={48} style={{ color: '#25D366', margin: '0 auto 16px', animation: 'bounce 1s infinite' }} />
            <h2 style={{ marginBottom: 8 }}>Mengirim Pesan...</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Mohon jangan tutup halaman ini.</p>
            
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 20, height: 12, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ 
                background: '#25D366', height: '100%', 
                width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {broadcastProgress.current} / {broadcastProgress.total} Tiket
            </div>
            {(broadcastProgress.success > 0 || broadcastProgress.failed > 0) && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                <span style={{ color: 'var(--success)' }}>Sukses: {broadcastProgress.success}</span> • <span style={{ color: 'var(--danger)' }}>Gagal: {broadcastProgress.failed}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah Peserta Baru</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nama Peserta</label><input className="form-input" placeholder="Masukkan nama lengkap" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} required autoFocus /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Nomor WhatsApp</label><input className="form-input" placeholder="08xxxxxxxxxx" value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" placeholder="email@contoh.com" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Hari Tiket</label><input className="form-input" type="number" min="1" placeholder="Contoh: 1" value={newParticipant.day_number} onChange={e => setNewParticipant({ ...newParticipant, day_number: Number(e.target.value) || '' })} required /></div>
                <div className="form-group"><label className="form-label">Kategori</label><select className="form-select" value={newParticipant.category} onChange={e => setNewParticipant({ ...newParticipant, category: e.target.value })}><option value="Regular">Regular</option><option value="VIP">VIP</option><option value="Dealer">Dealer</option><option value="Media">Media</option></select></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <input type="checkbox" id="d-auto-send" checked={newParticipant.auto_send} onChange={e => setNewParticipant({ ...newParticipant, auto_send: e.target.checked })} style={{ accentColor: 'var(--success)', width: 18, height: 18 }} />
                  <div>
                    <label htmlFor="d-auto-send" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'block' }}>Kirim Tiket Otomatis via Bot</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bot lokal akan mengirim WA/Email di background secara langsung</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">Tambah Peserta</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
