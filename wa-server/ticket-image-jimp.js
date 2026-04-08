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
  const qrSize = Number(options.qrSize || 300)
  const eventLabel = String(options.eventLabel || 'Event Platform').trim() || 'Event Platform'
  const brandLabel = String(options.brandLabel || '3oNs Digital').trim() || '3oNs Digital'
  const categoryLabel = normalizeCategory(participant?.category)
  resolveStyle(categoryLabel)

  const image = new Jimp(width, height, '#f3f6fb')
  const safeX = 20
  const safeY = 20
  const safeW = width - 40
  const safeH = height - 40

  // Outer card
  await fillRect(image, safeX, safeY, safeW, safeH, '#ffffff')
  await fillRect(image, safeX - 1, safeY - 1, safeW + 2, 1, '#dbe4ef')
  await fillRect(image, safeX - 1, safeY + safeH, safeW + 2, 1, '#dbe4ef')
  await fillRect(image, safeX - 1, safeY, 1, safeH, '#dbe4ef')
  await fillRect(image, safeX + safeW, safeY, 1, safeH, '#dbe4ef')

  // Top gradient strip (built from segments for Jimp)
  const stripY = safeY + 8
  const stripH = 12
  await fillRect(image, safeX + 8, stripY, Math.round((safeW - 16) * 0.42), stripH, '#22c55e')
  await fillRect(image, safeX + 8 + Math.round((safeW - 16) * 0.42), stripY, Math.round((safeW - 16) * 0.38), stripH, '#38bdf8')
  await fillRect(image, safeX + 8 + Math.round((safeW - 16) * 0.8), stripY, Math.round((safeW - 16) * 0.2), stripH, '#ec4899')
  // Light decorative corner on right top
  await fillRect(image, safeX + safeW - 160, safeY + 22, 150, 36, '#eef2ff')

  const qrX = safeX + safeW - qrSize - 56
  const qrY = safeY + 88
  const leftX = safeX + 20
  const leftY = safeY + 34
  const leftW = qrX - leftX - 18
  const leftH = safeY + safeH - leftY - 20

  await fillRect(image, leftX, leftY, leftW, leftH, '#fbfdff')
  await fillRect(image, leftX - 1, leftY - 1, leftW + 2, 1, '#dbe4ef')
  await fillRect(image, leftX - 1, leftY + leftH, leftW + 2, 1, '#dbe4ef')
  await fillRect(image, leftX - 1, leftY, 1, leftH, '#dbe4ef')
  await fillRect(image, leftX + leftW, leftY, 1, leftH, '#dbe4ef')

  await fillRect(image, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, '#eff6ff')
  await fillRect(image, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, '#ffffff')
  await fillRect(image, qrX - 18, qrY - 18, qrSize + 36, 2, '#16a34a')
  await fillRect(image, qrX - 18, qrY + qrSize + 16, qrSize + 36, 2, '#16a34a')
  await fillRect(image, qrX - 18, qrY - 16, 2, qrSize + 32, '#16a34a')
  await fillRect(image, qrX + qrSize + 16, qrY - 16, 2, qrSize + 32, '#16a34a')

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

  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)
  const fontBody = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK)

  image.print(fontTitle, leftX + 22, leftY + 20, 'E-TICKET')
  printClamp(image, fontSmall, eventLabel, leftX + 22, leftY + 62, leftW - 44)
  printClamp(image, fontSmall, brandLabel.toUpperCase(), leftX + 22, leftY + 82, leftW - 44)

  await fillRect(image, leftX + 22, leftY + 112, 150, 36, '#ecfdf5')
  await fillRect(image, leftX + 22, leftY + 112, 150, 2, '#16a34a')
  await fillRect(image, leftX + 22, leftY + 146, 150, 2, '#16a34a')
  await fillRect(image, leftX + 22, leftY + 112, 2, 36, '#16a34a')
  await fillRect(image, leftX + 170, leftY + 112, 2, 36, '#16a34a')
  printClamp(image, fontSmall, categoryLabel, leftX + 34, leftY + 121, 130)

  printClamp(image, fontBody, String(participant?.name || '-'), leftX + 22, leftY + 172, leftW - 44)
  image.print(fontSmall, leftX + 22, leftY + 204, 'ID TIKET')
  image.print(fontBody, leftX + 22, leftY + 220, String(participant?.ticket_id || '-'))
  image.print(fontSmall, leftX + 22, leftY + 248, 'HARI')
  image.print(fontBody, leftX + 22, leftY + 264, String(participant?.day_number || '-'))

  await fillRect(image, leftX + 22, leftY + leftH - 76, leftW - 44, 1, '#e2e8f0')
  image.print(fontSmall, leftX + 22, leftY + leftH - 60, 'Valid untuk 1 orang. Dilarang duplikasi tiket.')
  const dob = getMetaValue(participant, 'Tanggal Lahir')
  image.print(
    fontSmall,
    leftX + 22,
    leftY + leftH - 40,
    dob ? `Tanggal Lahir: ${dob}` : 'Tunjukkan tiket ini saat registrasi di pintu masuk.'
  )

  image.print(fontBody, qrX + 30, qrY + qrSize + 18, 'Scan QR di pintu masuk')
  image.print(fontSmall, qrX + 20, qrY + qrSize + 40, 'Jaga layar tetap terang untuk scan cepat')

  return image.getBufferAsync(Jimp.MIME_PNG)
}

module.exports = { buildTicketQrImageNode }

