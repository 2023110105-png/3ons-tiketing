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

  const radius = Math.round(Math.min(width, height) * 0.035); // ~18px on 540h
  const pad = 22;
  const safeX = pad;
  const safeY = pad;
  const safeW = width - pad * 2;
  const safeH = height - pad * 2;

  const clampText = (text, x, y, maxWidth) => drawClampText(ctx, text, x, y, maxWidth);

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

  function roundedRectPath(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fillRoundedRect(x, y, w, h, r, fillStyle) {
    roundedRectPath(x, y, w, h, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function strokeRoundedRect(x, y, w, h, r, strokeStyle, lineWidth = 1) {
    roundedRectPath(x, y, w, h, r);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // Background (soft paper + subtle grain)
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#fffefb');
  bg.addColorStop(1, '#f7fbff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Card shadow + ticket body
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  fillRoundedRect(safeX, safeY, safeW, safeH, radius, '#ffffff');
  ctx.restore();

  // Ticket border
  strokeRoundedRect(safeX, safeY, safeW, safeH, radius, '#dfe6ef', 2);
  strokeRoundedRect(safeX + 10, safeY + 10, safeW - 20, safeH - 20, Math.max(10, radius - 8), '#eef2f7', 1);

  // Top accent (gradient for character)
  const topH = 18;
  const topGrad = ctx.createLinearGradient(safeX, safeY, safeX + safeW, safeY);
  topGrad.addColorStop(0, style.accent);
  topGrad.addColorStop(0.55, '#4da6e8');
  topGrad.addColorStop(1, '#e84393');
  fillRoundedRect(safeX, safeY, safeW, topH + 6, radius, topGrad);

  // Right ribbon
  ctx.fillStyle = style.accent + '1f';
  ctx.beginPath();
  ctx.moveTo(safeX + safeW - 190, safeY + 14);
  ctx.lineTo(safeX + safeW - 10, safeY + 14);
  ctx.lineTo(safeX + safeW - 10, safeY + 92);
  ctx.closePath();
  ctx.fill();

  // Left info panel
  const qrX = safeX + safeW - qrSize - 56;
  const qrY = safeY + 88;
  const leftX = safeX + 20;
  const leftY = safeY + 34;
  const leftW = qrX - leftX - 18;
  const leftH = safeY + safeH - leftY - 20;

  fillRoundedRect(leftX, leftY, leftW, leftH, Math.max(14, radius - 10), '#ffffff');
  strokeRoundedRect(leftX, leftY, leftW, leftH, Math.max(14, radius - 10), '#edf0f6', 2);

  // QR panel
  fillRoundedRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18, '#ffffff');
  strokeRoundedRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18, style.accent, 4);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Perforation line between panels
  const perfX = qrX - 32;
  ctx.save();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(perfX, safeY + 56);
  ctx.lineTo(perfX, safeY + safeH - 28);
  ctx.stroke();
  ctx.restore();

  // Watermark brand (very subtle)
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = style.accent;
  ctx.font = '900 90px Arial';
  ctx.translate(leftX + 40, safeY + safeH - 80);
  ctx.rotate(-0.12);
  ctx.fillText(String(brandLabel || '3oNs').toUpperCase(), 0, 0);
  ctx.restore();

  // Header text
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 40px Arial';
  ctx.fillText('E-TICKET', leftX + 22, leftY + 74);

  // Design marker: helps verify latest renderer is active in production.
  fillRoundedRect(leftX + leftW - 170, leftY + 40, 148, 30, 10, '#ef4444');
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 14px Arial';
  ctx.fillText('DESIGN V2', leftX + leftW - 152, leftY + 61);

  ctx.fillStyle = '#475569';
  ctx.font = '700 19px Arial';
  clampText(eventLabel || 'Event Pass', leftX + 22, leftY + 104, leftW - 44);

  // Brand
  ctx.fillStyle = '#64748b';
  ctx.font = '800 12px Arial';
  clampText((brandLabel || '3oNs Digital').toUpperCase(), leftX + 22, leftY + 126, leftW - 44);

  // Category badge
  fillRoundedRect(leftX + 22, leftY + 140, 176, 42, 14, style.soft);
  strokeRoundedRect(leftX + 22, leftY + 140, 176, 42, 14, style.accent, 2);
  ctx.fillStyle = style.dark;
  ctx.font = '900 18px Arial';
  clampText(participant.category || style.label || '-', leftX + 42, leftY + 168, 150);

  // Participant details
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 30px Arial';
  clampText(participant.name || '-', leftX + 22, leftY + 238, leftW - 44);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 14px Arial';
  ctx.fillText('ID TIKET', leftX + 22, leftY + 282);
  ctx.fillText('HARI', leftX + 22, leftY + 332);
  ctx.fillText('KATEGORI', leftX + 22, leftY + 382);

  ctx.fillStyle = '#1e293b';
  ctx.font = '900 24px Arial';
  ctx.fillText(String(participant.ticket_id || '-'), leftX + 22, leftY + 308);
  ctx.font = '900 22px Arial';
  ctx.fillText(String(participant.day_number || '-'), leftX + 22, leftY + 358);
  ctx.font = '900 22px Arial';
  clampText(participant.category || style.label || '-', leftX + 22, leftY + 408, leftW - 44);

  // Divider
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX + 22, leftY + leftH - 94);
  ctx.lineTo(leftX + leftW - 22, leftY + leftH - 94);
  ctx.stroke();

  // Footer notes
  ctx.fillStyle = '#334155';
  ctx.font = '700 14px Arial';
  ctx.fillText('Valid untuk 1 orang. Dilarang duplikasi tiket.', leftX + 22, leftY + leftH - 64);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 13px Arial';
  const tl = getMetaValue(participant, 'Tanggal Lahir');
  ctx.fillText(tl ? `Tanggal Lahir: ${tl}` : 'Tunjukkan tiket ini saat registrasi di pintu masuk.', leftX + 22, leftY + leftH - 42);

  // Scan note
  ctx.fillStyle = '#1e293b';
  ctx.font = '800 14px Arial';
  ctx.fillText('Scan QR di pintu masuk', qrX + 24, qrY + qrSize + 44);
  ctx.fillStyle = '#64748b';
  ctx.font = '700 12px Arial';
  ctx.fillText('Jaga layar tetap terang untuk scan cepat', qrX + 24, qrY + qrSize + 64);

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
