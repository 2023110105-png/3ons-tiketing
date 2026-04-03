import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getParticipants, getCurrentDay, getCurrentEventName, getTenantBranding, regenerateSecureQRTokens } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { FileDown, Download, QrCode, ShieldCheck, MessageCircle, X, Upload } from 'lucide-react'
import { getWhatsAppShareLink } from '../../utils/whatsapp'
import { apiFetch } from '../../utils/api'
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
  const [verifyTesting, setVerifyTesting] = useState(false)
  const [verifyReport, setVerifyReport] = useState(null)
  const [activeTab, setActiveTab] = useState('generate') // 'generate' atau 'import'
  const toast = useToast()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [ticketBranding, setTicketBranding] = useState(getTenantBranding())
  const [activeEventName, setActiveEventName] = useState(getCurrentEventName())

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

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

    // Latar belakang
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#fffefb')
    bg.addColorStop(1, '#f8fbff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // Bingkai luar + area aman cetak
    ctx.strokeStyle = '#d8dce7'
    ctx.lineWidth = 3
    ctx.strokeRect(12, 12, width - 24, height - 24)
    ctx.strokeStyle = '#eef2f7'
    ctx.lineWidth = 1
    ctx.strokeRect(24, 24, width - 48, height - 48)

    // Garis aksen atas
    ctx.fillStyle = style.accent
    ctx.fillRect(12, 12, width - 24, 20)

    // Dekorasi pita kanan
    ctx.fillStyle = `${style.accent}20`
    ctx.beginPath()
    ctx.moveTo(width - 190, 32)
    ctx.lineTo(width - 24, 32)
    ctx.lineTo(width - 24, 98)
    ctx.closePath()
    ctx.fill()

    // Panel informasi kiri
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(42, 56, width - qrSize - 110, height - 96)
    ctx.strokeStyle = '#edf0f6'
    ctx.lineWidth = 2
    ctx.strokeRect(42, 56, width - qrSize - 110, height - 96)

    // Panel QR
    const qrX = width - qrSize - 58
    const qrY = 100
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32)
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 4
    ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32)
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

    // Teks header
    ctx.fillStyle = '#0f172a'
    ctx.font = '800 44px "Arial"'
    ctx.fillText('E-TICKET', 64, 114)

    ctx.fillStyle = '#475569'
    ctx.font = '600 21px "Arial"'
    drawClampText(eventLabel || 'Event Pass', 64, 146, width - qrSize - 170)

    // Identitas header
    ctx.fillStyle = '#64748b'
    ctx.font = '700 13px "Arial"'
    drawClampText((brandLabel || '3oNs Digital').toUpperCase(), 64, 166, width - qrSize - 170)

    // Lencana kategori
    ctx.fillStyle = style.soft
    ctx.fillRect(64, 184, 198, 44)
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 2
    ctx.strokeRect(64, 184, 198, 44)
    ctx.fillStyle = style.dark
    ctx.font = '800 20px "Arial"'
    ctx.fillText(style.label, 84, 214)

    // Participant details
    ctx.fillStyle = '#0f172a'
    ctx.font = '700 30px "Arial"'
    drawClampText(participant.name || '-', 64, 276, width - qrSize - 170)

    ctx.fillStyle = '#64748b'
    ctx.font = '700 14px "Arial"'
    ctx.fillText('ID TIKET', 64, 316)
    ctx.fillText('HARI', 64, 358)
    ctx.fillText('KATEGORI', 64, 400)

    ctx.fillStyle = '#1e293b'
    ctx.font = '700 24px "Arial"'
    ctx.fillText(participant.ticket_id, 64, 340)
    ctx.fillText(String(participant.day_number), 64, 382)
    ctx.fillText(style.label, 64, 424)

    // Divider before notes
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(64, 442)
    ctx.lineTo(width - qrSize - 84, 442)
    ctx.stroke()

    // Footer notes
    ctx.fillStyle = '#334155'
    ctx.font = '700 14px "Arial"'
    ctx.fillText('Valid untuk 1 orang. Dilarang duplikasi tiket.', 64, 468)
    ctx.fillStyle = '#64748b'
    ctx.font = '600 13px "Arial"'
    ctx.fillText('Tunjukkan tiket ini saat registrasi di pintu masuk.', 64, 490)

    // Scan note
    ctx.fillStyle = '#1e293b'
    ctx.font = '700 16px "Arial"'
    ctx.fillText('Scan QR di pintu masuk', qrX + 40, qrY + qrSize + 42)

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

    const message = `🎫 *E-Ticket*\n\n` +
      `Halo *${participant.name}*,\n` +
      `Berikut informasi tiket Anda:\n\n` +
      `📋 ID Tiket: *${participant.ticket_id}*\n` +
      `📂 Kategori: *${participant.category}*\n` +
      `📅 Hari: *${participant.day_number}*\n\n` +
      `Silakan tunjukkan QR ini saat registrasi di lokasi acara.\n` +
      `Terima kasih!\n\n` +
      `_${eventLabel || 'Event Platform'}_`

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

  const prettyVerifyData = (data) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  const runServerVerifySelfTest = async () => {
    if (verifyTesting) return
    setVerifyTesting(true)

    try {
      const base64 = (value) => btoa(value)

      const legacySig = base64('tenant-default|event-1|YMH-D1-001|1|event-2026')
      const legacyQr = JSON.stringify({ tid: 'YMH-D1-001', t: 'tenant-default', e: 'event-1', d: 1, sig: legacySig, v: 2 })
      const badQr = JSON.stringify({ tid: 'YMH-D1-001', t: 'tenant-default', e: 'event-1', d: 1, sig: 'BAD_SIGNATURE', v: 2 })

      const secureCode = 'SECURE-CODE-EXAMPLE-123'
      const secureRef = 'REFABC123456'
      const v3Sig = base64(`tenant-default|event-1|YMH-D1-001|1|${secureCode}|${secureRef}|event-secure-v3`)
      const v3Qr = JSON.stringify({ tid: 'YMH-D1-001', t: 'tenant-default', e: 'event-1', d: 1, r: secureRef, sig: v3Sig, v: 3 })

      const scenarios = [
        {
          key: 'legacy_valid',
          expected: (data) => data?.valid === true && data?.mode === 'legacy-v2',
          payload: { qr_data: legacyQr, tenant_id: 'tenant-default' }
        },
        {
          key: 'legacy_invalid',
          expected: (data) => data?.valid === false && data?.reason === 'invalid_signature',
          payload: { qr_data: badQr, tenant_id: 'tenant-default' }
        },
        {
          key: 'v3_valid',
          expected: (data) => data?.valid === true && data?.mode === 'v3-secure',
          payload: { qr_data: v3Qr, tenant_id: 'tenant-default', secure_code: secureCode, secure_ref: secureRef }
        },
        {
          key: 'v3_missing_token',
          expected: (data) => data?.valid === false && data?.reason === 'missing_secure_token',
          payload: { qr_data: v3Qr, tenant_id: 'tenant-default' }
        }
      ]

      const results = []
      for (const scenario of scenarios) {
        try {
          const response = await apiFetch('/api/ticket/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.payload)
          })

          const data = await response.json().catch(() => ({}))
          results.push({
            key: scenario.key,
            ok: response.ok && scenario.expected(data),
            responseOk: response.ok,
            status: response.status,
            data
          })
        } catch (err) {
          results.push({
            key: scenario.key,
            ok: false,
            responseOk: false,
            status: 0,
            data: { error: err?.message || 'network_error' }
          })
        }
      }

      const passed = results.filter(item => item.ok).length
      const allPassed = passed === results.length
      setVerifyReport({ checkedAt: new Date().toISOString(), passed, total: results.length, allPassed, results })

      if (allPassed) {
        toast.success('Pemeriksaan Server Berhasil', 'Semua skenario keamanan lulus')
      } else {
        toast.error('Pemeriksaan Server Gagal', `${passed}/${results.length} skenario lulus`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal Uji Verifikasi', 'Tidak bisa menjalankan uji verifikasi tiket')
    }

    setVerifyTesting(false)
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

        <button
          className="btn btn-secondary qr-mobile-download-btn"
          onClick={runServerVerifySelfTest}
          disabled={verifyTesting}
          title="Uji endpoint verifikasi keamanan server"
        >
          {verifyTesting
            ? <><span className="spinner qr-spinner-sm"></span> Test verify...</>
            : <><ShieldCheck size={16} /> Test Server Verify</>}
        </button>

        {verifyReport && (
          <div className={`card ${verifyReport.allPassed ? 'border-success' : 'border-error'}`} style={{ marginTop: 12 }}>
            <div className="card-header">
              <h3 className="card-title">Hasil Test Verify</h3>
              <span className={`badge ${verifyReport.allPassed ? 'badge-green' : 'badge-red'}`}>{verifyReport.passed}/{verifyReport.total}</span>
            </div>
            <div className="scanner-note scanner-note-tight">
              {verifyReport.results.map(item => `${item.ok ? 'OK' : 'FAIL'} ${item.key}`).join(' | ')}
            </div>
            <div style={{ marginTop: 10 }}>
              {verifyReport.results.map(item => (
                <details key={item.key} style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {item.ok ? 'OK' : 'FAIL'} {item.key} (HTTP {item.status || '-'})
                  </summary>
                  <pre style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflowX: 'auto', fontSize: 12 }}>
                    {prettyVerifyData(item.data)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

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
        <h1>Manajemen Tiket QR</h1>
        <p>Generate, kelola, dan verifikasi tiket QR dengan keamanan berlapis</p>
      </div>

      {/* ===== TAB NAVIGATION ===== */}
      <div className="tab-navigation" style={{ marginBottom: 24, display: 'flex', gap: 12, borderBottom: '2px solid #e8e4d0', paddingBottom: 0 }}>
        <button
          onClick={() => setActiveTab('generate')}
          className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            color: activeTab === 'generate' ? '#4da6e8' : '#6b7280',
            borderBottom: activeTab === 'generate' ? '3px solid #4da6e8' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <QrCode size={16} style={{ display: 'inline', marginRight: 6 }} /> Generate Tiket
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            color: activeTab === 'import' ? '#4da6e8' : '#6b7280',
            borderBottom: activeTab === 'import' ? '3px solid #4da6e8' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Upload size={16} style={{ display: 'inline', marginRight: 6 }} /> Import Barcode
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
            <button className="btn btn-secondary" onClick={runServerVerifySelfTest} disabled={verifyTesting} title="Uji endpoint verifikasi keamanan server">
              {verifyTesting
                ? (<><span className="spinner qr-spinner-sm"></span> Test verify...</>)
                : (<><ShieldCheck size={16} /> Test Server Verify</>)}
            </button>
            {generating && (<div className="qr-toolbar-progress"><div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${generationProgress}%` }}></div></div></div>)}
          </div>

          {verifyReport && (
            <div className={`card ${verifyReport.allPassed ? 'border-success' : 'border-error'}`} style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h3 className="card-title">Hasil Test Verify Server</h3>
                <span className={`badge ${verifyReport.allPassed ? 'badge-green' : 'badge-red'}`}>{verifyReport.passed}/{verifyReport.total}</span>
              </div>
              <p className="scanner-note scanner-note-tight">
                {verifyReport.results.map(item => `${item.ok ? 'OK' : 'FAIL'} ${item.key}`).join(' | ')}
              </p>
              <div style={{ marginTop: 10 }}>
                {verifyReport.results.map(item => (
                  <details key={item.key} style={{ marginBottom: 8 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      {item.ok ? 'OK' : 'FAIL'} {item.key} (HTTP {item.status || '-'})
                    </summary>
                    <pre style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflowX: 'auto', fontSize: 12 }}>
                      {prettyVerifyData(item.data)}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}

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
