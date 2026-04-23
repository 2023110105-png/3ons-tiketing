/**
 * Check-in Notifier Service
 * Kirim notifikasi WhatsApp setelah user scan QR code
 * Integrasi dengan whatsapp-web.js (Device Scan - No Twilio)
 */

const { logInfo, logError } = require('./lib/logger.js');
const { MessageMedia } = require('whatsapp-web.js');

// Dependencies (di-inject dari index.js)
let getOrCreateTenantSession = null;
let formatPhoneWA = null;
let withRetry = null;
let isWaClientReady = null;

/**
 * Initialize notifier dengan fungsi dari index.js
 */
function initNotifier(deps) {
  getOrCreateTenantSession = deps.getOrCreateTenantSession;
  formatPhoneWA = deps.formatPhoneWA;
  withRetry = deps.withRetry;
  isWaClientReady = deps.isWaClientReady;
}

/**
 * Helper: Get session for default tenant
 */
function getDefaultSession() {
  if (!getOrCreateTenantSession) return null;
  return getOrCreateTenantSession('tenant-default');
}

/**
 * Send WhatsApp message via whatsapp-web.js client
 */
async function sendWhatsAppMessage(phone, message, options = {}) {
  const session = getDefaultSession();
  
  if (!session || !session.isReady || !isWaClientReady || !isWaClientReady(session.client)) {
    throw new Error('WhatsApp client not ready. Silakan scan QR code terlebih dahulu.');
  }

  const waNumber = formatPhoneWA ? formatPhoneWA(phone) : `${phone.replace(/\D/g, '').replace(/^0/, '62')}@c.us`;

  try {
    let sendResult;
    
    if (options.mediaUrl || options.media) {
      // Kirim dengan media
      const media = options.media || new MessageMedia('image/png', options.mediaBase64, 'ticket.png');
      sendResult = await withRetry(() => 
        session.client.sendMessage(waNumber, media, { caption: message }), {
        retries: 2,
        timeoutMs: 30000
      });
    } else {
      // Kirim text only
      sendResult = await withRetry(() => 
        session.client.sendMessage(waNumber, message), {
        retries: 2,
        timeoutMs: 30000
      });
    }

    return {
      success: true,
      msgId: sendResult?.id?.id,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logError('WA_SEND', `Failed to send to ${phone}`, error);
    throw error;
  }
}

/**
 * Kirim notifikasi check-in berhasil
 * @param {Object} checkinData - Data check-in dari database
 * @param {Object} participant - Data peserta
 */
async function notifyCheckInSuccess(checkinData, participant) {
  const { gate, timestamp, ticket_number } = checkinData;
  const { name, phone } = participant;

  if (!phone) {
    logInfo('CHECKIN_NOTIFY', `No phone for participant ${ticket_number}, skipping notification`);
    return { success: false, reason: 'no_phone' };
  }

  const time = new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const gateLabel = gate === 'front' ? 'Pintu Depan' : 'Pintu Belakang';

  const message = `✅ *CHECK-IN BERHASIL*

Halo ${name},

Anda telah berhasil check-in:
━━━━━━━━━━━━━━━━━━━━━
🎫 No. Tiket: ${ticket_number}
🚪 Gate: ${gateLabel}
🕐 Waktu: ${time} WIB
📅 ${new Date().toLocaleDateString('id-ID')}

Selamat menikmati event! 🎉

⚠️ Tiket ini sudah digunakan dan tidak bisa dipakai lagi.`;

  try {
    const result = await sendWhatsAppMessage(phone, message);
    
    logInfo('CHECKIN_NOTIFY', `Notif sent to ${phone}`, {
      ticket: ticket_number,
      gate,
      msgId: result.msgId
    });

    return {
      success: true,
      msgId: result.msgId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logError('CHECKIN_NOTIFY', `Failed to notify ${phone}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Kirim peringatan jika tiket sudah pernah digunakan
 */
async function notifyDuplicateCheckIn(currentCheckin, previousCheckin, participant) {
  const { phone, name, ticket_number } = participant;
  
  if (!phone) return { success: false, reason: 'no_phone' };

  const firstTime = new Date(previousCheckin.timestamp).toLocaleString('id-ID');
  const currentGate = currentCheckin.gate === 'front' ? 'Pintu Depan' : 'Pintu Belakang';
  const firstGate = previousCheckin.gate === 'front' ? 'Pintu Depan' : 'Pintu Belakang';

  const message = `⚠️ *PERINGATAN TIKET SUDAH DIGUNAKAN*

Halo ${name},

Ada percobaan scan ulang tiket Anda:
━━━━━━━━━━━━━━━━━━━━━
🎫 No. Tiket: ${ticket_number}
❌ Percobaan: Gate ${currentGate} (BARU)
✅ Check-in pertama: Gate ${firstGate}
🕐 Waktu pertama: ${firstTime}

Tiket ini hanya berlaku untuk 1x masuk.
Jika ini bukan Anda, segera lapor ke petugas.`;

  try {
    const result = await sendWhatsAppMessage(phone, message);
    return { success: true, msgId: result.msgId };
  } catch (error) {
    logError('CHECKIN_NOTIFY', `Duplicate warning failed for ${phone}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Notifikasi ke Admin/Gate Keeper
 */
async function notifyGateAdmin(gate, stats) {
  const adminPhone = process.env.GATE_ADMIN_PHONE; // Nomor admin gate
  
  if (!adminPhone) return;

  const message = `📊 *Gate Update - ${gate === 'front' ? 'Pintu Depan' : 'Pintu Belakang'}*

Ringkasan hari ini:
━━━━━━━━━━━━━━━━━━━━━
✅ Total Check-in: ${stats.totalCheckins}
👥 Peserta belum masuk: ${stats.remaining}
🔄 Update: ${new Date().toLocaleTimeString('id-ID')}

Sistem Check-in Otomatis`;

  try {
    await sendWhatsAppMessage(adminPhone, message);
  } catch (error) {
    logError('CHECKIN_NOTIFY', 'Admin notify failed', error);
  }
}

/**
 * Batch notifikasi untuk semua yang belum check-in (reminder)
 */
async function sendCheckInReminders(participantsList) {
  const results = {
    total: participantsList.length,
    sent: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < participantsList.length; i++) {
    const p = participantsList[i];
    
    if (!p.phone) {
      results.failed++;
      results.errors.push({ ticket: p.ticket_number, error: 'No phone' });
      continue;
    }

    const message = `⏰ *REMINDER CHECK-IN*

Halo ${p.name},

Event Yamaha akan segera dimulai!
━━━━━━━━━━━━━━━━━━━━━
🎫 Tiket: ${p.ticket_number}
📍 Lokasi: JCC Senayan
🚪 Gate: ${p.gate_assignment || 'Front/Back'}

Jangan lupa:
✅ Bawa tiket/QR code
✅ Screenshot barcode
✅ Datang 30 menit lebih awal

Sampai jumpa! 🏍️`;

    try {
      // Rate limiting - delay setiap 5 pesan
      if (i > 0 && i % 5 === 0) {
        await new Promise(r => setTimeout(r, 2000));
      }

      await sendWhatsAppMessage(p.phone, message);
      results.sent++;
      
    } catch (error) {
      results.failed++;
      results.errors.push({ 
        ticket: p.ticket_number, 
        phone: p.phone,
        error: error.message 
      });
    }
  }

  logInfo('CHECKIN_NOTIFY', `Reminders sent: ${results.sent}/${results.total}`);
  return results;
}

// Exports untuk CommonJS
module.exports = {
  initNotifier,
  notifyCheckInSuccess,
  notifyDuplicateCheckIn,
  notifyGateAdmin,
  sendCheckInReminders,
  sendWhatsAppMessage
};
