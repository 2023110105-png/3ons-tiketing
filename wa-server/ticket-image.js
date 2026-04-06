// ticket-image.js
// Node.js: Generate e-ticket image with QR and details (for WhatsApp attachment)
const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');

const CATEGORY_STYLES = {
  VIP: { accent: '#b91c1c', soft: '#fdecea', dark: '#7f1d1d', label: 'VIP' },
  Dealer: { accent: '#1d4ed8', soft: '#e8f1ff', dark: '#1e3a8a', label: 'DEALER' },
  Media: { accent: '#ca8a04', soft: '#fff8e1', dark: '#854d0e', label: 'MEDIA' },
  Regular: { accent: '#15803d', soft: '#eaf7ee', dark: '#14532d', label: 'REGULAR' }
};

async function buildTicketQrImageNode(participant, options = {}) {
  const width = options.width || 900;
  const height = options.height || 540;
  const qrSize = options.qrSize || 320;
  const style = CATEGORY_STYLES[participant.category] || CATEGORY_STYLES.Regular;
  const eventLabel = String(options.eventLabel || 'Event').trim();
  const brandLabel = String(options.brandLabel || '3oNs Digital').trim();

  // Generate QR code as DataURL
  const qrDataUrl = await QRCode.toDataURL(participant.qr_data, {
    width: 640,
    margin: 3,
    color: { dark: '#111111', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
  const qrImage = await loadImage(qrDataUrl);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#fffefb');
  bg.addColorStop(1, '#f8fbff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Outer frame
  ctx.strokeStyle = '#d8dce7';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.strokeStyle = '#eef2f7';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Top accent
  ctx.fillStyle = style.accent;
  ctx.fillRect(12, 12, width - 24, 20);

  // Right ribbon
  ctx.fillStyle = style.accent + '20';
  ctx.beginPath();
  ctx.moveTo(width - 190, 32);
  ctx.lineTo(width - 24, 32);
  ctx.lineTo(width - 24, 98);
  ctx.closePath();
  ctx.fill();

  // Left info panel
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(42, 56, width - qrSize - 110, height - 96);
  ctx.strokeStyle = '#edf0f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 56, width - qrSize - 110, height - 96);

  // QR panel
  const qrX = width - qrSize - 58;
  const qrY = 100;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
  ctx.strokeStyle = style.accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Header text
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 44px Arial';
  ctx.fillText('E-TICKET', 64, 114);

  ctx.fillStyle = '#475569';
  ctx.font = '600 21px Arial';
  drawClampText(ctx, eventLabel || 'Event Pass', 64, 146, width - qrSize - 170);

  // Brand
  ctx.fillStyle = '#64748b';
  ctx.font = '700 13px Arial';
  drawClampText(ctx, (brandLabel || '3oNs Digital').toUpperCase(), 64, 166, width - qrSize - 170);

  // Category badge
  ctx.fillStyle = style.soft;
  ctx.fillRect(64, 184, 198, 44);
  ctx.strokeStyle = style.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 184, 198, 44);
  ctx.fillStyle = style.dark;
  ctx.font = '800 20px Arial';
  ctx.fillText(style.label, 84, 214);

  // Participant details
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 30px Arial';
  drawClampText(ctx, participant.name || '-', 64, 276, width - qrSize - 170);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 14px Arial';
  ctx.fillText('ID TIKET', 64, 316);
  ctx.fillText('HARI', 64, 358);
  ctx.fillText('KATEGORI', 64, 400);

  ctx.fillStyle = '#1e293b';
  ctx.font = '700 24px Arial';
  ctx.fillText(participant.ticket_id, 64, 340);
  ctx.fillText(String(participant.day_number), 64, 382);
  ctx.fillText(style.label, 64, 424);

  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 442);
  ctx.lineTo(width - qrSize - 84, 442);
  ctx.stroke();

  // Footer notes
  ctx.fillStyle = '#334155';
  ctx.font = '700 14px Arial';
  ctx.fillText('Valid untuk 1 orang. Dilarang duplikasi tiket.', 64, 468);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 13px Arial';
  ctx.fillText('Tunjukkan tiket ini saat registrasi di pintu masuk.', 64, 490);

  // Scan note
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 16px Arial';
  ctx.fillText('Scan QR di pintu masuk', qrX + 40, qrY + qrSize + 42);

  return canvas.toBuffer('image/png');
}

function drawClampText(ctx, text, x, y, maxWidth) {
  const value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let clipped = value;
  while (clipped.length > 0 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(`${clipped}...`, x, y);
}

module.exports = { buildTicketQrImageNode };
