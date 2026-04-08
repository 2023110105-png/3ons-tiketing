// ticket-image-jimp.js
// Stable renderer for WhatsApp ticket image (avoids canvas runtime variance)
const Jimp = require('jimp')
const QRCode = require('qrcode')

const CATEGORY_COLORS = {
  VIP: '#b91c1c',
  Dealer: '#1d4ed8',
  Media: '#ca8a04',
  Regular: '#15803d'
}

function normalizeCategory(category) {
  const raw = String(category || '').trim()
  if (!raw) return 'Regular'
  const key = Object.keys(CATEGORY_COLORS).find(k => k.toLowerCase() === raw.toLowerCase())
  return key || raw
}

function colorForCategory(category) {
  const normalized = normalizeCategory(category)
  return CATEGORY_COLORS[normalized] || CATEGORY_COLORS.Regular
}

async function buildTicketQrImageNode(participant, options = {}) {
  const width = Number(options.width || 900)
  const height = Number(options.height || 540)
  const qrSize = Number(options.qrSize || 300)
  const eventLabel = String(options.eventLabel || 'Event Platform').trim() || 'Event Platform'
  const brandLabel = String(options.brandLabel || '3oNs Digital').trim() || '3oNs Digital'
  const categoryLabel = normalizeCategory(participant?.category)
  const accent = colorForCategory(categoryLabel)

  // Base layers
  const image = new Jimp(width, height, '#f8fafc')
  const card = new Jimp(width - 40, height - 40, '#ffffff')
  image.composite(card, 20, 20)

  const topBar = new Jimp(width - 40, 18, accent)
  image.composite(topBar, 20, 20)

  // QR block
  const qrBuffer = await QRCode.toBuffer(String(participant?.qr_data || '-'), {
    margin: 2,
    width: qrSize,
    color: { dark: '#111111', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  })
  const qrImage = await Jimp.read(qrBuffer)
  const qrX = width - qrSize - 70
  const qrY = 110

  const qrFrame = new Jimp(qrSize + 26, qrSize + 26, '#ffffff')
  image.composite(qrFrame, qrX - 13, qrY - 13)
  image.composite(qrImage, qrX, qrY)

  // Fonts
  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)
  const fontBody = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK)

  // Text block
  image.print(fontTitle, 52, 56, 'E-TICKET')
  image.print(fontSmall, 52, 96, `${brandLabel} • ${eventLabel}`)
  image.print(fontBody, 52, 148, `Nama: ${String(participant?.name || '-')}`)
  image.print(fontBody, 52, 184, `Ticket ID: ${String(participant?.ticket_id || '-')}`)
  image.print(fontBody, 52, 220, `Hari: ${String(participant?.day_number || '-')}`)
  image.print(fontBody, 52, 256, `Kategori: ${categoryLabel}`)
  image.print(fontSmall, 52, 312, 'Tunjukkan tiket ini saat registrasi di lokasi acara.')
  image.print(fontSmall, 52, 334, 'Jangan bagikan QR ke pihak lain.')
  image.print(fontSmall, qrX, qrY + qrSize + 18, 'SCAN DI GERBANG')

  // Marker to verify latest renderer version in production
  const marker = new Jimp(140, 28, '#ef4444')
  image.composite(marker, width - 190, 52)
  image.print(fontSmall, width - 178, 58, 'DESIGN V3')

  return image.getBufferAsync(Jimp.MIME_PNG)
}

module.exports = { buildTicketQrImageNode }

