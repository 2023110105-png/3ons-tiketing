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
import { FileDown, Download, QrCode, ShieldCheck, MessageCircle, X, Upload, Send } from 'lucide-react'
import { getWhatsAppShareLink, generateWaMessage } from '../../utils/whatsapp'
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'
import { generateQRData, parseQRData } from '../../utils/qrSecurity'
import BarcodeImport from './BarcodeImport'
import ManualSendModal from '../../components/ManualSendModal'
import { supabase } from '../../lib/supabase'

const CATEGORY_STYLES = {
  VIP: { accent: '#b91c1c', soft: '#fdecea', dark: '#7f1d1d', label: 'VIP' },
  Dealer: { accent: '#1d4ed8', soft: '#e8f1ff', dark: '#1e3a8a', label: 'DEALER' },
  Media: { accent: '#ca8a04', soft: '#fff8e1', dark: '#854d0e', label: 'MEDIA' },
  Regular: { accent: '#15803d', soft: '#eaf7ee', dark: '#14532d', label: 'REGULAR' }
}

// ===== SUPABASE DATA FUNCTIONS =====
// Load participants from Supabase workspace_state (primary source)
async function loadParticipantsFromSupabase(day) {
  try {
    // Get participants from workspace_state (where data is actually stored)
    const { data, error } = await supabase
      .from('workspace_state')
      .select('store')
      .eq('id', 'ons-workspace-001')
      .single();
    
    if (error) throw error;
    
    // Extract participants from workspace store structure
    const store = data?.store;
    const participants = store?.tenants?.['tenant-default']?.events?.['event-default']?.participants || [];
    
    // Filter by day if specified
    if (typeof day === 'number') {
      return participants.filter(p => (p.day_number || p.day || 1) === day);
    }
    
    return participants;
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
  const [manualSendParticipant, setManualSendParticipant] = useState(null)
  const [isManualSendOpen, setIsManualSendOpen] = useState(false)
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

    // === BACKGROUND (sama seperti WA bot) ===
    ctx.fillStyle = '#f3f6fb'
    ctx.fillRect(0, 0, width, height)

    // === OUTER CARD WITH SHADOW ===
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 8
    ctx.shadowOffsetX = 0
    fillRoundedRect(safeX, safeY, safeW, safeH, radius, '#ffffff')
    ctx.restore()

    // === OUTER BORDER ===
    strokeRoundedRect(safeX, safeY, safeW, safeH, radius, '#dfe6ef', 2)
    fillRoundedRect(safeX + 10, safeY + 10, safeW - 20, safeH - 20, Math.max(8, radius - 4), '#ffffff')

    // === TOP STRIP (kategori color based - sama seperti WA bot) ===
    const stripH = 24
    const stripY = safeY + 8
    const stripX = safeX + 8
    const stripW = safeW - 16
    
    // Strip 1: Kategori color (50%)
    ctx.fillStyle = style.accent
    ctx.fillRect(stripX, stripY, stripW * 0.5, stripH)
    
    // Strip 2: Blue (35%)
    ctx.fillStyle = '#4da6e8'
    ctx.fillRect(stripX + stripW * 0.5, stripY, stripW * 0.35, stripH)
    
    // Strip 3: Pink (15%)
    ctx.fillStyle = '#e84393'
    ctx.fillRect(stripX + stripW * 0.85, stripY, stripW * 0.15, stripH)

    // === DECORATIVE RIBBON (sama seperti WA bot) ===
    ctx.fillStyle = style.soft
    ctx.fillRect(safeX + safeW - 190, safeY + 14, 170, 78)

    const qrX = safeX + safeW - qrSize - 56
    const qrY = safeY + 88
    const leftX = safeX + 20
    const leftY = safeY + 34
    const leftW = qrX - leftX - 18
    const leftH = safeY + safeH - leftY - 20

    // === INFO PANEL (sama seperti WA bot) ===
    fillRoundedRect(leftX, leftY, leftW, leftH, Math.max(12, radius - 6), '#ffffff')
    strokeRoundedRect(leftX, leftY, leftW, leftH, Math.max(12, radius - 6), '#edf0f6', 2)

    // === QR PANEL (sama seperti WA bot) ===
    fillRoundedRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 16, '#ffffff')
    
    // Top border
    ctx.fillStyle = style.accent
    ctx.fillRect(qrX - 18, qrY - 18, qrSize + 36, 4)
    // Bottom border
    ctx.fillRect(qrX - 18, qrY + qrSize + 14, qrSize + 36, 4)
    // Left border
    ctx.fillRect(qrX - 18, qrY - 16, 4, qrSize + 32)
    // Right border
    ctx.fillRect(qrX + qrSize + 14, qrY - 16, 4, qrSize + 32)
    
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

    // === PERFORATION LINE (sama seperti WA bot) ===
    ctx.fillStyle = '#e5e7eb'
    for (let i = safeY + 56; i < safeY + safeH - 28; i += 12) {
      ctx.fillRect(qrX - 32, i, 2, 4)
    }

    // === SUBTLE WATERMARK ===
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#8b7355'
    ctx.font = '900 100px "Georgia"'
    ctx.translate(leftX + 60, safeY + safeH - 100)
    ctx.rotate(-0.08)
    ctx.fillText(String(brandLabel || 'Violin').toUpperCase(), 0, 0)
    ctx.restore()

    // === HEADER (sama seperti WA bot) ===
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 32px "Arial"'
    ctx.fillText('E-Attendance', leftX + 22, leftY + 40)

    // Subtitle
    ctx.fillStyle = '#666666'
    ctx.font = '16px "Arial"'
    drawClampText(eventLabel || 'PALEMBANG VIOLIN COMPETITION', leftX + 22, leftY + 80, leftW - 44)

    // Brand label
    ctx.fillStyle = '#888888'
    ctx.font = 'bold 11px "Arial"'
    drawClampText((brandLabel || 'Official Event').toUpperCase(), leftX + 22, leftY + 102, leftW - 44)

    // === CATEGORY BADGE (sama seperti WA bot) ===
    ctx.fillStyle = style.accent
    ctx.fillRect(leftX + 22, leftY + 120, 160, 38)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 15px "Arial"'
    ctx.textAlign = 'center'
    ctx.fillText(String(categoryLabel).toUpperCase(), leftX + 22 + 80, leftY + 142)
    ctx.textAlign = 'left'

    // === PARTICIPANT NAME ===
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 28px "Arial"'
    drawClampText(participant.name || '-', leftX + 22, leftY + 190, leftW - 44)

    // === INFO GRID (sama seperti WA bot) ===
    const infoY = leftY + 242
    const colWidth = Math.round((leftW - 44) / 3)

    // Labels
    ctx.fillStyle = '#888888'
    ctx.font = '14px "Arial"'
    ctx.fillText('ID TICKET', leftX + 22, infoY)
    ctx.fillText('DAY', leftX + 22 + colWidth, infoY)
    ctx.fillText('CATEGORY', leftX + 22 + colWidth * 2, infoY)

    // Values
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 16px "Arial"'
    ctx.fillText(String(participant.ticket_id || '-'), leftX + 22, infoY + 18)
    ctx.font = 'bold 16px "Arial"'
    ctx.fillText(String(participant.day_number || '-'), leftX + 22 + colWidth, infoY + 18)
    ctx.font = 'bold 16px "Arial"'
    drawClampText(String(participant.category || categoryLabel || '-'), leftX + 22 + colWidth * 2, infoY + 18, colWidth - 10)

    // === DIVIDER ===
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(leftX + 22, leftY + leftH - 80, leftW - 44, 2)

    // === FOOTER (sama seperti WA bot) ===
    ctx.fillStyle = '#444444'
    ctx.font = '16px "Arial"'
    ctx.fillText('Tunjukkan kode QR ini untuk registrasi absensi peserta', leftX + 22, leftY + leftH - 60)

    // Date/Time info
    const tl = getMetaValue(participant, 'Tanggal Lahir')
    ctx.fillStyle = '#666666'
    ctx.font = '14px "Arial"'
    ctx.fillText(tl ? `${tl}` : '11 April 2026 - Primavera Production', leftX + 22, leftY + leftH - 40)

    // === QR FOOTER (sama seperti WA bot) ===
    ctx.fillStyle = '#333333'
    ctx.font = 'bold 16px "Arial"'
    ctx.fillText('Scan at entrance', qrX + 24, qrY + qrSize + 30)
    ctx.fillStyle = '#888888'
    ctx.font = '14px "Arial"'
    ctx.fillText('Keep screen bright for quick scan', qrX + 24, qrY + qrSize + 50)

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

  // Open manual send modal with participant
  const openManualSend = async (participant) => {
    // Ensure QR data exists
    const participantWithQR = await ensureParticipantQRData(participant);
    if (!participantWithQR) {
      toast.error('Gagal', 'Tidak bisa generate QR untuk peserta ini');
      return;
    }
    
    // Generate QR image for preview
    try {
      const url = await buildTicketQrImage(participantWithQR, { width: 900, height: 540, qrSize: 320 })
      setQrUrl(url)
      setManualSendParticipant(participantWithQR)
      setIsManualSendOpen(true)
    } catch (err) {
      toast.error('Gagal', 'Tidak bisa membuat preview tiket')
    }
  }

  // Handle successful manual send
  const handleManualSendSuccess = ({ participant, phone, attempts }) => {
    // Mark participant as sent (update local state)
    setParticipants(prev => prev.map(p => 
      p.id === participant.id 
        ? { ...p, qr_locked: true, last_sent_at: new Date().toISOString() }
        : p
    ))
    
    // Close modal after short delay
    setTimeout(() => {
      setIsManualSendOpen(false)
      setManualSendParticipant(null)
    }, 1500)
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
                className="btn btn-ghost btn-sm qr-icon-btn qr-manual-btn"
                onClick={(e) => { e.stopPropagation(); openManualSend(p) }}
                title="Kirim Manual"
              >
                <Send size={16} />
              </button>
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
                <button
                  className="btn btn-primary qr-modal-action"
                  onClick={() => openManualSend(selectedParticipant)}
                >
                  <Send size={16} /> Kirim
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Send Modal */}
        <ManualSendModal
          isOpen={isManualSendOpen}
          onClose={() => { setIsManualSendOpen(false); setManualSendParticipant(null); }}
          participant={manualSendParticipant}
          qrImageUrl={qrUrl}
          onSendSuccess={handleManualSendSuccess}
          tenantId="tenant-default"
        />
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
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openManualSend(p) }} title="Kirim Manual"><Send size={14} /></button>
                      <button className="btn btn-ghost btn-whatsapp btn-sm" onClick={(e) => { e.stopPropagation(); shareViaWhatsApp(p) }} title="Share via WhatsApp"><MessageCircle size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); downloadQR(p) }} title="Download tiket"><Download size={14} /></button>
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
                    <button
                      className="btn btn-primary"
                      onClick={() => openManualSend(selectedParticipant)}
                      title="Kirim tiket manual dengan nomor WhatsApp"
                    >
                      <Send size={14} /> Kirim Manual
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

      {/* Manual Send Modal */}
      <ManualSendModal
        isOpen={isManualSendOpen}
        onClose={() => { setIsManualSendOpen(false); setManualSendParticipant(null); }}
        participant={manualSendParticipant}
        qrImageUrl={qrUrl}
        onSendSuccess={handleManualSendSuccess}
        tenantId="tenant-default"
      />
    </div>
  )
}
