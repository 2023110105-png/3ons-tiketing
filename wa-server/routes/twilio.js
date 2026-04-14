/**
 * Twilio WhatsApp API Routes
 * Production-safe WhatsApp integration
 */

import express from 'express'
import { 
  sendWhatsAppMessage, 
  sendTicketMessage, 
  sendNotification,
  healthCheck,
  validatePhoneNumber,
  getMessageStatus
} from '../twilio-service.js'
import { logInfo, logError } from '../lib/logger.js'

const router = express.Router()

/**
 * POST /api/twilio/send
 * Send WhatsApp message
 */
router.post('/send', async (req, res) => {
  try {
    const { phone, message, type = 'text' } = req.body

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message are required'
      })
    }

    // Validate phone
    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Use +628xxxx'
      })
    }

    let result
    
    switch (type) {
      case 'ticket':
        result = await sendTicketMessage(validation.formatted, message)
        break
      case 'notification': {
        const { title, body, url } = req.body
        result = await sendNotification(validation.formatted, title, body, url)
        break
      }
      default:
        result = await sendWhatsAppMessage(validation.formatted, message)
    }

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    logError('TWILIO_ROUTE', 'Send failed', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/twilio/send-ticket
 * Send ticket with formatted template
 */
router.post('/send-ticket', async (req, res) => {
  try {
    const { phone, ticketData } = req.body

    if (!phone || !ticketData) {
      return res.status(400).json({
        success: false,
        error: 'Phone and ticketData are required'
      })
    }

    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      })
    }

    const result = await sendTicketMessage(validation.formatted, ticketData)

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    logError('TWILIO_ROUTE', 'Send ticket failed', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/twilio/bulk-send
 * Send bulk messages (with rate limiting)
 */
router.post('/bulk-send', async (req, res) => {
  try {
    const { recipients, message } = req.body

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array required'
      })
    }

    // Twilio rate limit: ~1 msg/sec for WhatsApp
    const results = []
    const errors = []

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      
      try {
        // Add delay every 5 messages
        if (i > 0 && i % 5 === 0) {
          await new Promise(r => setTimeout(r, 2000))
        }

        const validation = validatePhoneNumber(recipient.phone)
        if (!validation.valid) {
          errors.push({ phone: recipient.phone, error: 'Invalid format' })
          continue
        }

        const result = await sendWhatsAppMessage(
          validation.formatted, 
          recipient.message || message
        )
        
        results.push({
          phone: recipient.phone,
          success: true,
          sid: result.sid
        })

      } catch (error) {
        errors.push({
          phone: recipient.phone,
          error: error.message
        })
      }
    }

    res.json({
      success: true,
      data: {
        total: recipients.length,
        sent: results.length,
        failed: errors.length,
        results,
        errors
      }
    })

  } catch (error) {
    logError('TWILIO_ROUTE', 'Bulk send failed', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/twilio/status/:sid
 * Check message delivery status
 */
router.get('/status/:sid', async (req, res) => {
  try {
    const { sid } = req.params
    const status = await getMessageStatus(sid)
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      })
    }

    res.json({
      success: true,
      data: status
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/twilio/health
 * Service health check
 */
router.get('/health', async (req, res) => {
  const health = await healthCheck()
  res.json({
    success: true,
    data: health
  })
})

/**
 * Webhook for incoming messages (optional)
 * POST /api/twilio/webhook
 */
router.post('/webhook', express.urlencoded({ extended: false }), (req, res) => {
  const { From, Body, MessageSid } = req.body
  
  logInfo('TWILIO_WEBHOOK', `Message from ${From}`, { body: Body, sid: MessageSid })
  
  // Auto-reply logic bisa ditambahkan di sini
  
  res.send('<Response></Response>') // Twilio expects XML response
})

export default router
