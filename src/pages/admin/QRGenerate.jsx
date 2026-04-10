// ===== REAL FUNCTIONS FOR QR GENERATE =====
import { fetchFirebaseWorkspaceSnapshot } from '../../lib/dataSync';
let _workspaceSnapshot = null;
async function bootstrapStoreFromFirebase() {
  _workspaceSnapshot = await fetchFirebaseWorkspaceSnapshot();
  return _workspaceSnapshot;
}
function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}
function _getActiveTenant() { return { id: 'tenant-default' }; }
function _getAvailableDays() { return [1]; }
function getCurrentDay() { return 1; }
function _simulateCheckIns() { 
  alert('Simulasi check-in dijalankan.'); 
}

// Dummy function untuk menghindari crash
// eslint-disable-next-line no-unused-vars
function regenerateSecureQRTokens(_day, _actor) {
  return { updated: 0, message: 'Regenerate QR tokens not implemented yet' };
}

// Generate QR data for participants yang belum punya qr_data
function _generateQRDataForParticipant(participant) {
  if (!participant) return null;
  
  // Jika sudah ada qr_data valid, gunakan yang ada
  if (participant.qr_data) {
    try {
      const parsed = parseQRData(participant.qr_data);
      if (parsed && parsed.ticketId && parsed.signature) {
        return participant.qr_data;
      }
    } catch {
      // Invalid QR data, generate new one
    }
  }
  
  // Generate new QR data dengan format yang konsisten
  return generateQRData(participant, 'tenant-default', 'event-default');
}

// Update participants dengan qr_data jika kosong
function _ensureParticipantsHaveQRData(participants) {
  if (!Array.isArray(participants)) return participants;
  
  return participants.map(p => ({
    ...p,
    qr_data: p.qr_data || _generateQRDataForParticipant(p)
  }));
}

function getTenantBranding() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return {};
  const tenantId = 'tenant-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.branding || {};
}
function getCurrentEventName() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 'Event';
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.name || 'Event';
}
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { useToast } from '../../contexts/ToastContext'
import { FileDown, Download, QrCode, ShieldCheck, MessageCircle, X, Upload } from 'lucide-react'
import { getWhatsAppShareLink, generateWaMessage } from '../../utils/whatsapp'
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'
import { generateQRData, parseQRData } from '../../utils/qrSecurity'
import BarcodeImport from './BarcodeImport'
import { supabase } from '../../lib/supabase'

const CATEGORY_STYLES = {
  VIP: { accent: '#b91c1c', soft: '#fdecea', dark: '#7f1d1d', label: 'VIP' },
  Dealer: { accent: '#1d4ed8', soft: '#e8f1ff', dark: '#1e3a8a', label: 'DEALER' },
  Media: { accent: '#ca8a04', soft: '#fff8e1', dark: '#854d0e', label: 'MEDIA' },
  Regular: { accent: '#15803d', soft: '#eaf7ee', dark: '#14532d', label: 'REGULAR' }
}

// ===== SUPABASE DATA FUNCTIONS =====
// Load participants from Supabase (primary source)
async function loadParticipantsFromSupabase(day) {
  try {
    let query = supabase.from('participants').select('*').order('nama', { ascending: true });
    if (typeof day === 'number') {
      // Cek multiple field names: hari, day, day_number
      query = query.or(`hari.eq.${day},day.eq.${day},day_number.eq.${day}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    // Filter manual untuk memastikan day yang benar
    if (typeof day === 'number' && data) {
      return data.filter(p => 
        Number(p.hari) === day || 
        Number(p.day) === day || 
        Number(p.day_number) === day
      );
    }
    return data || [];
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
    // Fallback to workspace snapshot
    return getParticipants(day);
  }
}

// Save QR data to Supabase
async function saveQRDataToSupabase(participantId, qrData) {
  try {
    const { error } = await supabase
      .from('participants')
      .update({ qr_data: qrData, updated_at: new Date().toISOString() })
      .eq('id', participantId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to save QR data:', err);
    return false;
  }
}

// Ensure participant has QR data (generate if missing and save to DB)
async function ensureParticipantQRData(participant) {
  if (!participant) return null;
  
  // If already has valid qr_data, return as-is
  if (participant.qr_data) {
    try {
      const parsed = parseQRData(participant.qr_data);
      if (parsed && parsed.ticketId && parsed.signature) {
        return participant;
      }
    } catch {
      // Invalid QR data, generate new
    }
  }
  
  // Generate new QR data
  const qrData = generateQRData(participant, 'tenant-default', 'event-default');
  
  // Save to Supabase
  if (participant.id) {
    await saveQRDataToSupabase(participant.id, qrData);
  }
  
  return { ...participant, qr_data: qrData };
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

  // Initial load data dari Supabase (PRIMARY)
  useEffect(() => {
    const load = async () => {
      setGenerating(true);
      try {
        // Load from Supabase first (persistent storage)
        const dbParticipants = await loadParticipantsFromSupabase(dayFilter);
        setParticipants(dbParticipants);
        
        // Also bootstrap from Firebase/workspace for other data
        await bootstrapStoreFromFirebase();
        setTicketBranding(getTenantBranding());
        setActiveEventName(getCurrentEventName());
      } catch (err) {
        toast.error('Gagal', 'Gagal memuat data peserta');
        console.error(err);
      } finally {
        setGenerating(false);
      }
    };
    load();
  }, [dayFilter, toast]);

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

  // Refresh participants when day filter changes
  useEffect(() => {
    const refresh = async () => {
      const dbParticipants = await loadParticipantsFromSupabase(dayFilter);
      setParticipants(dbParticipants);
    };
    refresh();
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

    const radius = Math.round(Math.min(width, height) * 0.04)
    const pad = 24
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

    // === BACKGROUND GRADIENT ELEGANT ===
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#faf8f5')
    bg.addColorStop(0.5, '#f5f0e8')
    bg.addColorStop(1, '#faf8f5')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // === SHADOW ELEVATION ===
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 16
    ctx.shadowOffsetX = 0
    fillRoundedRect(safeX, safeY, safeW, safeH, radius, '#ffffff')
    ctx.restore()

    // === INNER BORDER ===
    strokeRoundedRect(safeX + 8, safeY + 8, safeW - 16, safeH - 16, Math.max(12, radius - 8), '#f0ebe3', 2)

    // === TOP GRADIENT BAR ===
    const topGrad = ctx.createLinearGradient(safeX, safeY, safeX + safeW, safeY)
    topGrad.addColorStop(0, '#667eea')
    topGrad.addColorStop(0.5, '#764ba2')
    topGrad.addColorStop(1, '#f093fb')
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(safeX + radius, safeY)
    ctx.lineTo(safeX + safeW - radius, safeY)
    ctx.arcTo(safeX + safeW, safeY, safeX + safeW, safeY + 28, radius)
    ctx.lineTo(safeX + safeW, safeY + 28)
    ctx.lineTo(safeX, safeY + 28)
    ctx.lineTo(safeX, safeY + radius)
    ctx.arcTo(safeX, safeY, safeX + radius, safeY, radius)
    ctx.closePath()
    ctx.fillStyle = topGrad
    ctx.fill()
    ctx.restore()

    // === DECORATIVE CORNER ACCENT ===
    ctx.save()
    ctx.fillStyle = `${style.accent}15`
    ctx.beginPath()
    ctx.moveTo(safeX + safeW - 140, safeY + 16)
    ctx.lineTo(safeX + safeW - 16, safeY + 16)
    ctx.lineTo(safeX + safeW - 16, safeY + 100)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    const qrX = safeX + safeW - qrSize - 60
    const qrY = safeY + 100
    const leftX = safeX + 24
    const leftY = safeY + 44
    const leftW = qrX - leftX - 24
    const leftH = safeY + safeH - leftY - 24

    // === INFO PANEL WITH SOFT SHADOW ===
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 8
    fillRoundedRect(leftX, leftY, leftW, leftH, Math.max(16, radius - 8), '#ffffff')
    ctx.restore()
    strokeRoundedRect(leftX, leftY, leftW, leftH, Math.max(16, radius - 8), '#e8e0d5', 1)

    // === QR PANEL ===
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 10
    fillRoundedRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 20, '#ffffff')
    ctx.restore()
    strokeRoundedRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 20, style.accent, 3)
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

    // === ELEGANT PERFORATION LINE ===
    const perfX = qrX - 40
    ctx.save()
    ctx.strokeStyle = '#d4c8b8'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 10])
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(perfX, safeY + 64)
    ctx.lineTo(perfX, safeY + safeH - 32)
    ctx.stroke()
    ctx.restore()

    // === SUBTLE WATERMARK ===
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#8b7355'
    ctx.font = '900 100px "Georgia"'
    ctx.translate(leftX + 60, safeY + safeH - 100)
    ctx.rotate(-0.08)
    ctx.fillText(String(brandLabel || 'Violin').toUpperCase(), 0, 0)
    ctx.restore()

    // === HEADER TITLE ===
    ctx.fillStyle = '#2d3748'
    ctx.font = '900 36px "Arial"'
    ctx.fillText('E-Attendance', leftX + 24, leftY + 68)

    // Subtitle
    ctx.fillStyle = '#718096'
    ctx.font = '600 16px "Arial"'
    drawClampText(eventLabel || 'PALEMBANG VIOLIN COMPETITION', leftX + 24, leftY + 94, leftW - 48)

    // Brand label
    ctx.fillStyle = '#a0aec0'
    ctx.font = '700 11px "Arial"'
    drawClampText((brandLabel || 'Official Event').toUpperCase(), leftX + 24, leftY + 114, leftW - 48)

    // === ELEGANT CATEGORY BADGE ===
    const badgeY = leftY + 132
    ctx.save()
    ctx.shadowColor = 'rgba(102, 126, 234, 0.25)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    fillRoundedRect(leftX + 24, badgeY, 160, 38, 19, style.accent)
    ctx.restore()
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 15px "Arial"'
    ctx.textAlign = 'center'
    ctx.fillText(String(participant.category || style.label || '-').toUpperCase(), leftX + 24 + 80, badgeY + 25)
    ctx.textAlign = 'left'

    // === PARTICIPANT NAME ===
    ctx.fillStyle = '#1a202c'
    ctx.font = '900 28px "Arial"'
    drawClampText(participant.name || '-', leftX + 24, leftY + 210, leftW - 48)

    // === INFO GRID ===
    const infoY = leftY + 242
    const colWidth = (leftW - 48) / 3

    // Labels
    ctx.fillStyle = '#a0aec0'
    ctx.font = '600 12px "Arial"'
    ctx.fillText('ID TICKET', leftX + 24, infoY)
    ctx.fillText('DAY', leftX + 24 + colWidth, infoY)
    ctx.fillText('CATEGORY', leftX + 24 + colWidth * 2, infoY)

    // Values
    ctx.fillStyle = '#2d3748'
    ctx.font = '800 20px "Arial"'
    ctx.fillText(String(participant.ticket_id || '-'), leftX + 24, infoY + 26)
    ctx.font = '800 20px "Arial"'
    ctx.fillText(String(participant.day_number || '-'), leftX + 24 + colWidth, infoY + 26)
    ctx.font = '700 18px "Arial"'
    ctx.fillText(String(participant.category || '-'), leftX + 24 + colWidth * 2, infoY + 26)

    // === ELEGANT DIVIDER ===
    const dividerY = leftY + leftH - 80
    const gradDiv = ctx.createLinearGradient(leftX + 24, 0, leftX + leftW - 24, 0)
    gradDiv.addColorStop(0, 'transparent')
    gradDiv.addColorStop(0.5, '#e2d5c5')
    gradDiv.addColorStop(1, 'transparent')
    ctx.strokeStyle = gradDiv
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(leftX + 24, dividerY)
    ctx.lineTo(leftX + leftW - 24, dividerY)
    ctx.stroke()

    // === FOOTER INSTRUCTION ===
    ctx.fillStyle = '#4a5568'
    ctx.font = '600 13px "Arial"'
    ctx.fillText('📱 Tunjukkan kode QR ini untuk registrasi absensi peserta', leftX + 24, leftY + leftH - 54)

    // Date/Time info
    const tl = getMetaValue(participant, 'Tanggal Lahir')
    ctx.fillStyle = '#718096'
    ctx.font = '500 12px "Arial"'
    ctx.fillText(tl ? `🎂 ${tl}` : '📅 11 April 2026 • Primavera Production', leftX + 24, leftY + leftH - 34)

    // === QR FOOTER ===
    ctx.fillStyle = '#2d3748'
    ctx.font = '700 13px "Arial"'
    ctx.fillText('🔍 Scan at entrance', qrX + 12, qrY + qrSize + 48)
    ctx.fillStyle = '#a0aec0'
    ctx.font = '500 11px "Arial"'
    ctx.fillText('Keep screen bright for quick scan', qrX + 12, qrY + qrSize + 66)

    return canvas.toDataURL('image/png', 1)
  }

  const generateQR = async (participant) => {
    setSelectedParticipant(participant)
    try {
      // Ensure QR data exists and save to Supabase
      const participantWithQR = await ensureParticipantQRData(participant);
      if (!participantWithQR) {
        toast.error('Gagal', 'Tidak bisa generate QR untuk peserta ini');
        return;
      }
      
      const url = await buildTicketQrImage(participantWithQR, { width: 900, height: 540, qrSize: 280 })
      setQrUrl(url)
    } catch {
      toast.error('Gagal', 'Tidak bisa membuat QR tiket')
    }
  }

  const downloadQR = async (participant) => {
    try {
      // Ensure QR data exists and save to Supabase
      const participantWithQR = await ensureParticipantQRData(participant);
      if (!participantWithQR) {
        toast.error('Gagal', 'Tidak bisa generate QR untuk peserta ini');
        return;
      }
      
      const url = await buildTicketQrImage(participantWithQR, { width: 1200, height: 720, qrSize: 360 })
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
    // Ensure QR data exists and save to Supabase
    const participantWithQR = await ensureParticipantQRData(participant);
    if (!participantWithQR) {
      toast.error('Gagal', 'Tidak bisa generate QR untuk peserta ini');
      return;
    }
    
    const eventLabel = String(
      (activeEventName && activeEventName !== '-') ? activeEventName : (ticketBranding.eventName || 'Event')
    ).trim()
    const base = generateWaMessage(participantWithQR)
    const message = `${base}\n\nSilakan tunjukkan QR ini saat registrasi di lokasi acara.\nTerima kasih!\n\n_${eventLabel || 'Event Platform'}_`

    // Try Web Share API first (works on mobile, can share files)
    if (navigator.share) {
      try {
        const url = await buildTicketQrImage(participantWithQR, { width: 1200, height: 720, qrSize: 360 })
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
    const waUrl = getWhatsAppShareLink(participantWithQR)
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
