import { Router } from 'express'
import { z } from 'zod'
import { 
  sendTicketMessage, 
  queueBatchMessages,
  getQueueStatus,
  getBotConfig,
  updateBotConfig 
} from '../services/whatsappService.js'
import { log } from '../utils/logger.js'

// Schema validasi
const SendTicketSchema = z.object({
  ticket_id: z.string().min(1),
  name: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  wa_message: z.string().min(1),
  wa_send_mode: z.enum(['message_only', 'message_with_barcode']).default('message_only'),
  qr_data: z.string().optional(),
  tenant_id: z.string().optional()
})

const BatchSendSchema = z.object({
  items: z.array(SendTicketSchema).min(1).max(100) // Max 100 per batch
})

const ConfigSchema = z.object({
  RETRY_DELAYS: z.array(z.number()).optional(),
  MAX_RETRIES: z.number().min(1).max(10).optional(),
  BATCH_SIZE: z.number().min(1).max(20).optional(),
  DELAY_BETWEEN_BATCHES: z.number().min(0).max(10000).optional(),
  RATE_LIMIT_PER_MINUTE: z.number().min(1).max(100).optional()
})

export function createWhatsAppRoutes({ writeRateLimit }) {
  const router = Router()

  // Send single ticket
  router.post('/api/send-ticket', writeRateLimit, async (req, res) => {
    try {
      const data = SendTicketSchema.parse(req.body)
      
      log('info', 'send_ticket_request', {
        ticket_id: data.ticket_id,
        phone: data.phone.replace(/\d{4}$/, '****'),
        mode: data.wa_send_mode
      })

      const result = await sendTicketMessage(data)

      if (result.success) {
        return res.json({
          success: true,
          message: 'Pesan berhasil dikirim',
          attempts: result.attempts,
          ticket_id: data.ticket_id
        })
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          attempts: result.attempts,
          ticket_id: data.ticket_id
        })
      }
    } catch (err) {
      log('error', 'send_ticket_error', { error: err?.message })
      return res.status(400).json({
        success: false,
        error: err?.message || 'Invalid request',
        error_code: 'validation_error'
      })
    }
  })

  // Send batch tickets
  router.post('/api/send-ticket/batch', writeRateLimit, async (req, res) => {
    try {
      const { items } = BatchSendSchema.parse(req.body)
      
      log('info', 'batch_send_request', { count: items.length })

      const result = queueBatchMessages(items)

      return res.json({
        success: true,
        message: `${items.length} pesan dimasukkan ke antrean`,
        queued: result.queued,
        status: result.status
      })
    } catch (err) {
      log('error', 'batch_send_error', { error: err?.message })
      return res.status(400).json({
        success: false,
        error: err?.message || 'Invalid request',
        error_code: 'validation_error'
      })
    }
  })

  // Get queue status
  router.get('/api/whatsapp/status', async (req, res) => {
    try {
      const status = getQueueStatus()
      return res.json({
        success: true,
        status
      })
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err?.message
      })
    }
  })

  // Get bot config
  router.get('/api/whatsapp/config', async (req, res) => {
    try {
      const config = getBotConfig()
      return res.json({
        success: true,
        config
      })
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err?.message
      })
    }
  })

  // Update bot config
  router.put('/api/whatsapp/config', async (req, res) => {
    try {
      // Hanya admin yang boleh update config
      if (!req.headers['x-admin-secret']) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      const newConfig = ConfigSchema.parse(req.body)
      const updated = updateBotConfig(newConfig)

      return res.json({
        success: true,
        message: 'Konfigurasi bot diperbarui',
        config: updated
      })
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err?.message
      })
    }
  })

  return router
}
