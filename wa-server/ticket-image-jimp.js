// ticket-image-jimp.js
// Stable renderer for WhatsApp ticket image (avoids canvas runtime variance)
const Jimp = require('jimp')
const QRCode = require('qrcode')

// VIBRANT Full Color Palette - Anti Monoton!
const CATEGORY_STYLES = {
  VIP: { 
    accent: '#e74c3c', 
    accentLight: '#ff7979',
    soft: '#ffe4e1', 
    dark: '#c0392b', 
    gradient: ['#c0392b', '#e74c3c', '#ff6b6b', '#ff9f9f'],
    label: 'VIP'
  },
  Dealer: { 
    accent: '#3498db', 
    accentLight: '#74b9ff',
    soft: '#dff9fb', 
    dark: '#2980b9', 
    gradient: ['#2980b9', '#3498db', '#5dade2', '#85c1e9'],
    label: 'DEALER'
  },
  Media: { 
    accent: '#f39c12', 
    accentLight: '#f9ca24',
    soft: '#fff9c4', 
    dark: '#d68910', 
    gradient: ['#d68910', '#f39c12', '#f5b041', '#f8c471'],
    label: 'MEDIA'
  },
  Regular: { 
    accent: '#27ae60', 
    accentLight: '#55efc4',
    soft: '#e8f8f5', 
    dark: '#1e8449', 
    gradient: ['#1e8449', '#27ae60', '#58d68d', '#82e0aa'],
    label: 'REGULAR'
  }
}

// CLEAN Color Scheme - Putih dengan gradasi lembut
const COLORS = {
  background: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '#e8e8e8',
  textPrimary: '#2d3436',
  textSecondary: '#636e72',
  textMuted: '#b2bec3',
  accentRed: '#e74c3c',
  accentBlue: '#3498db',
  accentGreen: '#27ae60',
  accentOrange: '#f39c12',
  accentPink: '#fd79a8',
  accentPurple: '#9b59b6',
  accentCyan: '#00cec9',
  accentYellow: '#fdcb6e',
  divider: '#dfe6e9',
  shadow: 'rgba(0, 0, 0, 0.08)'
}

// Rainbow colors for maximum vibrancy
const RAINBOW = {
  red: '#ff6b6b',
  orange: '#ffa502',
  yellow: '#f9ca24',
  green: '#6ab04c',
  blue: '#4834d4',
  indigo: '#686de0',
  violet: '#be2edd',
  pink: '#ff7979',
  cyan: '#22a6b3',
  teal: '#1dd1a1'
}

function normalizeCategory(category) {
  const raw = String(category || '').trim()
  if (!raw) return 'Regular'
  const key = Object.keys(CATEGORY_STYLES).find(k => k.toLowerCase() === raw.toLowerCase())
  return key || raw
}

function resolveStyle(category) {
  const normalized = normalizeCategory(category)
  return CATEGORY_STYLES[normalized] || CATEGORY_STYLES.Regular
}

function normalizeMetaKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function getMetaValue(participant, wantedLabel) {
  const meta = participant?.meta && typeof participant.meta === 'object' ? participant.meta : {}
  const target = normalizeMetaKey(wantedLabel)
  const foundKey = Object.keys(meta).find(k => normalizeMetaKey(k) === target)
  if (!foundKey) return ''
  const value = meta[foundKey]
  return value === undefined || value === null ? '' : String(value)
}

async function fillRect(image, x, y, w, h, color) {
  const block = new Jimp(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), color)
  image.composite(block, Math.round(x), Math.round(y))
}

function printClamp(image, font, text, x, y, maxWidth) {
  const value = String(text || '-')
  if (Jimp.measureText(font, value) <= maxWidth) {
    image.print(font, x, y, value)
    return
  }
  let clipped = value
  while (clipped.length > 0 && Jimp.measureText(font, `${clipped}...`) > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  image.print(font, x, y, `${clipped}...`)
}

async function buildTicketQrImageNode(participant, options = {}) {
  try {
  const width = Number(options.width || 1000)
  const height = Number(options.height || 600)
  const qrSize = Number(options.qrSize || 340)
  const eventLabel = String(options.eventLabel || 'PALEMBANG VIOLIN & PIANO COMPETITION').trim() || 'Event Platform'
  // Brand label sudah digabung dengan eventLabel
  const categoryLabel = normalizeCategory(participant?.category)
  const style = resolveStyle(categoryLabel)

  console.log(`[TICKET-IMAGE] Starting generation for ${participant?.name}, category=${categoryLabel}`)

  // Create main image dengan background putih bersih
  const image = new Jimp(width, height, '#ffffff')
  
  // Margins and dimensions
  const margin = 30
  const cardX = margin
  const cardY = margin
  const cardW = width - margin * 2
  const cardH = height - margin * 2

  // === CARD DENGAN SHADOW RAPI ===
  // Shadow layer (lebih rapi)
  for (let i = 4; i >= 0; i--) {
    const alpha = String(8 - i).padStart(2, '0')
    await fillRect(image, cardX + i, cardY + i + 2, cardW, cardH, `#000000${alpha}`)
  }
  
  // Main card putih
  await fillRect(image, cardX, cardY, cardW, cardH, '#ffffff')
  
  // === HEADER SOLID COLOR ===
  const headerH = 80
  // Header dengan warna solid (tidak gradient) agar lebih rapi
  await fillRect(image, cardX, cardY, cardW, headerH, style.accent)
  
  // Garis aksen bawah header (solid)
  await fillRect(image, cardX, cardY + headerH - 3, cardW, 3, style.dark)
  
  // === LEFT CONTENT AREA ===
  const contentX = cardX + 40
  const contentY = cardY + headerH + 30
  const contentW = cardW - qrSize - 140
  // Content area height sudah ter-cover oleh layout

  // === RIGHT QR AREA ===
  const qrX = cardX + cardW - qrSize - 50
  const qrY = cardY + headerH + 40

  // === CATEGORY BADGE (Floating) ===
  const badgeW = 180
  const badgeH = 45
  const badgeX = contentX
  const badgeY = contentY
  
  // Badge shadow
  await fillRect(image, badgeX + 3, badgeY + 3, badgeW, badgeH, '#00000015')
  // Badge background
  await fillRect(image, badgeX, badgeY, badgeW, badgeH, style.accent)
  // Badge highlight
  await fillRect(image, badgeX, badgeY, badgeW, 3, style.accentLight)

  // === QR CODE SECTION ===
  // QR Container with elegant border
  const qrContainerPad = 20
  const qrContainerW = qrSize + qrContainerPad * 2
  const qrContainerH = qrSize + qrContainerPad * 2 + 60 // Extra for text
  
  // QR container background
  await fillRect(image, qrX - qrContainerPad, qrY - qrContainerPad, qrContainerW, qrContainerH, '#ffffff')
  
  // QR container border with gradient effect
  const borderThickness = 4
  await fillRect(image, qrX - qrContainerPad, qrY - qrContainerPad, qrContainerW, borderThickness, style.accent)
  await fillRect(image, qrX - qrContainerPad, qrY - qrContainerPad + qrContainerH - borderThickness, qrContainerW, borderThickness, style.accent)
  await fillRect(image, qrX - qrContainerPad, qrY - qrContainerPad, borderThickness, qrContainerH, style.accent)
  await fillRect(image, qrX - qrContainerPad + qrContainerW - borderThickness, qrY - qrContainerPad, borderThickness, qrContainerH, style.accent)
  
  // Corner accents
  const cornerSize = 12
  await fillRect(image, qrX - qrContainerPad - 2, qrY - qrContainerPad - 2, cornerSize, cornerSize, style.accent)
  await fillRect(image, qrX + qrSize + qrContainerPad - cornerSize + 2, qrY - qrContainerPad - 2, cornerSize, cornerSize, style.accent)
  await fillRect(image, qrX - qrContainerPad - 2, qrY + qrSize + qrContainerPad - cornerSize + 2, cornerSize, cornerSize, style.accent)
  await fillRect(image, qrX + qrSize + qrContainerPad - cornerSize + 2, qrY + qrSize + qrContainerPad - cornerSize + 2, cornerSize, cornerSize, style.accent)

  // Generate and place QR code
  const qrBuffer = await QRCode.toBuffer(String(participant?.qr_data || '-'), {
    margin: 2,
    width: qrSize,
    color: { dark: '#1e293b', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  })
  const qrImage = await Jimp.read(qrBuffer)
  image.composite(qrImage, qrX, qrY)

  // === LOAD FONTS ===
  // Font yang tersedia di Jimp: 8, 10, 12, 14, 16, 32, 64 (TIDAK ADA 24!)
  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)
  const fontSubtitle = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK) // Ganti 24 ke 32
  const fontBody = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK)
  const fontBold = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)

  // === HEADER TEXT (on gradient) ===
  // Event title on header
  image.print(fontSubtitle, contentX + 20, cardY + 20, 'E-ATTENDANCE')
  image.print(fontSmall, contentX + 20, cardY + 50, eventLabel.toUpperCase())
  
  // Brand on right of header
  const brandText = '3oNs Digital'
  const brandWidth = Jimp.measureText(fontSmall, brandText)
  image.print(fontSmall, cardX + cardW - brandWidth - 30, cardY + 30, brandText)

  // === CATEGORY BADGE TEXT ===
  const badgeText = String(categoryLabel).toUpperCase()
  const badgeTextWidth = Jimp.measureText(fontBold, badgeText)
  image.print(fontBold, badgeX + (badgeW - badgeTextWidth) / 2, badgeY + 14, badgeText)

  // === PARTICIPANT NAME (Large, prominent) ===
  const nameY = badgeY + badgeH + 30
  printClamp(image, fontTitle, String(participant?.name || '-'), contentX, nameY, contentW - 20)

  // === COLORFUL INFO GRID ===
  const infoY = nameY + 60
  const colWidth = Math.floor((contentW - 40) / 3)
  const boxHeight = 75
  
  // Info boxes dengan warna-warna berbeda (anti monoton!)
  const infoBoxes = [
    { 
      label: 'ID TICKET', 
      value: String(participant?.ticket_id || '-'),
      bg: '#ffe4e1',
      border: RAINBOW.red,
      text: '#c0392b'
    },
    { 
      label: 'DAY', 
      value: String(participant?.day_number || '-'),
      bg: '#e8f8f5',
      border: RAINBOW.green,
      text: '#27ae60'
    },
    { 
      label: 'CATEGORY', 
      value: String(participant?.category || categoryLabel || '-'),
      bg: '#ebf5fb',
      border: RAINBOW.blue,
      text: '#2980b9'
    }
  ]
  
  for (let i = 0; i < infoBoxes.length; i++) {
    const boxX = contentX + (colWidth * i)
    const box = infoBoxes[i]
    
    // Box shadow
    await fillRect(image, boxX + 2, infoY + 2, colWidth - 10, boxHeight, '#00000008')
    
    // Box background dengan vibrant color
    await fillRect(image, boxX, infoY, colWidth - 10, boxHeight, box.bg)
    
    // Box border - colorful top
    await fillRect(image, boxX, infoY, colWidth - 10, 4, box.border)
    
    // Label dengan warna yang sesuai
    image.print(fontSmall, boxX + 12, infoY + 15, box.label)
    
    // Value
    printClamp(image, fontBold, box.value, boxX + 12, infoY + 42, colWidth - 28)
  }

  // === DIVIDER LINE ===
  const dividerY = infoY + boxHeight + 40
  await fillRect(image, contentX, dividerY, contentW - 20, 2, COLORS.divider)

  // === INSTRUCTION TEXT ===
  const footerY = dividerY + 25
  image.print(fontBody, contentX, footerY, 'Tunjukkan kode QR ini kepada petugas registrasi')
  image.print(fontSmall, contentX, footerY + 25, 'untuk melakukan absensi peserta')

  // === DATE INFO - 12 APRIL 2026 ===
  const dob = getMetaValue(participant, 'Tanggal Lahir')
  const dateText = dob ? `${dob}` : '12 April 2026 - Primavera Production'
  
  // Date box dengan gradasi lembut
  const dateBoxY = footerY + 60
  const dateBoxW = contentW - 20
  const dateBoxH = 34
  
  // Background gradasi (putih ke warna kategori)
  await fillRect(image, contentX, dateBoxY, dateBoxW, dateBoxH, '#ffffff')
  await fillRect(image, contentX, dateBoxY, dateBoxW * 0.7, dateBoxH, style.soft)
  
  // Border lembut
  await fillRect(image, contentX, dateBoxY, dateBoxW, 2, style.accentLight)
  
  // Date text
  image.print(fontSmall, contentX + 12, dateBoxY + 21, '* ' + dateText)

  // === QR FOOTER TEXT - PRESISI ===
  const qrPad = 16
  const qrFooterY = qrY + qrSize + qrPad + 10
  
  // Center text dalam QR area
  const qrAreaCenter = qrX + qrSize/2
  const text1 = 'Scan at entrance'
  const text1Width = Jimp.measureText(fontBody, text1)
  image.print(fontBody, qrAreaCenter - text1Width/2, qrFooterY, text1)
  
  const text2 = 'Keep screen bright'
  const text2Width = Jimp.measureText(fontSmall, text2)
  image.print(fontSmall, qrAreaCenter - text2Width/2, qrFooterY + 20, text2)

  const buffer = await image.getBufferAsync(Jimp.MIME_PNG)
  console.log(`[TICKET-IMAGE] Generated buffer size=${buffer.length}`)
  return buffer
  } catch (err) {
    console.error(`[TICKET-IMAGE] Error:`, err.message)
    console.error(`[TICKET-IMAGE] Stack:`, err.stack)
    throw err
  }
}

module.exports = { buildTicketQrImageNode }

