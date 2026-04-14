/**
 * Twilio WhatsApp Service
 * Integration for production-safe WhatsApp messaging
 */

import twilio from 'twilio'
import { logInfo, logError } from './lib/logger.js'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER // format: whatsapp:+14155238886

let client = null

// Initialize Twilio client
export function initTwilio() {
  if (!accountSid || !authToken) {
    logError('TWILIO', 'Missing credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN')
    return false
  }

  try {
    client = twilio(accountSid, authToken)
    logInfo('TWILIO', 'Twilio client initialized')
    return true
  } catch (error) {
    logError('TWILIO', 'Failed to initialize', error)
    return false
  }
}

/**
 * Send WhatsApp message via Twilio
 * @param {string} to - Phone number (format: +628123456789)
 * @param {string} message - Message content
 * @param {Object} options - Additional options
 * @param {string[]} options.mediaUrl - Array of media URLs (images, PDFs)
 */
export async function sendWhatsAppMessage(to, message, options = {}) {
  if (!client) {
    throw new Error('Twilio not initialized')
  }

  // Format number
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  const formattedFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`

  try {
    const msgOptions = {
      body: message,
      from: formattedFrom,
      to: formattedTo
    }

    // Add media if provided (images, PDFs, etc)
    if (options.mediaUrl && options.mediaUrl.length > 0) {
      msgOptions.mediaUrl = options.mediaUrl
    }

    const msg = await client.messages.create(msgOptions)

    logInfo('TWILIO', `Message sent to ${to}`, { 
      sid: msg.sid, 
      status: msg.status,
      hasMedia: !!options.mediaUrl 
    })
    
    return {
      success: true,
      sid: msg.sid,
      status: msg.status,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    logError('TWILIO', `Failed to send to ${to}`, error)
    throw error
  }
}

/**
 * Send ticket with QR Code image
 * @param {string} to - Phone number
 * @param {Object} ticketData - Ticket information
 * @param {string} qrCodeUrl - Public URL to QR code image
 */
export async function sendTicketWithQR(to, ticketData, qrCodeUrl) {
  const { name, ticketNumber, eventName, date, gate } = ticketData
  
  const message = `🎫 *TIKET YAMAHA*

Halo *${name}*,

Detail tiket Anda:
📋 *No. Tiket:* ${ticketNumber}
🎪 *Event:* ${eventName}
📅 *Tanggal:* ${date}
🚪 *Gate:* ${gate}

📸 *QR Code Anda (screenshot & simpan):*`

  return sendWhatsAppMessage(to, message, {
    mediaUrl: [qrCodeUrl] // Kirim gambar QR
  })
}

/**
 * Send PDF ticket document
 */
export async function sendPDFTicket(to, ticketData, pdfUrl) {
  const { name, ticketNumber } = ticketData
  
  const message = `📄 *E-TIKET PDF*

Halo ${name},

Tiket resmi Anda telah digenerate.

📎 File: Ticket-${ticketNumber}.pdf

⚠️ *PENTING:*
• Download & simpan file ini
• Tunjukkan saat check-in
• Bawa identitas diri`;

  return sendWhatsAppMessage(to, message, {
    mediaUrl: [pdfUrl]
  })
}

/**
 * Send ticket template message
 * @param {string} to - Phone number
 * @param {Object} ticketData - Ticket information
 */
export async function sendTicketMessage(to, ticketData) {
  const { name, ticketNumber, eventName, date, gate } = ticketData
  
  const message = `🎫 *TIKET YAMAHA*

Halo *${name}*,

Detail tiket Anda:
━━━━━━━━━━━━━━━━━
📋 *No. Tiket:* ${ticketNumber}
🎪 *Event:* ${eventName}
📅 *Tanggal:* ${date}
🚪 *Gate:* ${gate}

⚠️ *PENTING:*
• Screenshot tiket ini
• Tunjukkan QR Code saat check-in
• Tiket hanya berlaku 1x masuk

Terima kasih! 🏍️`

  return sendWhatsAppMessage(to, message)
}

/**
 * Send notification template
 */
export async function sendNotification(to, title, body, actionUrl = null) {
  let message = `🔔 *${title}*

${body}`
  
  if (actionUrl) {
    message += `\n\n👉 ${actionUrl}`
  }
  
  return sendWhatsAppMessage(to, message)
}

/**
 * Check delivery status
 */
export async function getMessageStatus(messageSid) {
  if (!client) return null
  
  try {
    const message = await client.messages(messageSid).fetch()
    return {
      sid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateSent: message.dateSent,
      dateDelivered: message.dateUpdated
    }
  } catch (error) {
    logError('TWILIO', 'Failed to fetch status', error)
    return null
  }
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(number) {
  // Remove all non-numeric except +
  const cleaned = number.replace(/[^\d+]/g, '')
  
  // Check format
  const isValid = /^\+[1-9]\d{7,14}$/.test(cleaned)
  
  return {
    valid: isValid,
    formatted: isValid ? cleaned : null,
    original: number
  }
}

// Health check
export async function healthCheck() {
  if (!client) {
    return { status: 'disconnected', reason: 'not_initialized' }
  }

  try {
    // Try to fetch account info
    const account = await client.api.accounts(accountSid).fetch()
    return {
      status: 'connected',
      accountStatus: account.status,
      type: 'twilio_api'
    }
  } catch (error) {
    return {
      status: 'error',
      reason: error.message
    }
  }
}
