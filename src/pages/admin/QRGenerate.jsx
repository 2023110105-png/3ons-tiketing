import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getParticipants, getCurrentDay } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { FileDown, Download, QrCode, Share2, MessageCircle, X } from 'lucide-react'
import { getWhatsAppShareLink } from '../../utils/whatsapp'

const CATEGORY_STYLES = {
  VIP: { accent: '#c62828', soft: '#fdecea', label: 'VIP' },
  Dealer: { accent: '#1565c0', soft: '#e8f1ff', label: 'DEALER' },
  Media: { accent: '#f9a825', soft: '#fff8e1', label: 'MEDIA' },
  Regular: { accent: '#2e7d32', soft: '#eaf7ee', label: 'REGULAR' }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

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

  const buildTicketQrImage = async (participant, options = {}) => {
    const width = options.width || 900
    const height = options.height || 540
    const qrSize = options.qrSize || 320
    const style = CATEGORY_STYLES[participant.category] || CATEGORY_STYLES.Regular

    const qrDataUrl = await QRCode.toDataURL(participant.qr_data, {
      width: 640,
      margin: 3,
      color: { dark: '#111111', light: '#FFFFFF' },
      errorCorrectionLevel: 'H'
    })

    const qrImage = await loadImage(qrDataUrl)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // Background
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#fffdf8')
    bg.addColorStop(1, '#f6f9ff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // Outer border
    ctx.strokeStyle = '#d8dce7'
    ctx.lineWidth = 4
    ctx.strokeRect(12, 12, width - 24, height - 24)

    // Accent top strip
    ctx.fillStyle = style.accent
    ctx.fillRect(12, 12, width - 24, 18)

    // Left info panel
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(42, 56, width - qrSize - 110, height - 96)
    ctx.strokeStyle = '#edf0f6'
    ctx.lineWidth = 2
    ctx.strokeRect(42, 56, width - qrSize - 110, height - 96)

    // QR panel
    const qrX = width - qrSize - 58
    const qrY = 100
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32)
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 4
    ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32)
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

    // Header texts
    ctx.fillStyle = '#0f172a'
    ctx.font = '700 42px "Arial"'
    ctx.fillText('E-TICKET', 64, 118)

    ctx.fillStyle = '#475569'
    ctx.font = '600 22px "Arial"'
    ctx.fillText('3oNs Digital Event Pass', 64, 150)

    // Category badge
    ctx.fillStyle = style.soft
    ctx.fillRect(64, 176, 190, 44)
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 2
    ctx.strokeRect(64, 176, 190, 44)
    ctx.fillStyle = style.accent
    ctx.font = '700 20px "Arial"'
    ctx.fillText(style.label, 86, 205)

    // Participant details
    ctx.fillStyle = '#0f172a'
    ctx.font = '700 30px "Arial"'
    const safeName = String(participant.name || '-').slice(0, 28)
    ctx.fillText(safeName, 64, 270)

    ctx.fillStyle = '#334155'
    ctx.font = '600 20px "Arial"'
    ctx.fillText(`ID Tiket : ${participant.ticket_id}`, 64, 318)
    ctx.fillText(`Hari      : ${participant.day_number}`, 64, 352)

    // Footer note
    ctx.fillStyle = '#64748b'
    ctx.font = '500 17px "Arial"'
    ctx.fillText('Tunjukkan tiket ini saat registrasi. Simpan baik-baik dan jangan dibagikan.', 64, 426)

    // Scan note
    ctx.fillStyle = '#475569'
    ctx.font = '600 16px "Arial"'
    ctx.fillText('Scan QR di pintu masuk', qrX + 44, qrY + qrSize + 42)

    return canvas.toDataURL('image/png', 1)
  }

  const generateQR = async (participant) => {
    setSelectedParticipant(participant)
    try {
      const url = await buildTicketQrImage(participant, { width: 900, height: 540, qrSize: 280 })
      setQrUrl(url)
    } catch {
      toast.error('Error', 'Gagal generate QR Code')
    }
  }

  const downloadQR = async (participant) => {
    try {
      const url = await buildTicketQrImage(participant, { width: 1200, height: 720, qrSize: 360 })
      const link = document.createElement('a')
      link.download = `Tiket_${participant.ticket_id}_${participant.name.replace(/\s+/g, '_')}.png`
      link.href = url
      link.click()
    } catch {
      toast.error('Error', 'Gagal download tiket')
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
        const url = await buildTicketQrImage(participant, { width: 1200, height: 720, qrSize: 360 })
        const blob = await (await fetch(url)).blob()
        const file = new File([blob], `Tiket_${participant.ticket_id}.png`, { type: 'image/png' })

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
      const cardWidth = 86
      const cardHeight = 52
      const gapX = 6
      const gapY = 8
      const cols = 2
      let col = 0, row = 0

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i]
        if (row > 0 && margin + (row + 1) * cardHeight + row * gapY > 280) {
          doc.addPage(); row = 0; col = 0
        }
        const x = margin + col * (cardWidth + gapX)
        const y = margin + row * (cardHeight + gapY)

        const ticketImage = await buildTicketQrImage(p, {
          width: 900,
          height: 540,
          qrSize: 260
        })

        doc.addImage(ticketImage, 'PNG', x, y, cardWidth, cardHeight)
        col++
        if (col >= cols) { col = 0; row++ }
        setGeneratedCount(i + 1)
      }
      doc.save(`QR_Tickets_Hari_${dayFilter}.pdf`)
      toast.success('PDF Berhasil', `${participants.length} tiket desain diexport ke PDF`)
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
            <><FileDown size={16} /> Download Semua Tiket (PDF)</>
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
                title="Download tiket"
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
        <h1>Generate Tiket QR</h1>
        <p>Buat tiket QR dengan desain siap kirim dan siap cetak</p>
      </div>

      <div className="qr-toolbar">
        <select className="form-select qr-toolbar-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
          <option value={1}>Hari 1 ({getParticipants(1).length} peserta)</option>
          <option value={2}>Hari 2 ({getParticipants(2).length} peserta)</option>
        </select>
        <button className="btn btn-primary" onClick={generateAllQR} disabled={generating}>
          {generating ? (<><span className="spinner qr-spinner-sm"></span> Generating {generatedCount}/{participants.length}...</>) : (<><FileDown size={16} /> Download Semua Tiket (PDF)</>)}
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
                  <Download size={14} /> Download Tiket
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
              <p>Klik nama peserta di sebelah kiri untuk preview desain tiket QR</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
