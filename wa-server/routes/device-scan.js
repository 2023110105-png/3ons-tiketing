/**
 * Device Scanner API Routes
 * Untuk perangkat scanner yang mengambil barcode data dari WA Server
 * Endpoint ini memungkinkan perangkat mobile/tablet scanner untuk:
 * 1. Mengambil data tiket berdasarkan barcode
 * 2. Melakukan check-in via API
 * 3. Menerima notifikasi real-time
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { notifyCheckInSuccess, notifyDuplicateCheckIn } = require('../checkin-notifier.js');
const { logInfo, logError } = require('../lib/logger.js');

const router = express.Router();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Active device sessions (simple in-memory store)
const activeDevices = new Map();

/**
 * Middleware: Validasi device token
 */
function validateDeviceToken(req, res, next) {
  const deviceToken = req.headers['x-device-token'] || req.query.device_token;
  
  if (!deviceToken) {
    return res.status(401).json({
      success: false,
      error: 'Device token diperlukan'
    });
  }
  
  // Simple token validation - bisa diperluas dengan DB lookup
  const validToken = deviceToken.startsWith('DEV-') || deviceToken.startsWith('SCAN-');
  
  if (!validToken) {
    return res.status(403).json({
      success: false,
      error: 'Device token tidak valid'
    });
  }
  
  req.deviceToken = deviceToken;
  next();
}

/**
 * POST /api/device/scan
 * Endpoint untuk perangkat scanner mengirimkan barcode data
 * Bisa menerima:
 * - qr_data: Data QR lengkap (JSON atau plain text)
 * - ticket_number: Nomor tiket langsung
 * - device_id: ID perangkat scanner
 * - gate: 'front' atau 'back'
 */
router.post('/scan', validateDeviceToken, async (req, res) => {
  try {
    const {
      qr_data,
      ticket_number,
      device_id,
      gate = 'front',
      tenant_id
    } = req.body;

    // Validasi input
    const ticketNumber = ticket_number || qr_data;
    if (!ticketNumber) {
      return res.status(400).json({
        success: false,
        error: 'qr_data atau ticket_number diperlukan'
      });
    }

    logInfo('DEVICE_SCAN', `Scan received from device`, {
      device: device_id,
      ticket: ticketNumber,
      gate,
      tenant: tenant_id
    });

    // Parse QR data jika format JSON
    let parsedQrData = null;
    let finalTicketNumber = ticketNumber;
    
    try {
      const parsed = JSON.parse(ticketNumber);
      if (parsed.ticket_number || parsed.ticketId) {
        parsedQrData = parsed;
        finalTicketNumber = parsed.ticket_number || parsed.ticketId;
      }
    } catch {
      // Bukan JSON, gunakan sebagai plain ticket number
      finalTicketNumber = ticketNumber;
    }

    // Cek apakah sudah pernah check-in
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('*')
      .eq('ticket_number', finalTicketNumber)
      .single();

    if (existingCheckin) {
      // Sudah check-in, ambil data peserta untuk notifikasi
      const { data: participant } = await supabase
        .from('participants')
        .select('name, phone, ticket_number, category, day_number')
        .eq('ticket_number', finalTicketNumber)
        .single();

      // Kirim notifikasi duplikat
      if (participant?.phone) {
        notifyDuplicateCheckIn(
          { gate, timestamp: new Date(), ticket_number: finalTicketNumber, device_id },
          existingCheckin,
          participant
        ).catch(err => logError('DEVICE_SCAN', 'Notify duplicate failed', err));
      }

      return res.status(409).json({
        success: false,
        status: 'duplicate',
        error: 'Tiket sudah pernah digunakan',
        data: {
          ticket_number: finalTicketNumber,
          participant: participant ? {
            name: participant.name,
            category: participant.category,
            day_number: participant.day_number
          } : null,
          first_checkin: {
            time: existingCheckin.created_at,
            gate: existingCheckin.gate,
            device: existingCheckin.scanner_device_id
          }
        }
      });
    }

    // Ambil data peserta lengkap
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('ticket_number', finalTicketNumber)
      .single();

    if (participantError || !participant) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: 'Tiket tidak ditemukan di database',
        data: { ticket_number: finalTicketNumber }
      });
    }

    // Response sukses (belum check-in, menunggu konfirmasi)
    res.json({
      success: true,
      status: 'verified',
      message: 'Tiket valid, siap check-in',
      data: {
        participant: {
          id: participant.id,
          name: participant.name,
          ticket_number: participant.ticket_number,
          category: participant.category,
          day_number: participant.day_number,
          seat: participant.seat,
          phone: participant.phone
        },
        qr_data: parsedQrData,
        can_checkin: true
      }
    });

  } catch (error) {
    logError('DEVICE_SCAN', 'Scan verification failed', error);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan sistem'
    });
  }
});

/**
 * POST /api/device/checkin
 * Konfirmasi check-in setelah verifikasi
 */
router.post('/checkin', validateDeviceToken, async (req, res) => {
  try {
    const {
      ticket_number,
      device_id,
      gate = 'front',
      verified_by,
      notes
    } = req.body;

    if (!ticket_number) {
      return res.status(400).json({
        success: false,
        error: 'ticket_number diperlukan'
      });
    }

    logInfo('DEVICE_CHECKIN', `Check-in from device`, {
      device: device_id,
      ticket: ticket_number,
      gate,
      verified_by
    });

    // Cek ulang apakah sudah check-in (race condition protection)
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('*')
      .eq('ticket_number', ticket_number)
      .single();

    if (existingCheckin) {
      return res.status(409).json({
        success: false,
        status: 'duplicate',
        error: 'Tiket sudah check-in sesaat yang lalu'
      });
    }

    // Ambil data peserta
    const { data: participant } = await supabase
      .from('participants')
      .select('*')
      .eq('ticket_number', ticket_number)
      .single();

    // Simpan check-in record
    const checkinRecord = {
      ticket_number: ticket_number,
      participant_id: participant?.id || null,
      gate: gate,
      scanner_device_id: device_id || null,
      verified_by: verified_by || null,
      notes: notes || null,
      created_at: new Date().toISOString()
    };

    const { data: newCheckin, error: insertError } = await supabase
      .from('checkins')
      .insert([checkinRecord])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Kirim notifikasi WhatsApp
    if (participant?.phone) {
      notifyCheckInSuccess(
        { gate, timestamp: newCheckin.created_at, ticket_number, device_id },
        participant
      ).then(result => {
        if (result.success) {
          logInfo('DEVICE_CHECKIN', `WhatsApp sent to ${participant.phone}`);
        }
      }).catch(err => {
        logError('DEVICE_CHECKIN', 'Notification failed', err);
      });
    }

    // Response sukses
    res.json({
      success: true,
      status: 'checked_in',
      message: `Selamat datang, ${participant?.name || 'Peserta'}!`,
      data: {
        participant: {
          name: participant?.name,
          ticket_number: ticket_number,
          category: participant?.category,
          seat: participant?.seat
        },
        checkin: {
          id: newCheckin.id,
          gate: gate,
          timestamp: newCheckin.created_at,
          sequence_number: newCheckin.id
        }
      }
    });

  } catch (error) {
    logError('DEVICE_CHECKIN', 'Check-in failed', error);
    res.status(500).json({
      success: false,
      error: 'Gagal melakukan check-in'
    });
  }
});

/**
 * GET /api/device/ticket/:ticketNumber
 * Ambil data tiket untuk preview (tanpa check-in)
 */
router.get('/ticket/:ticketNumber', validateDeviceToken, async (req, res) => {
  try {
    const { ticketNumber } = req.params;

    const { data: participant, error } = await supabase
      .from('participants')
      .select('id, name, ticket_number, category, day_number, seat, phone')
      .eq('ticket_number', ticketNumber)
      .single();

    if (error || !participant) {
      return res.status(404).json({
        success: false,
        error: 'Tiket tidak ditemukan'
      });
    }

    // Cek status check-in
    const { data: checkin } = await supabase
      .from('checkins')
      .select('created_at, gate')
      .eq('ticket_number', ticketNumber)
      .single();

    res.json({
      success: true,
      data: {
        participant: {
          name: participant.name,
          ticket_number: participant.ticket_number,
          category: participant.category,
          day_number: participant.day_number,
          seat: participant.seat
        },
        checked_in: !!checkin,
        checkin_info: checkin || null
      }
    });

  } catch (error) {
    logError('DEVICE_TICKET', 'Fetch ticket failed', error);
    res.status(500).json({ success: false, error: 'Gagal mengambil data tiket' });
  }
});

/**
 * GET /api/device/stats
 * Statistik scan per device
 */
router.get('/stats', validateDeviceToken, async (req, res) => {
  try {
    const { device_id, gate } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('checkins')
      .select('*', { count: 'exact' })
      .gte('created_at', today);

    if (device_id) {
      query = query.eq('scanner_device_id', device_id);
    }
    if (gate) {
      query = query.eq('gate', gate);
    }

    const { count, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        total_checkins: count,
        device_id: device_id || 'all',
        gate: gate || 'all',
        date: today
      }
    });

  } catch (error) {
    logError('DEVICE_STATS', 'Fetch stats failed', error);
    res.status(500).json({ success: false, error: 'Gagal mengambil statistik' });
  }
});

/**
 * POST /api/device/register
 * Register device baru
 */
router.post('/register', async (req, res) => {
  try {
    const { device_name, device_type, gate } = req.body;

    if (!device_name || !device_type) {
      return res.status(400).json({
        success: false,
        error: 'device_name dan device_type diperlukan'
      });
    }

    // Generate device token
    const deviceToken = `SCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const deviceId = `DEV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Simpan ke active devices
    activeDevices.set(deviceToken, {
      id: deviceId,
      name: device_name,
      type: device_type,
      gate: gate || 'front',
      registered_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });

    logInfo('DEVICE_REGISTER', `New device registered`, {
      device_id: deviceId,
      name: device_name,
      type: device_type
    });

    res.json({
      success: true,
      message: 'Device berhasil diregistrasi',
      data: {
        device_token: deviceToken,
        device_id: deviceId,
        name: device_name,
        gate: gate || 'front',
        registered_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logError('DEVICE_REGISTER', 'Registration failed', error);
    res.status(500).json({ success: false, error: 'Gagal registrasi device' });
  }
});

module.exports = router;
