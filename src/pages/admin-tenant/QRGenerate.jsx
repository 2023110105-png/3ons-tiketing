// ===== REAL FUNCTIONS FOR QR GENERATE =====
import { fetchWorkspaceSnapshot } from '../../lib/dataSync';
let _workspaceSnapshot = null;

function getActiveTenantId() {
  if (typeof window !== 'undefined' && window.currentUser?.tenant_id) {
    return window.currentUser.tenant_id;
  }
  try {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.user?.tenant_id) return session.user.tenant_id;
    if (session.user?.tenant?.id) return session.user.tenant.id;
  } catch { /* ignore */ }
  if (_workspaceSnapshot?.store?.tenants) {
    const firstTenant = Object.keys(_workspaceSnapshot.store.tenants)[0];
    if (firstTenant) return firstTenant;
  }
  return 'default';
}

async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}
function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}
function _getActiveTenant() { return { id: getActiveTenantId() }; }
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
  return generateQRData(participant, getActiveTenantId(), 'event-default');
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
  const tenantId = getActiveTenantId();
  return _workspaceSnapshot.store.tenants?.[tenantId]?.branding || {};
}
function getCurrentEventName() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 'Event';
  const tenantId = getActiveTenantId();
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

// VIBRANT Full Color Palette - Anti Monoton!
const CATEGORY_STYLES = {
  VIP: { 
    accent: '#dc2626', 
    accentLight: '#fca5a5',
    soft: '#fef2f2', 
    dark: '#991b1b', 
    gradient: ['#be123c', '#dc2626', '#f87171', '#fca5a5'],
    rainbow: ['#ff0080', '#ff8c00', '#ffd700'],
    label: 'VIP'
  },
  Dealer: { 
    accent: '#2563eb', 
    accentLight: '#93c5fd',
    soft: '#eff6ff', 
    dark: '#1e40af', 
    gradient: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa'],
    rainbow: ['#0080ff', '#00bfff', '#87ceeb'],
    label: 'DEALER'
  },
  Media: { 
    accent: '#d97706', 
    accentLight: '#fcd34d',
    soft: '#fffbeb', 
    dark: '#b45309', 
    gradient: ['#b45309', '#d97706', '#f59e0b', '#fbbf24'],
    rainbow: ['#ff6b35', '#f7931e', '#ffd23f'],
    label: 'MEDIA'
  },
  Regular: { 
    accent: '#059669', 
    accentLight: '#6ee7b7',
    soft: '#ecfdf5', 
    dark: '#047857', 
    gradient: ['#047857', '#059669', '#10b981', '#34d399'],
    rainbow: ['#00c853', '#64dd17', '#aeea00'],
    label: 'REGULAR'
  }
}

// FULL COLOR Scheme - Vibrant & Anti Monoton
const COLORS = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  cardBg: '#ffffff',
  cardBorder: '#e0e0e0',
  textPrimary: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textMuted: '#7a7a9a',
  accentRed: '#ff4757',
  accentBlue: '#3742fa',
  accentGreen: '#2ed573',
  accentOrange: '#ffa502',
  accentPink: '#ff6b81',
  accentPurple: '#8e44ad',
  accentCyan: '#00d2d3',
  accentYellow: '#ffa502',
  divider: '#dcdcdc',
  shadow: 'rgba(0, 0, 0, 0.15)'
}

// Rainbow palette for maximum color
const RAINBOW = {
  red: '#ff6b6b',
  orange: '#f9ca24',
  yellow: '#f9ca24',
  green: '#6ab04c',
  blue: '#4834d4',
  indigo: '#686de0',
  violet: '#be2edd',
  pink: '#ff7979',
  cyan: '#22a6b3',
  teal: '#1dd1a1'
}

// ===== SUPABASE DATA FUNCTIONS =====
// Load participants from Supabase workspace_state (primary source)
async function loadParticipantsFromSupabase(day) {
  try {
    // Get participants from workspace_state (where data is actually stored)
    const { data, error } = await supabase
      .from('workspace_state')
      .select('store')
      .eq('id', 'default')
      .single();
    
    if (error) throw error;
    
    // Extract participants from workspace store structure
    const store = data?.store;
    const participants = store?.tenants?.[getActiveTenantId()]?.events?.['event-default']?.participants || [];
    
    // Filter by day if specified - cek multiple field names
    if (typeof day === 'number') {
      return participants.filter(p => {
        const pDay = Number(p.day_number || p.day || p.hari || 1);
        return pDay === day;
      });
    }
    
    return participants;
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
    // Fallback to workspace snapshot
    return getParticipants(day);
  }
}

// Save QR data to Supabase using syncParticipantUpsert
async function saveQRDataToSupabase(participantId, qrData) {
  try {
    // Import syncParticipantUpsert dynamically to avoid circular dependency
    const { syncParticipantUpsert } = await import('../../lib/dataSync');
    
    // Get current participant data from workspace
    const allParticipants = getParticipants();
    const participant = allParticipants.find(p => p.id === participantId);
    
    if (!participant) {
      console.error('Participant not found:', participantId);
      return false;
    }
    
    // Update with new QR data
    const updatedParticipant = {
      ...participant,
      qr_data: qrData,
      updated_at: new Date().toISOString()
    };
    
    // Sync to Supabase
    await syncParticipantUpsert({
      tenantId: getActiveTenantId(),
      eventId: 'event-default',
      participant: updatedParticipant
    });
    
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
  const qrData = generateQRData(participant, getActiveTenantId(), 'event-default');
  
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
  const [dayCounts, setDayCounts] = useState({ 1: 0, 2: 0 })
  const [selectedParticipant, setSelectedParticipant] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [regeneratingSecure, setRegeneratingSecure] = useState(false)
  const [activeTab, setActiveTab] = useState('generate') // 'generate' atau 'import'
  const [manualSendParticipant, setManualSendParticipant] = useState(null)
  const [isManualSendOpen, setIsManualSendOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const toast = useToast()
  const isMobile = useIsMobileLayout()
  const [ticketBranding, setTicketBranding] = useState(getTenantBranding())
  const [activeEventName, setActiveEventName] = useState(getCurrentEventName())

  // Load day counts from Supabase
  const loadDayCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_state')
        .select('store')
        .eq('id', 'default')
        .single();
      
      if (error) throw error;
      
      const store = data?.store;
      const allParticipants = store?.tenants?.[getActiveTenantId()]?.events?.['event-default']?.participants || [];
      
      const count1 = allParticipants.filter(p => Number(p.day_number || p.day || p.hari || 1) === 1).length;
      const count2 = allParticipants.filter(p => Number(p.day_number || p.day || p.hari || 1) === 2).length;
      
      setDayCounts({ 1: count1, 2: count2 });
    } catch (err) {
      console.error('Failed to load day counts:', err);
      // Fallback to Firebase counts
      setDayCounts({ 1: getParticipants(1).length, 2: getParticipants(2).length });
    }
  };

  // Initial load data dari Supabase (PRIMARY)
  useEffect(() => {
    const load = async () => {
      setGenerating(true);
      try {
        // Load from Supabase first (persistent storage)
        const [dbParticipants] = await Promise.all([
          loadParticipantsFromSupabase(dayFilter),
          loadDayCounts()
        ]);
        setParticipants(dbParticipants);
        
        // Also bootstrap from server for other data
        await bootstrapStoreFromServer();
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

  const getCategoryColor = (category) => {
    const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.Regular
    return style.accent
  }

  // Filter participants berdasarkan search query
  const filteredParticipants = participants.filter(p => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()
    return (
      p.name?.toLowerCase().includes(query) ||
      p.ticket_id?.toLowerCase().includes(query) ||
      p.phone?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    )
  })

  const buildTicketQrImage = async (participant, options = {}) => {
    const width = options.width || 900
    const height = options.height || 540
    const qrSize = options.qrSize || 320
    const style = CATEGORY_STYLES[participant.category] || CATEGORY_STYLES.Regular
    const eventLabel = String(
      (activeEventName && activeEventName !== '-') ? activeEventName : (ticketBranding.eventName || 'Event')
    ).trim()
    // brandLabel tidak digunakan dalam desain baru

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

    // Variabel lama tidak digunakan dalam desain baru
    // const radius = Math.round(Math.min(width, height) * 0.04)
    // const pad = 24
    // const safeX = pad
    // const safeY = pad
    // const safeW = width - pad * 2
    // const safeH = height - pad * 2

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

    // === VIBRANT FULL COLOR DESIGN ===
    
    // Background canvas putih
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    
    // Subtle outer glow
    const outerGlow = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width)
    outerGlow.addColorStop(0, 'rgba(255,255,255,0)')
    outerGlow.addColorStop(0.7, 'rgba(255,255,255,0)')
    outerGlow.addColorStop(1, 'rgba(240,240,240,0.3)')
    ctx.fillStyle = outerGlow
    ctx.fillRect(0, 0, width, height)
    
    // Card dimensions
    const margin = 30
    const cardX = margin
    const cardY = margin
    const cardW = width - margin * 2
    const cardH = height - margin * 2
    const cardRadius = 16
    
    // === CARD SHADOW ===
    ctx.save()
    ctx.shadowColor = COLORS.shadow
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 10
    ctx.shadowOffsetX = 0
    fillRoundedRect(cardX, cardY, cardW, cardH, cardRadius, COLORS.cardBg)
    ctx.restore()
    
    // Card border
    strokeRoundedRect(cardX, cardY, cardW, cardH, cardRadius, COLORS.cardBorder, 1)
    
    // === RAINBOW HEADER ===
    const headerH = 90
    const headerGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY)
    // Rainbow header colors
    headerGradient.addColorStop(0, RAINBOW.red)
    headerGradient.addColorStop(0.2, RAINBOW.orange)
    headerGradient.addColorStop(0.4, RAINBOW.yellow)
    headerGradient.addColorStop(0.6, RAINBOW.green)
    headerGradient.addColorStop(0.8, RAINBOW.blue)
    headerGradient.addColorStop(1, RAINBOW.violet)
    
    // Fill header with rainbow gradient
    ctx.fillStyle = headerGradient
    ctx.beginPath()
    ctx.moveTo(cardX + cardRadius, cardY)
    ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + headerH, cardRadius)
    ctx.lineTo(cardX + cardW, cardY + headerH)
    ctx.lineTo(cardX, cardY + headerH)
    ctx.lineTo(cardX, cardY + cardRadius)
    ctx.arcTo(cardX, cardY, cardX + cardRadius, cardY, cardRadius)
    ctx.closePath()
    ctx.fill()
    
    // Rainbow accent line
    const accentGradient = ctx.createLinearGradient(cardX, cardY + headerH, cardX + cardW, cardY + headerH)
    accentGradient.addColorStop(0, RAINBOW.red)
    accentGradient.addColorStop(0.5, RAINBOW.green)
    accentGradient.addColorStop(1, RAINBOW.blue)
    ctx.fillStyle = accentGradient
    ctx.fillRect(cardX, cardY + headerH, cardW, 5)
    
    // === LAYOUT POSITIONS ===
    const contentX = cardX + 40
    const contentY = cardY + headerH + 30
    const contentW = cardW - qrSize - 160
    
    const qrX = cardX + cardW - qrSize - 50
    const qrY = cardY + headerH + 40
    
    // === CATEGORY BADGE ===
    const badgeW = 180
    const badgeH = 45
    const badgeX = contentX
    const badgeY = contentY
    
    // Badge shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4
    fillRoundedRect(badgeX + 3, badgeY + 3, badgeW, badgeH, 8, 'rgba(0,0,0,0.1)')
    ctx.restore()
    
    // Badge background
    fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 8, style.accent)
    
    // Badge highlight
    ctx.fillStyle = style.accentLight
    ctx.fillRect(badgeX, badgeY, badgeW, 3)
    
    // Badge text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px "Arial", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(participant.category || 'Regular').toUpperCase(), badgeX + badgeW / 2, badgeY + badgeH / 2 + 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    
    // === QR CONTAINER - TATA LETAK PRESISI ===
    const qrPad = 16
    const qrContainerW = qrSize + qrPad * 2
    const qrContainerH = qrSize + qrPad * 2 + 45 // Ruang untuk text
    
    // QR container background putih bersih
    fillRoundedRect(qrX - qrPad, qrY - qrPad, qrContainerW, qrContainerH, 10, '#ffffff')
    
    // QR border solid dengan warna kategori
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 3
    ctx.strokeRect(qrX - qrPad, qrY - qrPad, qrContainerW, qrContainerH)
    
    // Inner border highlight
    ctx.strokeStyle = style.accentLight
    ctx.lineWidth = 1
    ctx.strokeRect(qrX - qrPad + 3, qrY - qrPad + 3, qrContainerW - 6, qrContainerH - 6)
    
    // Draw QR code
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
    
    // === HEADER TEXT ===
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px "Arial", sans-serif'
    ctx.fillText('E-ATTENDANCE', contentX + 20, cardY + 35)
    
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '12px "Arial", sans-serif'
    ctx.fillText(eventLabel.toUpperCase(), contentX + 20, cardY + 58)
    
    // Brand on header right
    ctx.font = 'bold 11px "Arial", sans-serif'
    const brandText = '3oNs Digital'
    const brandWidth = ctx.measureText(brandText).width
    ctx.fillText(brandText, cardX + cardW - brandWidth - 30, cardY + 45)
    
    // === PARTICIPANT NAME ===
    const nameY = badgeY + badgeH + 35
    ctx.fillStyle = COLORS.textPrimary
    ctx.font = 'bold 28px "Arial", sans-serif'
    drawClampText(participant.name || '-', contentX, nameY, contentW - 20)
    
    // === COLORFUL INFO GRID ===
    const infoY = nameY + 60
    const colWidth = Math.floor((contentW - 40) / 3)
    const boxHeight = 75
    
    const infoBoxes = [
      { 
        label: 'ID TICKET', 
        value: String(participant.ticket_id || '-'),
        bg: '#ffe4e1',
        border: RAINBOW.red,
        text: '#c0392b'
      },
      { 
        label: 'DAY', 
        value: String(participant.day_number || '-'),
        bg: '#e8f8f5',
        border: RAINBOW.green,
        text: '#27ae60'
      },
      { 
        label: 'CATEGORY', 
        value: String(participant.category || '-'),
        bg: '#ebf5fb',
        border: RAINBOW.blue,
        text: '#2980b9'
      }
    ]
    
    infoBoxes.forEach((box, i) => {
      const boxX = contentX + (colWidth * i)

      // Box shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.1)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetY = 3
      fillRoundedRect(boxX + 2, infoY + 2, colWidth - 10, boxHeight, 10, 'rgba(0,0,0,0.05)')
      ctx.restore()

      // Box background with vibrant color
      fillRoundedRect(boxX, infoY, colWidth - 10, boxHeight, 10, box.bg)

      // Box border - colorful
      ctx.strokeStyle = box.border
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(boxX, infoY, colWidth - 10, boxHeight, 10)
      ctx.stroke()

      // Top colorful border
      ctx.fillStyle = box.border
      ctx.fillRect(boxX, infoY, colWidth - 10, 4)

      // Label - colorful
      ctx.fillStyle = box.text
      ctx.font = 'bold 11px "Arial", sans-serif'
      ctx.fillText(box.label, boxX + 12, infoY + 22)

      // Value
      ctx.fillStyle = '#2c3e50'
      ctx.font = 'bold 16px "Arial", sans-serif'
      drawClampText(box.value, boxX + 12, infoY + 48, colWidth - 28)
    })

    // === DIVIDER ===
    const dividerY = infoY + boxHeight + 35
    ctx.strokeStyle = COLORS.divider
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(contentX, dividerY)
    ctx.lineTo(contentX + contentW - 20, dividerY)
    ctx.stroke()
    
    // === FOOTER TEXT ===
    const footerY = dividerY + 25
    ctx.fillStyle = COLORS.textSecondary
    ctx.font = '15px "Arial", sans-serif'
    ctx.fillText('Tunjukkan kode QR ini kepada petugas registrasi', contentX, footerY)
    ctx.font = '13px "Arial", sans-serif'
    ctx.fillText('untuk melakukan absensi peserta', contentX, footerY + 22)
    
    // === DATE INFO BOX - 12 APRIL 2026 ===
    const dateBoxY = footerY + 35
    const dateBoxW = contentW - 20
    const dateBoxH = 36
    
    // Background gradasi lembut (putih ke warna kategori)
    const dateGrad = ctx.createLinearGradient(contentX, dateBoxY, contentX + dateBoxW, dateBoxY)
    dateGrad.addColorStop(0, '#ffffff')
    dateGrad.addColorStop(0.3, style.soft)
    dateGrad.addColorStop(1, style.soft)
    
    ctx.fillStyle = dateGrad
    ctx.beginPath()
    ctx.roundRect(contentX, dateBoxY, dateBoxW, dateBoxH, 8)
    ctx.fill()
    
    // Border lembut warna kategori
    ctx.strokeStyle = style.accentLight
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(contentX, dateBoxY, dateBoxW, dateBoxH, 8)
    ctx.stroke()
    
    // TANGGAL 12 APRIL 2026 (hardcode)
    const tl = getMetaValue(participant, 'Tanggal Lahir')
    const dateText = tl ? `${tl}` : '12 April 2026 - getActiveTenantId()'
    
    ctx.fillStyle = style.dark
    ctx.font = 'bold 12px "Arial", sans-serif'
    ctx.fillText('📅 ' + dateText, contentX + 12, dateBoxY + 22)
    
    // === QR FOOTER - POSISI PRESISI ===
    const qrFooterY = qrY + qrSize + qrPad + 8 // 8px di bawah QR code dalam container
    
    // Center text dalam QR container
    ctx.fillStyle = COLORS.textPrimary
    ctx.font = 'bold 14px "Arial", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Scan at entrance', qrX + qrSize/2, qrFooterY + 14)
    
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '11px "Arial", sans-serif'
    ctx.fillText('Keep screen bright', qrX + qrSize/2, qrFooterY + 30)
    ctx.textAlign = 'left' // Reset alignment
    
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
    } catch {
      toast.error('Gagal', 'Tidak bisa membuat preview tiket')
    }
  }

  // Handle successful manual send
  const handleManualSendSuccess = ({ participant }) => {
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

        {/* Search Input - Mobile */}
        <div className="m-search-container">
          <input
            type="text"
            className="m-search-input"
            placeholder="🔍 Cari peserta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="m-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        {/* Results Count - Mobile */}
        {searchQuery && (
          <div className="m-results-count">
            {filteredParticipants.length} dari {participants.length} peserta
          </div>
        )}

        {/* Participant List - Full Width */}
        <div className="m-card-list">
          {filteredParticipants.length === 0 ? (
            <div className="m-search-empty">
              <div className="m-search-empty-icon">🔍</div>
              <div className="m-search-empty-text">
                {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Tidak ada peserta'}
              </div>
              {searchQuery && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSearchQuery('')}>
                  Hapus Pencarian
                </button>
              )}
            </div>
          ) : filteredParticipants.map((p, index) => (
            <div key={p.id} className="m-participant-card-v2" onClick={() => generateQR(p)}>
              {/* Row 1: Number + Avatar + Main Info */}
              <div className="m-card-row-main">
                <div className="m-card-number">{index + 1}</div>
                <div className={`m-card-avatar ${getCategoryToneClass(p.category)}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="m-card-info">
                  <div className="m-card-name-row">
                    <span className="m-card-name">{p.name}</span>
                    {p.qr_locked && (
                      <span className="m-card-status">
                        <span className="status-dot"></span>
                      </span>
                    )}
                  </div>
                  <div className="m-card-subtitle">
                    <span className={`m-card-badge badge-${p.category === 'VIP' ? 'red' : p.category === 'Dealer' ? 'blue' : p.category === 'Media' ? 'yellow' : 'green'}`}>
                      {p.category}
                    </span>
                    <span className="m-card-ticket">{p.ticket_id}</span>
                    {p.phone && (
                      <span className="m-card-phone">📞 {p.phone}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Row 2: Action Buttons */}
              <div className="m-card-actions">
                <button
                  className="m-card-btn m-card-btn-send"
                  onClick={(e) => { e.stopPropagation(); openManualSend(p) }}
                  title="Kirim Manual"
                >
                  <Send size={14} />
                  <span>Kirim</span>
                </button>
                <button
                  className="m-card-btn m-card-btn-wa"
                  onClick={(e) => { e.stopPropagation(); shareViaWhatsApp(p) }}
                  title="WhatsApp"
                >
                  <MessageCircle size={14} />
                  <span>WA</span>
                </button>
                <button
                  className="m-card-btn m-card-btn-download"
                  onClick={(e) => { e.stopPropagation(); downloadQR(p) }}
                  title="Download"
                >
                  <Download size={14} />
                  <span>Simpan</span>
                </button>
              </div>
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
          tenantId="getActiveTenantId()"
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
              <option value={1}>Hari 1 ({dayCounts[1]} peserta)</option>
              <option value={2}>Hari 2 ({dayCounts[2]} peserta)</option>
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
                <span className="badge badge-red">
                  {searchQuery ? `${filteredParticipants.length}/${participants.length}` : participants.length}
                </span>
              </div>
              
              {/* Search Input */}
              <div className="qr-search-container">
                <input
                  type="text"
                  className="qr-search-input"
                  placeholder="🔍 Cari nama, tiket, telepon, atau kategori..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    className="qr-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <div className="qr-list-professional">
                {filteredParticipants.length === 0 ? (
                  <div className="qr-search-empty">
                    <div className="qr-search-empty-icon">🔍</div>
                    <div className="qr-search-empty-text">Tidak ada peserta yang cocok dengan "{searchQuery}"</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSearchQuery('')}>
                      Hapus Pencarian
                    </button>
                  </div>
                ) : filteredParticipants.map((p, index) => (
                  <div 
                    key={p.id} 
                    onClick={() => generateQR(p)} 
                    className={`qr-item-pro ${selectedParticipant?.id === p.id ? 'is-selected' : ''} ${p.qr_locked ? 'is-sent' : ''}`}
                  >
                    <div className="qr-item-main">
                      <div className="qr-item-number">{index + 1}</div>
                      <div className="qr-item-avatar" style={{ background: getCategoryColor(p.category) }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="qr-item-info">
                        <div className="qr-item-header">
                          <span className="qr-item-name">{p.name}</span>
                          <span className={`qr-item-badge badge-${p.category?.toLowerCase() || 'default'}`}>
                            {p.category}
                          </span>
                        </div>
                        <div className="qr-item-details">
                          <span className="qr-item-ticket">{p.ticket_id}</span>
                          {p.phone && (
                            <span className="qr-item-phone">
                              <span className="qr-phone-icon">📞</span>
                              {p.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="qr-item-actions">
                      {p.qr_locked && (
                        <span className="qr-status-sent">
                          <span className="status-dot"></span>
                          Terkirim
                        </span>
                      )}
                      <button 
                        className="btn btn-ghost btn-sm qr-btn" 
                        onClick={(e) => { e.stopPropagation(); openManualSend(p) }} 
                        title="Kirim Manual"
                      >
                        <Send size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-whatsapp btn-sm qr-btn" 
                        onClick={(e) => { e.stopPropagation(); shareViaWhatsApp(p) }} 
                        title="Share via WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm qr-btn qr-btn-primary" 
                        onClick={(e) => { e.stopPropagation(); downloadQR(p) }} 
                        title="Download tiket"
                      >
                        <Download size={14} />
                      </button>
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
        tenantId="getActiveTenantId()"
      />
    </div>
  )
}
