// ticket-image-jimp.js
// Stable renderer for WhatsApp ticket image (avoids canvas runtime variance)
const Jimp = require('jimp')
const QRCode = require('qrcode')

const CATEGORY_STYLES = {
  VIP: { accent: '#b91c1c', soft: '#fdecea', dark: '#7f1d1d', label: 'VIP' },
  Dealer: { accent: '#1d4ed8', soft: '#e8f1ff', dark: '#1e3a8a', label: 'DEALER' },
  Media: { accent: '#ca8a04', soft: '#fff8e1', dark: '#854d0e', label: 'MEDIA' },
  Regular: { accent: '#15803d', soft: '#eaf7ee', dark: '#14532d', label: 'REGULAR' }
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
  const width = Number(options.width || 900)
  const height = Number(options.height || 540)
  const qrSize = Number(options.qrSize || 320)
  const eventLabel = String(options.eventLabel || 'Event Platform').trim() || 'Event Platform'
  const brandLabel = String(options.brandLabel || '3oNs Digital').trim() || '3oNs Digital'
  const categoryLabel = normalizeCategory(participant?.category)
  const style = resolveStyle(categoryLabel)

  const image = new Jimp(width, height, '#f3f6fb')
  const safeX = 20
  const safeY = 20
  const safeW = width - 40
  const safeH = height - 40

  // Outer card with shadow effect
  await fillRect(image, safeX, safeY, safeW, safeH, '#ffffff')
  await fillRect(image, safeX, safeY, safeW, 2, '#dfe6ef')  // top border
  await fillRect(image, safeX, safeY + safeH - 2, safeW, 2, '#dfe6ef')  // bottom border
  await fillRect(image, safeX, safeY, 2, safeH, '#dfe6ef')  // left border
  await fillRect(image, safeX + safeW - 2, safeY, 2, safeH, '#dfe6ef')  // right border
  await fillRect(image, safeX + 10, safeY + 10, safeW - 20, safeH - 20, '#ffffff')  // inner area

  // Top gradient strip (kategori color based)
  const stripH = 24
  await fillRect(image, safeX + 8, safeY + 8, Math.round((safeW - 16) * 0.5), stripH, style.accent)
  await fillRect(image, safeX + 8 + Math.round((safeW - 16) * 0.5), safeY + 8, Math.round((safeW - 16) * 0.35), stripH, '#4da6e8')
  await fillRect(image, safeX + 8 + Math.round((safeW - 16) * 0.85), safeY + 8, Math.round((safeW - 16) * 0.15), stripH, '#e84393')
  
  // Decorative ribbon on right top
  await fillRect(image, safeX + safeW - 190, safeY + 14, 170, 78, style.soft)

  const qrX = safeX + safeW - qrSize - 56
  const qrY = safeY + 88
  const leftX = safeX + 20
  const leftY = safeY + 34
  const leftW = qrX - leftX - 18
  const leftH = safeY + safeH - leftY - 20

  // Panel informasi kiri
  await fillRect(image, leftX, leftY, leftW, leftH, '#ffffff')
  await fillRect(image, leftX, leftY, leftW, 2, '#edf0f6')  // top
  await fillRect(image, leftX, leftY + leftH - 2, leftW, 2, '#edf0f6')  // bottom
  await fillRect(image, leftX, leftY, 2, leftH, '#edf0f6')  // left
  await fillRect(image, leftX + leftW - 2, leftY, 2, leftH, '#edf0f6')  // right

  // Panel QR with category color border
  await fillRect(image, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, '#ffffff')
  await fillRect(image, qrX - 18, qrY - 18, qrSize + 36, 4, style.accent)  // top border
  await fillRect(image, qrX - 18, qrY + qrSize + 14, qrSize + 36, 4, style.accent)  // bottom border
  await fillRect(image, qrX - 18, qrY - 16, 4, qrSize + 32, style.accent)  // left border
  await fillRect(image, qrX + qrSize + 14, qrY - 16, 4, qrSize + 32, style.accent)  // right border

  // Perforation line
  for (let i = safeY + 56; i < safeY + safeH - 28; i += 12) {
    await fillRect(image, qrX - 32, i, 2, 4, '#e5e7eb')
  }

  const qrBuffer = await QRCode.toBuffer(String(participant?.qr_data || '-'), {
    margin: 3,
    width: qrSize,
    color: { dark: '#111111', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  })
  const qrImage = await Jimp.read(qrBuffer)
  image.composite(qrImage, qrX, qrY)

  // Load fonts
  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)
  const fontBody = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK)
  const fontBold = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
  const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)

  // Header - E-Attendance (sama seperti QRGenerate.jsx)
  image.print(fontLarge, leftX + 22, leftY + 40, 'E-Attendance')
  printClamp(image, fontBody, eventLabel || 'PALEMBANG VIOLIN COMPETITION', leftX + 22, leftY + 80, leftW - 44)
  printClamp(image, fontSmall, (brandLabel || 'Official Event').toUpperCase(), leftX + 22, leftY + 102, leftW - 44)

  // Elegant category badge (sama seperti QRGenerate.jsx)
  await fillRect(image, leftX + 22, leftY + 120, 160, 38, style.accent)
  printClamp(image, fontBody, String(categoryLabel).toUpperCase(), leftX + 32, leftY + 142, 140)

  // Participant name
  printClamp(image, fontTitle, String(participant?.name || '-'), leftX + 22, leftY + 190, leftW - 44)

  // Info Grid - ID TICKET, DAY, CATEGORY (sama seperti QRGenerate.jsx)
  const infoY = leftY + 242
  const colWidth = Math.round((leftW - 44) / 3)

  // Labels
  image.print(fontSmall, leftX + 22, infoY, 'ID TICKET')
  image.print(fontSmall, leftX + 22 + colWidth, infoY, 'DAY')
  image.print(fontSmall, leftX + 22 + colWidth * 2, infoY, 'CATEGORY')

  // Values
  image.print(fontBold, leftX + 22, infoY + 18, String(participant?.ticket_id || '-'))
  image.print(fontBold, leftX + 22 + colWidth, infoY + 18, String(participant?.day_number || '-'))
  printClamp(image, fontBold, String(participant?.category || categoryLabel || '-'), leftX + 22 + colWidth * 2, infoY + 18, colWidth - 10)

  // Divider before footer
  await fillRect(image, leftX + 22, leftY + leftH - 80, leftW - 44, 2, '#e5e7eb')

  // Footer instruction (sama seperti QRGenerate.jsx)
  image.print(fontBody, leftX + 22, leftY + leftH - 60, 'Tunjukkan kode QR ini untuk registrasi absensi peserta')
  const dob = getMetaValue(participant, 'Tanggal Lahir')
  image.print(
    fontSmall,
    leftX + 22,
    leftY + leftH - 40,
    dob ? `${dob}` : '11 April 2026 - Primavera Production'
  )

  // QR Footer (sama seperti QRGenerate.jsx)
  image.print(fontBody, qrX + 24, qrY + qrSize + 30, 'Scan at entrance')
  image.print(fontSmall, qrX + 24, qrY + qrSize + 50, 'Keep screen bright for quick scan')

  return image.getBufferAsync(Jimp.MIME_PNG)
}

module.exports = { buildTicketQrImageNode }

