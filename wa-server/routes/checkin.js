/**
 * Check-in API Routes dengan Twilio Notification
 * Dari Gate Scanner → Backend → Notifikasi WhatsApp
 */

import express from 'express'
import { notifyCheckInSuccess, notifyDuplicateCheckIn } from '../checkin-notifier.js'
import { logInfo, logError } from '../lib/logger.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

// Supabase client (import dari config jika ada)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * POST /api/checkin/scan
 * Endpoint dari Gate Scanner (Front/Back)
 */
router.post('/scan', async (req, res) => {
  try {
    const { 
      qr_data,           // Data dari QR scan
      gate,              // 'front' atau 'back'
      scanner_device_id  // ID perangkat scanner (optional)
    } = req.body

    // 1. Validasi input
    if (!qr_data || !gate) {
      return res.status(400).json({
        success: false,
        error: 'qr_data dan gate diperlukan'
      })
    }

    // 2. Parse QR data (extract ticket_number)
    // Format QR: bisa ticket number langsung atau JSON
    let ticketNumber
    try {
      const parsed = JSON.parse(qr_data)
      ticketNumber = parsed.ticket_number || parsed.ticket || qr_data
    } catch {
      ticketNumber = qr_data // Plain text ticket number
    }

    logInfo('CHECKIN_API', `Scan received`, { 
      ticket: ticketNumber, 
      gate,
      device: scanner_device_id 
    })

    // 3. Cek database - apakah sudah pernah check-in?
    // (Ini contoh, sesuaikan dengan Supabase query Anda)
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single()

    if (existingCheckin) {
      // Sudah pernah check-in!
      logInfo('CHECKIN_API', `Duplicate scan`, { ticket: ticketNumber })

      // Ambil data peserta untuk notifikasi
      const { data: participant } = await supabase
        .from('participants')
        .select('name, phone, ticket_number')
        .eq('ticket_number', ticketNumber)
        .single()

      // Kirim peringatan ke user (async, tidak block response)
      if (participant?.phone) {
        notifyDuplicateCheckIn(
          { gate, timestamp: new Date(), ticket_number: ticketNumber },
          existingCheckin,
          participant
        ).catch(err => logError('CHECKIN_API', 'Notify failed', err))
      }

      return res.status(409).json({
        success: false,
        error: 'Tiket sudah pernah digunakan',
        checkin: {
          first_checkin: existingCheckin.created_at,
          first_gate: existingCheckin.gate
        }
      })
    }

    // 4. Ambil data peserta dari database
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({
        success: false,
        error: 'Tiket tidak ditemukan'
      })
    }

    // 5. Simpan check-in ke database
    const checkinRecord = {
      ticket_number: ticketNumber,
      participant_id: participant.id,
      gate: gate,
      scanner_device_id: scanner_device_id || null,
      created_at: new Date().toISOString()
    }

    const { data: newCheckin, error: insertError } = await supabase
      .from('checkins')
      .insert([checkinRecord])
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // 6. Kirim notifikasi WhatsApp via Twilio (async)
    if (participant.phone) {
      notifyCheckInSuccess(
        { gate, timestamp: newCheckin.created_at, ticket_number: ticketNumber },
        participant
      ).then(result => {
        if (result.success) {
          logInfo('CHECKIN_API', `WhatsApp sent to ${participant.phone}`)
        }
      }).catch(err => {
        logError('CHECKIN_API', 'Twilio notification failed', err)
        // Tidak block response kalau notifikasi gagal
      })
    }

    // 7. Response ke Gate Scanner (immediate)
    res.json({
      success: true,
      data: {
        participant: {
          name: participant.name,
          ticket_number: participant.ticket_number,
          seat: participant.seat || null
        },
        checkin: {
          gate: gate,
          timestamp: newCheckin.created_at,
          sequence_number: newCheckin.id // Urutan masuk
        }
      },
      message: `Selamat datang, ${participant.name}!`
    })

  } catch (error) {
    logError('CHECKIN_API', 'Scan processing failed', error)
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan sistem'
    })
  }
})

/**
 * GET /api/checkin/stats/:gate
 * Statistik check-in per gate (untuk dashboard)
 */
router.get('/stats/:gate', async (req, res) => {
  try {
    const { gate } = req.params
    const today = new Date().toISOString().split('T')[0]

    // Total check-in hari ini
    const { count: totalCheckins, error: countError } = await supabase
      .from('checkins')
      .select('*', { count: 'exact' })
      .eq('gate', gate)
      .gte('created_at', today)

    // Total peserta
    const { count: totalParticipants, error: totalError } = await supabase
      .from('participants')
      .select('*', { count: 'exact' })

    if (countError || totalError) {
      throw countError || totalError
    }

    res.json({
      success: true,
      data: {
        gate,
        total_checkins: totalCheckins,
        total_participants: totalParticipants,
        remaining: totalParticipants - totalCheckins,
        last_updated: new Date().toISOString()
      }
    })

  } catch (error) {
    logError('CHECKIN_API', 'Stats error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/checkin/status/:ticketNumber
 * Cek status check-in tiket (untuk debugging)
 */
router.get('/status/:ticketNumber', async (req, res) => {
  try {
    const { ticketNumber } = req.params

    const { data: checkin, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single()

    if (error && error.code !== 'PGRST116') { // Not found error
      throw error
    }

    res.json({
      success: true,
      data: {
        ticket_number: ticketNumber,
        checked_in: !!checkin,
        checkin_data: checkin || null
      }
    })

  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
