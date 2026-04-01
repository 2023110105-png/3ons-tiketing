import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getParticipants, getCurrentDay } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { FileDown, Download, QrCode, Share2, MessageCircle, X } from 'lucide-react'
import { getWhatsAppShareLink } from '../../utils/whatsapp'

export default function QRGenerate() {
  const currentDay = getCurrentDay()
  const [dayFilter, setDayFilter] = useState(currentDay)
  const [participants, setParticipants] = useState([])
  const [selectedParticipant, setSelectedParticipant] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const toast = useToast()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    setParticipants(getParticipants(dayFilter))
  }, [dayFilter])

  const getCategoryToneClass = (category) => {
    if (category === 'VIP') return 'm-p-avatar-vip'
    if (category === 'Dealer') return 'm-p-avatar-dealer'
    if (category === 'Media') return 'm-p-avatar-media'
    return 'm-p-avatar-regular'
  }

  const generateQR = async (participant) => {
    setSelectedParticipant(participant)
    try {
      const url = await QRCode.toDataURL(participant.qr_data, {
        width: 300, margin: 2,
        color: { dark: '#1A1A1A', light: '#FFFFFF' },
        errorCorrectionLevel: 'H'
      })
      setQrUrl(url)
    } catch {
      toast.error('Error', 'Gagal generate QR Code')
    }
  }

  const downloadQR = async (participant) => {
    try {
      const url = await QRCode.toDataURL(participant.qr_data, {
        width: 400, margin: 2,
        color: { dark: '#1A1A1A', light: '#FFFFFF' },
        errorCorrectionLevel: 'H'
      })
      const link = document.createElement('a')
      link.download = `QR_${participant.ticket_id}_${participant.name.replace(/\s+/g, '_')}.png`
      link.href = url
      link.click()
    } catch {
      toast.error('Error', 'Gagal download QR')
    }
  }

  // Share QR via WhatsApp
  const shareViaWhatsApp = async (participant) => {
    const message = `🎫 *E-Ticket*\n\n` +
      `Halo *${participant.name}*,\n` +
      `Berikut informasi tiket Anda:\n\n` +
      `📋 Ticket ID: *${participant.ticket_id}*\n` +
      `📂 Kategori: *${participant.category}*\n` +
      `📅 Hari: *${participant.day_number}*\n\n` +
      `Silakan tunjukkan QR Code ini saat registrasi di venue.\n` +
      `Terima kasih!\n\n` +
      `_Event Platform_`

    // Try Web Share API first (works on mobile, can share files)
    if (navigator.share) {
      try {
        const url = await QRCode.toDataURL(participant.qr_data, {
          width: 400, margin: 2,
          color: { dark: '#1A1A1A', light: '#FFFFFF' },
          errorCorrectionLevel: 'H'
        })
        const blob = await (await fetch(url)).blob()
        const file = new File([blob], `QR_${participant.ticket_id}.png`, { type: 'image/png' })

        await navigator.share({
          title: `E-Ticket ${participant.name}`,
          text: message,
          files: [file]
        })
        toast.success('Shared!', 'QR berhasil dibagikan')
        return
      } catch (e) {
        // User cancelled or share failed, fallback to wa.me
        if (e.name === 'AbortError') return
      }
    }

    // Fallback: open WhatsApp with text message + public QR URL
    const waUrl = getWhatsAppShareLink(participant)
    window.open(waUrl, '_blank')
    toast.success('WhatsApp', 'Membuka WhatsApp...')
  }

  const generateAllQR = async () => {
    if (participants.length === 0) {
      toast.error('Tidak ada data', 'Tidak ada peserta untuk digenerate QR')
      return
    }

    setGenerating(true)
    setGeneratedCount(0)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15
      const qrSize = 40
      const colWidth = (pageWidth - 2 * margin) / 3
      const rowHeight = 60
      let col = 0, row = 0

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i]
        if (row > 0 && row * rowHeight + margin > 260) {
          doc.addPage(); row = 0; col = 0
        }
        const x = margin + col * colWidth
        const y = margin + row * rowHeight
        const qrDataUrl = await QRCode.toDataURL(p.qr_data, {
          width: 200, margin: 1,
          color: { dark: '#1A1A1A', light: '#FFFFFF' },
          errorCorrectionLevel: 'H'
        })
        doc.addImage(qrDataUrl, 'PNG', x + (colWidth - qrSize) / 2, y, qrSize, qrSize)
        doc.setFontSize(8)
        doc.setFont(undefined, 'bold')
        doc.text(p.name, x + colWidth / 2, y + qrSize + 5, { align: 'center' })
        doc.setFont(undefined, 'normal')
        doc.setFontSize(7)
        doc.text(p.ticket_id + ' | ' + p.category, x + colWidth / 2, y + qrSize + 10, { align: 'center' })
        col++
        if (col >= 3) { col = 0; row++ }
        setGeneratedCount(i + 1)
      }
      doc.save(`QR_Tickets_Hari_${dayFilter}.pdf`)
      toast.success('PDF Berhasil', `${participants.length} QR tiket diexport ke PDF`)
    } catch (err) {
      toast.error('Error', 'Gagal generate PDF')
      console.error(err)
    }
    setGenerating(false)
  }

  const generationProgress = participants.length > 0
    ? Math.round((generatedCount / participants.length) * 100)
    : 0

  // ===== MOBILE QR GENERATE =====
  if (isMobile) {
    return (
      <div className="page-container">
        <div className="m-section-header qr-mobile-header">
          <div>
            <h1 className="qr-mobile-title">QR Code</h1>
            <p className="qr-mobile-subtitle">{participants.length} peserta</p>
          </div>
          <select className="m-filter-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
            <option value={1}>Hari 1</option>
            <option value={2}>Hari 2</option>
          </select>
        </div>

        {/* Download All Button */}
        <button
          className="btn btn-primary qr-mobile-download-btn"
          onClick={generateAllQR}
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="spinner qr-spinner-sm"></span>
              {' '}Generating {generatedCount}/{participants.length}...
            </>
          ) : (
            <><FileDown size={16} /> Download Semua QR (PDF)</>
          )}
        </button>

        {generating && (
          <div className="qr-mobile-progress-wrap">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${generationProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* Participant List - Full Width */}
        <div className="m-card-list">
          {participants.map(p => (
            <div key={p.id} className="m-participant-card" onClick={() => generateQR(p)}>
              <div className={`m-p-avatar ${getCategoryToneClass(p.category)}`}>
                {p.name.charAt(0)}
              </div>
              <div className="m-p-info">
                <div className="m-p-name">{p.name}</div>
                <div className="m-p-meta">
                  <span className={`badge badge-${p.category === 'VIP' ? 'red' : p.category === 'Dealer' ? 'blue' : p.category === 'Media' ? 'yellow' : 'gray'}`}>
                    {p.category}
                  </span>
                  <span className="m-p-ticket">{p.ticket_id}</span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm qr-icon-btn qr-whatsapp-btn"
                onClick={(e) => { e.stopPropagation(); shareViaWhatsApp(p) }}
                title="Share via WhatsApp"
              >
                <MessageCircle size={16} />
              </button>
              <button
                className="btn btn-ghost btn-sm qr-icon-btn"
                onClick={(e) => { e.stopPropagation(); downloadQR(p) }}
              >
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* QR Preview Modal - Bottom Sheet */}
        {selectedParticipant && (
          <div className="modal-overlay" onClick={() => setSelectedParticipant(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">QR Code</h3>
                <button className="modal-close" onClick={() => setSelectedParticipant(null)}>✕</button>
              </div>
              <div className="modal-body qr-modal-body">
                <div className="qr-preview-card qr-preview-card-sm">
                  {qrUrl && <img src={qrUrl} alt="QR Code" className="qr-image-sm" />}
                </div>
                <h3 className="qr-modal-name">
                  {selectedParticipant.name}
                </h3>
                <p className="qr-modal-meta">
                  {selectedParticipant.ticket_id} · {selectedParticipant.category}
                </p>
              </div>
              <div className="modal-footer qr-modal-footer">
                <button className="btn btn-primary qr-modal-action" onClick={() => downloadQR(selectedParticipant)}>
                  <Download size={16} /> Download
                </button>
                <button
                  className="btn btn-secondary qr-modal-action qr-modal-wa-btn"
                  onClick={() => shareViaWhatsApp(selectedParticipant)}
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== DESKTOP QR GENERATE =====
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Generate QR Code</h1>
        <p>Generate dan download QR Code tiket peserta</p>
      </div>

      <div className="qr-toolbar">
        <select className="form-select qr-toolbar-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
          <option value={1}>Hari 1 ({getParticipants(1).length} peserta)</option>
          <option value={2}>Hari 2 ({getParticipants(2).length} peserta)</option>
        </select>
        <button className="btn btn-primary" onClick={generateAllQR} disabled={generating}>
          {generating ? (<><span className="spinner qr-spinner-sm"></span> Generating {generatedCount}/{participants.length}...</>) : (<><FileDown size={16} /> Download Semua QR (PDF)</>)}
        </button>
        {generating && (<div className="qr-toolbar-progress"><div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${generationProgress}%` }}></div></div></div>)}
      </div>

      <div className="grid-2">
        <div className="card qr-list-card">
          <div className="card-header">
            <h3 className="card-title">Daftar Peserta Hari {dayFilter}</h3>
            <span className="badge badge-red">{participants.length}</span>
          </div>
          <div className="qr-list">
            {participants.map(p => (
              <div key={p.id} onClick={() => generateQR(p)} className={`qr-list-item ${selectedParticipant?.id === p.id ? 'is-selected' : ''}`}>
                <div>
                  <div className="qr-list-name">{p.name}</div>
                  <div className="qr-list-meta">{p.ticket_id} · {p.category}</div>
                </div>
                <div className="qr-list-actions">
                  <button className="btn btn-ghost btn-whatsapp btn-sm" onClick={(e) => { e.stopPropagation(); shareViaWhatsApp(p) }}><MessageCircle size={14} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); downloadQR(p) }}><Download size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card qr-preview-shell">
          {selectedParticipant ? (
            <div className="animate-scale-in qr-preview-content">
              <div className="qr-preview-card">
                {qrUrl && <img src={qrUrl} alt="QR Code" className="qr-image-lg" />}
              </div>
              <h3 className="qr-preview-title">{selectedParticipant.name}</h3>
              <p className="qr-preview-subtitle">{selectedParticipant.ticket_id} · {selectedParticipant.category} · Hari {selectedParticipant.day_number}</p>
              <div className="qr-preview-actions">
                <button className="btn btn-primary" onClick={() => downloadQR(selectedParticipant)}>
                  <Download size={14} /> Download QR
                </button>
                <button
                  className="btn btn-secondary qr-preview-wa-btn"
                  onClick={() => shareViaWhatsApp(selectedParticipant)}
                >
                  <MessageCircle size={14} /> Share via WA
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><QrCode size={40} /></div>
              <h3>Pilih Peserta</h3>
              <p>Klik nama peserta di sebelah kiri untuk preview QR Code</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
