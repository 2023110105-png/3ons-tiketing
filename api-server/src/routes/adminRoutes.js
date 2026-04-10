import { Router } from 'express'
import { log } from '../utils/logger.js'

// Valid ticket patterns
const VALID_RANGES = {
  1: { min: 1, max: 62 },    // Day 1: 1-62
  2: { min: 1, max: 152 }   // Day 2: 1-152
}

function isValidTicketId(ticketId, day) {
  if (!ticketId || !day) return false
  const match = String(ticketId).match(/(\d+)/)
  if (!match) return false
  
  const num = parseInt(match[1], 10)
  const dayNum = parseInt(day, 10)
  
  const range = VALID_RANGES[dayNum]
  if (!range) return false
  
  return num >= range.min && num <= range.max
}

// Supabase REST API helper (tanpa install package)
async function supabaseFetch(supabaseUrl, supabaseKey, table, options = {}) {
  const { method = 'GET', body, query } = options
  
  let url = `${supabaseUrl}/rest/v1/${table}`
  if (query) {
    url += '?' + new URLSearchParams(query)
  }
  
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'DELETE' ? 'return=minimal' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error: ${res.status} - ${err}`)
  }
  
  return method === 'DELETE' ? null : res.json()
}

export function createAdminRoutes({ supabaseUrl, supabaseKey }) {
  const router = Router()

  // Cleanup invalid participants
  router.post('/api/admin/cleanup-participants', async (req, res) => {
    try {
      // Ambil semua peserta
      const participants = await supabaseFetch(
        supabaseUrl, 
        supabaseKey, 
        'participants',
        { query: { select: 'id,ticket_id,name,day,day_number,hari' } }
      )

      // Filter yang tidak valid
      const invalidParticipants = participants.filter(p => {
        const day = p.day || p.day_number || p.hari || 1
        return !isValidTicketId(p.ticket_id, day)
      })

      const validParticipants = participants.filter(p => {
        const day = p.day || p.day_number || p.hari || 1
        return isValidTicketId(p.ticket_id, day)
      })

      // Jika tidak ada yang invalid
      if (invalidParticipants.length === 0) {
        return res.json({
          success: true,
          message: 'Database sudah bersih, tidak ada data invalid',
          total: participants.length,
          valid: validParticipants.length,
          invalid: 0,
          deleted: 0
        })
      }

      // Hapus dalam batch
      const idsToDelete = invalidParticipants.map(p => p.id)
      const batchSize = 100
      let deletedCount = 0

      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize)
        
        try {
          await supabaseFetch(
            supabaseUrl,
            supabaseKey,
            'participants',
            {
              method: 'DELETE',
              query: { id: `in.(${batch.join(',')})` }
            }
          )
          deletedCount += batch.length
        } catch (deleteError) {
          log('error', 'cleanup_batch_failed', { batch: i, error: deleteError.message })
        }
      }

      log('info', 'cleanup_completed', {
        total: participants.length,
        valid: validParticipants.length,
        invalid: invalidParticipants.length,
        deleted: deletedCount
      })

      return res.json({
        success: true,
        message: `Cleanup selesai: ${deletedCount} peserta invalid dihapus`,
        total: participants.length,
        valid: validParticipants.length,
        invalid: invalidParticipants.length,
        deleted: deletedCount,
        deletedList: invalidParticipants.slice(0, 20).map(p => ({
          ticket_id: p.ticket_id,
          name: p.name?.substring(0, 30)
        }))
      })
    } catch (err) {
      log('error', 'cleanup_error', { error: err?.message })
      return res.status(500).json({
        success: false,
        error: err?.message || 'Cleanup failed'
      })
    }
  })

  // Get cleanup preview (without deleting)
  router.get('/api/admin/cleanup-preview', async (req, res) => {
    try {
      const participants = await supabaseFetch(
        supabaseUrl,
        supabaseKey,
        'participants',
        { query: { select: 'id,ticket_id,name,day,day_number,hari' } }
      )

      const invalidParticipants = participants.filter(p => {
        const day = p.day || p.day_number || p.hari || 1
        return !isValidTicketId(p.ticket_id, day)
      })

      const validParticipants = participants.filter(p => {
        const day = p.day || p.day_number || p.hari || 1
        return isValidTicketId(p.ticket_id, day)
      })

      return res.json({
        success: true,
        total: participants.length,
        valid: validParticipants.length,
        invalid: invalidParticipants.length,
        willDelete: invalidParticipants.map(p => ({
          id: p.id,
          ticket_id: p.ticket_id,
          name: p.name?.substring(0, 30),
          day: p.day || p.day_number || p.hari || 1
        }))
      })
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err?.message
      })
    }
  })

  return router
}
