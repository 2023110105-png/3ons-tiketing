// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getCurrentDay() { return 1; }
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { useToast } from '../../contexts/ToastContext'
import { FileDown, Download, QrCode, ShieldCheck, MessageCircle, X, Upload } from 'lucide-react'
import { getWhatsAppShareLink, generateWaMessage } from '../../utils/whatsapp'
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'
import BarcodeImport from './BarcodeImport'

const CATEGORY_STYLES = {
  VIP: { accent: '#b91c1c', soft: '#fdecea', dark: '#7f1d1d', label: 'VIP' },
  Dealer: { accent: '#1d4ed8', soft: '#e8f1ff', dark: '#1e3a8a', label: 'DEALER' },
  Media: { accent: '#ca8a04', soft: '#fff8e1', dark: '#854d0e', label: 'MEDIA' },
  Regular: { accent: '#15803d', soft: '#eaf7ee', dark: '#14532d', label: 'REGULAR' }
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
  const [regeneratingSecure, setRegeneratingSecure] = useState(false)
  const [activeTab, setActiveTab] = useState('generate') // 'generate' atau 'import'
  const toast = useToast()
  const isMobile = useIsMobileLayout()
  const [ticketBranding, setTicketBranding] = useState(getTenantBranding())
  const [activeEventName, setActiveEventName] = useState(getCurrentEventName())

  useEffect(() => {
    const refreshBranding = () => {
      setTicketBranding(getTenantBranding())
      setActiveEventName(getCurrentEventName())
    }

    window.addEventListener('ons-tenant-changed', refreshBranding)
    window.addEventListener('focus', refreshBranding)

    return () => {
      window.removeEventListener('ons-tenant-changed', refreshBranding)
      window.removeEventListener('focus', refreshBranding)
    }
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
    const eventLabel = String(
      (activeEventName && activeEventName !== '-') ? activeEventName : (ticketBranding.eventName || 'Event')
    ).trim()
    const brandLabel = String(ticketBranding.brandName || '3oNs Digital').trim()

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

    const drawClampText = (text, x, y, maxWidth) => {
      const value = String(text || '')
      if (ctx.measureText(value).width <= maxWidth) {
        ctx.fillText(value, x, y)
        return
      }

      let clipped = value
      while (clipped.length > 0 && ctx.measureText(`${clipped}...`).width > maxWidth) {
        clipped = clipped.slice(0, -1)
      }
      ctx.fillText(`${clipped}...`, x, y)
    }

    const normalizeMetaKey = (s) => String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')

    const getMetaValue = (p, wantedLabel) => {
      const meta = p?.meta && typeof p.meta === 'object' ? p.meta : {}
      const target = normalizeMetaKey(wantedLabel)
      const foundKey = Object.keys(meta).find(k => normalizeMetaKey(k) === target)
      if (!foundKey) return ''
      const v = meta[foundKey]
      return v === undefined || v === null ? '' : String(v)
    }

    const radius = Math.round(Math.min(width, height) * 0.035)
    const pad = 22
    const safeX = pad
    const safeY = pad
    const safeW = width - pad * 2
    const safeH = height - pad * 2

    const roundedRectPath = (x, y, w, h, r) => {
      const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
      ctx.beginPath()
      ctx.moveTo(x + rr, y)
      ctx.arcTo(x + w, y, x + w, y + h, rr)
      ctx.arcTo(x + w, y + h, x, y + h, rr)
      ctx.arcTo(x, y + h, x, y, rr)
      ctx.arcTo(x, y, x + w, y, rr)
      ctx.closePath()
    }

    const fillRoundedRect = (x, y, w, h, r, fillStyle) => {
      roundedRectPath(x, y, w, h, r)
      ctx.fillStyle = fillStyle
      ctx.fill()
    }

    const strokeRoundedRect = (x, y, w, h, r, strokeStyle, lineWidth = 1) => {
      roundedRectPath(x, y, w, h, r)
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }

    // Latar belakang (kertas halus)
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#fffefb')
    bg.addColorStop(1, '#f7fbff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // Shadow + body tiket
    ctx.save()
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
    ctx.shadowBlur = 28
    ctx.shadowOffsetY = 12
    fillRoundedRect(safeX, safeY, safeW, safeH, radius, '#ffffff')
    ctx.restore()

    // Border tiket
    strokeRoundedRect(safeX, safeY, safeW, safeH, radius, '#dfe6ef', 2)
    strokeRoundedRect(safeX + 10, safeY + 10, safeW - 20, safeH - 20, Math.max(10, radius - 8), '#eef2f7', 1)

    // Aksen atas (gradient biar lebih “brand”)
    const topH = 18
    const topGrad = ctx.createLinearGradient(safeX, safeY, safeX + safeW, safeY)
    topGrad.addColorStop(0, style.accent)
    topGrad.addColorStop(0.55, '#4da6e8')
    topGrad.addColorStop(1, '#e84393')
    fillRoundedRect(safeX, safeY, safeW, topH + 6, radius, topGrad)

    // Dekorasi pita kanan
    ctx.fillStyle = `${style.accent}1f`
    ctx.beginPath()
    ctx.moveTo(safeX + safeW - 190, safeY + 14)
    ctx.lineTo(safeX + safeW - 10, safeY + 14)
    ctx.lineTo(safeX + safeW - 10, safeY + 92)
    ctx.closePath()
    ctx.fill()

    const qrX = safeX + safeW - qrSize - 56
    const qrY = safeY + 88
    const leftX = safeX + 20
    const leftY = safeY + 34
    const leftW = qrX - leftX - 18
    const leftH = safeY + safeH - leftY - 20

    // Panel informasi kiri
    fillRoundedRect(leftX, leftY, leftW, leftH, Math.max(14, radius - 10), '#ffffff')
    strokeRoundedRect(leftX, leftY, leftW, leftH, Math.max(14, radius - 10), '#edf0f6', 2)

    // Panel QR
    fillRoundedRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18, '#ffffff')
    strokeRoundedRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18, style.accent, 4)
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

    // Perforation line
    const perfX = qrX - 32
    ctx.save()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.setLineDash([2, 8])
    ctx.beginPath()
    ctx.moveTo(perfX, safeY + 56)
    ctx.lineTo(perfX, safeY + safeH - 28)
    ctx.stroke()
    ctx.restore()

    // Watermark brand halus
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.fillStyle = style.accent
    ctx.font = '900 90px "Arial"'
    ctx.translate(leftX + 40, safeY + safeH - 80)
    ctx.rotate(-0.12)
    ctx.fillText(String(brandLabel || '3oNs').toUpperCase(), 0, 0)
    ctx.restore()

    // Teks header
    ctx.fillStyle = '#0f172a'
    ctx.font = '900 40px "Arial"'
    ctx.fillText('E-TICKET', leftX + 22, leftY + 74)

    ctx.fillStyle = '#475569'
    ctx.font = '700 19px "Arial"'
    drawClampText(eventLabel || 'Event Pass', leftX + 22, leftY + 104, leftW - 44)

    // Identitas header
    ctx.fillStyle = '#64748b'
    ctx.font = '800 12px "Arial"'
    drawClampText((brandLabel || '3oNs Digital').toUpperCase(), leftX + 22, leftY + 126, leftW - 44)

    // Lencana kategori
    fillRoundedRect(leftX + 22, leftY + 140, 176, 42, 14, style.soft)
    strokeRoundedRect(leftX + 22, leftY + 140, 176, 42, 14, style.accent, 2)
    ctx.fillStyle = style.dark
    ctx.font = '900 18px "Arial"'
    drawClampText(String(participant.category || style.label || '-'), leftX + 42, leftY + 168, 150)

    // Participant details
    ctx.fillStyle = '#0f172a'
    ctx.font = '900 30px "Arial"'
    drawClampText(participant.name || '-', leftX + 22, leftY + 238, leftW - 44)

    ctx.fillStyle = '#64748b'
    ctx.font = '700 14px "Arial"'
    ctx.fillText('ID TIKET', leftX + 22, leftY + 282)
    ctx.fillText('HARI', leftX + 22, leftY + 332)
    ctx.fillText('KATEGORI', leftX + 22, leftY + 382)

    ctx.fillStyle = '#1e293b'
    ctx.font = '900 24px "Arial"'
    ctx.fillText(String(participant.ticket_id || '-'), leftX + 22, leftY + 308)
    ctx.font = '900 22px "Arial"'
    ctx.fillText(String(participant.day_number || '-'), leftX + 22, leftY + 358)
    ctx.font = '900 22px "Arial"'
    drawClampText(String(participant.category || style.label || '-'), leftX + 22, leftY + 408, leftW - 44)

    // Divider before notes
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(leftX + 22, leftY + leftH - 94)
    ctx.lineTo(leftX + leftW - 22, leftY + leftH - 94)
    ctx.stroke()

    // Footer notes
    ctx.fillStyle = '#334155'
    ctx.font = '700 14px "Arial"'
    ctx.fillText('Valid untuk 1 orang. Dilarang duplikasi tiket.', leftX + 22, leftY + leftH - 64)
    ctx.fillStyle = '#64748b'
    ctx.font = '600 13px "Arial"'
    const tl = getMetaValue(participant, 'Tanggal Lahir')
    ctx.fillText(tl ? `Tanggal Lahir: ${tl}` : 'Tunjukkan tiket ini saat registrasi di pintu masuk.', leftX + 22, leftY + leftH - 42)

    // Scan note
    ctx.fillStyle = '#1e293b'
    ctx.font = '800 14px "Arial"'
    ctx.fillText('Scan QR di pintu masuk', qrX + 24, qrY + qrSize + 44)
    ctx.fillStyle = '#64748b'
    ctx.font = '700 12px "Arial"'
    ctx.fillText('Jaga layar tetap terang untuk scan cepat', qrX + 24, qrY + qrSize + 64)

    return canvas.toDataURL('image/png', 1)
  }

  const generateQR = async (participant) => {
    setSelectedParticipant(participant)
    try {
      const url = await buildTicketQrImage(participant, { width: 900, height: 540, qrSize: 280 })
      setQrUrl(url)
    } catch {
      toast.error('Gagal', 'Tidak bisa membuat QR tiket')
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
      toast.error('Gagal', 'Tidak bisa mengunduh tiket')
    }
  }

  // Share QR via WhatsApp
  const shareViaWhatsApp = async (participant) => {
    const eventLabel = String(
      (activeEventName && activeEventName !== '-') ? activeEventName : (ticketBranding.eventName || 'Event')
    ).trim()
    const base = generateWaMessage(participant)
    const message = `${base}\n\nSilakan tunjukkan QR ini saat registrasi di lokasi acara.\nTerima kasih!\n\n_${eventLabel || 'Event Platform'}_`

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
        toast.success('Berhasil', 'QR tiket berhasil dibagikan')
        return
      } catch (e) {
        // User cancelled or share failed, fallback to wa.me
        if (e.name === 'AbortError') return
      }
    }

    // Fallback: open WhatsApp with text message + public QR URL
    const waUrl = getWhatsAppShareLink(participant)
    window.open(waUrl, '_blank')
    toast.success('WhatsApp', 'Membuka WhatsApp')
  }

  const generateAllQR = async () => {
    if (participants.length === 0) {
      toast.error('Tidak ada data', 'Tidak ada peserta untuk dibuatkan QR')
      return
    }

    setGenerating(true)
    setGeneratedCount(0)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')
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
      toast.success('PDF Berhasil', `${participants.length} desain tiket berhasil disimpan ke PDF`)
    } catch (err) {
      toast.error('Gagal', 'Tidak bisa membuat PDF')
      console.error(err)
    }
    setGenerating(false)
  }

  const regenerateSecureQrForDay = () => {
    if (regeneratingSecure) return
    setRegeneratingSecure(true)

    try {
      const result = regenerateSecureQRTokens(dayFilter, 'admin')
      const refreshed = getParticipants(dayFilter)
      setParticipants(refreshed)

      if (selectedParticipant) {
        const latest = refreshed.find(p => p.id === selectedParticipant.id)
        if (latest) {
          setSelectedParticipant(latest)
          void generateQR(latest)
        }
      }

      if (result.updated > 0) {
        toast.success('QR Aman Diperbarui', `${result.updated} tiket hari ${dayFilter} sudah diperbarui ke keamanan terbaru`) 
      } else {
        toast.success('Sudah Aman', `Semua tiket hari ${dayFilter} sudah menggunakan mode keamanan terbaru`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal', 'Tidak berhasil memperbarui keamanan QR')
    }

    setRegeneratingSecure(false)
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
            <span className="m-mobile-kicker">Tiket</span>
            <h1 className="qr-mobile-title">QR & unduhan</h1>
            <p className="qr-mobile-subtitle">{participants.length} peserta · hari {dayFilter}</p>
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
          disabled={generating || regeneratingSecure}
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

        <button
          className="btn btn-secondary qr-mobile-download-btn"
          onClick={regenerateSecureQrForDay}
          disabled={regeneratingSecure || generating}
          title="Upgrade tiket lama ke QR aman"
        >
          {regeneratingSecure
            ? <><span className="spinner qr-spinner-sm"></span> Upgrade keamanan...</>
            : <><ShieldCheck size={16} /> Upgrade QR Aman (Hari {dayFilter})</>}
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
                  {p.qr_locked && <span className="badge badge-green">Terkirim</span>}
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
        <span className="page-kicker">Tiket</span>
        <h1>Manajemen tiket QR</h1>
        <p>Unduh tiket visual, bagikan ke WhatsApp, atau impor barcode massal. Token aman dapat diperbarui untuk seluruh hari sekaligus.</p>
      </div>

      <div className="qr-page-tabs" role="tablist" aria-label="Mode tiket">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'generate'}
          onClick={() => setActiveTab('generate')}
          className={`qr-page-tab ${activeTab === 'generate' ? 'active' : ''}`}
        >
          <QrCode size={16} /> Generate tiket
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'import'}
          onClick={() => setActiveTab('import')}
          className={`qr-page-tab ${activeTab === 'import' ? 'active' : ''}`}
        >
          <Upload size={16} /> Import barcode
        </button>
      </div>


      {/* ===== GENERATE TAB ===== */}
      {activeTab === 'generate' && (
        <>
          <div className="qr-toolbar">
            <select className="form-select qr-toolbar-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
              <option value={1}>Hari 1 ({getParticipants(1).length} peserta)</option>
              <option value={2}>Hari 2 ({getParticipants(2).length} peserta)</option>
            </select>
            <button className="btn btn-primary" onClick={generateAllQR} disabled={generating}>
              {generating ? (<><span className="spinner qr-spinner-sm"></span> Generating {generatedCount}/{participants.length}...</>) : (<><FileDown size={16} /> Download Semua Tiket (PDF)</>)}
            </button>
            <button className="btn btn-secondary" onClick={regenerateSecureQrForDay} disabled={regeneratingSecure || generating} title="Upgrade tiket lama ke QR aman">
              {regeneratingSecure
                ? (<><span className="spinner qr-spinner-sm"></span> Upgrade keamanan...</>)
                : (<><ShieldCheck size={16} /> Upgrade QR Aman (Hari {dayFilter})</>)}
            </button>
            {generating && (<div className="qr-toolbar-progress"><div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${generationProgress}%` }}></div></div></div>)}
          </div>
          <div className="m-empty-subtle" style={{ marginBottom: 14 }}>
            Tiket yang sudah terkirim via WhatsApp otomatis dikunci agar QR tetap sama dengan yang diterima peserta.
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
                      <div className="qr-list-meta">
                        {p.ticket_id} · {p.category}
                        {p.qr_locked && (
                          <span className="badge badge-green" style={{ marginLeft: 8, fontSize: '0.66rem' }}>
                            Terkirim
                          </span>
                        )}
                      </div>
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
        </>
      )}

      {/* ===== IMPORT TAB ===== */}
      {activeTab === 'import' && (
        <>
          <BarcodeImport />
        </>
      )}
    </div>
  )
}
