/**
 * Unified WhatsApp Service
 * Supports multiple providers: whatsapp-web.js, twilio
 * Auto-fallback and health monitoring
 */

import { logInfo, logError } from './lib/logger.js'

// Provider modules (lazy loaded)
let waWebModule = null
let twilioModule = null

// Current provider state
const state = {
  provider: process.env.WHATSAPP_PROVIDER || 'whatsapp-web',
  status: 'disconnected',
  lastError: null,
  initialized: false
}

/**
 * Initialize WhatsApp service
 */
export async function initWhatsAppService() {
  logInfo('WA_SERVICE', `Initializing with provider: ${state.provider}`)

  try {
    switch (state.provider) {
      case 'twilio':
        twilioModule = await import('./twilio-service.js')
        state.initialized = twilioModule.initTwilio()
        state.status = state.initialized ? 'connected' : 'error'
        break

      case 'whatsapp-web':
      default:
        waWebModule = await import('./whatsapp-web.js')
        // whatsapp-web.js handles its own initialization
        state.initialized = true
        state.status = 'connecting'
        break
    }

    return state.initialized
  } catch (error) {
    logError('WA_SERVICE', 'Initialization failed', error)
    state.status = 'error'
    state.lastError = error.message
    return false
  }
}

/**
 * Send WhatsApp message (unified interface)
 */
export async function sendMessage(phone, message, options = {}) {
  if (!state.initialized) {
    throw new Error('WhatsApp service not initialized')
  }

  const { provider } = state
  const startTime = Date.now()

  try {
    let result

    switch (provider) {
      case 'twilio':
        result = await twilioModule.sendWhatsAppMessage(phone, message, options)
        break

      case 'whatsapp-web':
      default: {
        // whatsapp-web.js implementation
        result = await waWebModule.sendMessage(phone, message)
        break
      }
    }

    const duration = Date.now() - startTime
    logInfo('WA_SERVICE', `Message sent via ${provider}`, { phone, duration })

    return {
      ...result,
      provider,
      duration
    }

  } catch (error) {
    logError('WA_SERVICE', `Failed to send via ${provider}`, error)
    
    // Try fallback if enabled
    if (process.env.ENABLE_FALLBACK === 'true' && provider !== 'twilio') {
      logInfo('WA_SERVICE', 'Attempting fallback to Twilio')
      try {
        if (!twilioModule) {
          twilioModule = await import('./twilio-service.js')
          twilioModule.initTwilio()
        }
        const result = await twilioModule.sendWhatsAppMessage(phone, message, options)
        return { ...result, provider: 'twilio (fallback)' }
      } catch (fallbackError) {
        logError('WA_SERVICE', 'Fallback failed', fallbackError)
      }
    }

    throw error
  }
}

/**
 * Send ticket message with template
 */
export async function sendTicket(phone, ticketData) {
  if (!state.initialized) {
    throw new Error('WhatsApp service not initialized')
  }

  try {
    switch (state.provider) {
      case 'twilio':
        return await twilioModule.sendTicketMessage(phone, ticketData)
      default: {
        // Format message for whatsapp-web.js
        const { name, ticketNumber, eventName, date, gate } = ticketData
        const message = `🎫 *TIKET YAMAHA*\n\nHalo *${name}*,\n\n📋 *No. Tiket:* ${ticketNumber}\n🎪 *Event:* ${eventName}\n📅 *Tanggal:* ${date}\n🚪 *Gate:* ${gate}\n\nSimpan tiket ini dan tunjukkan QR Code saat check-in.`
        return await waWebModule.sendMessage(phone, message)
      }
    }
  } catch (error) {
    logError('WA_SERVICE', 'Send ticket failed', error)
    throw error
  }
}

/**
 * Get service health status
 */
export async function getHealth() {
  try {
    switch (state.provider) {
      case 'twilio':
        return twilioModule ? await twilioModule.healthCheck() : { status: 'not_loaded' }
      case 'whatsapp-web':
        return waWebModule ? await waWebModule.getHealth() : { status: 'not_loaded' }
      default:
        return { status: 'unknown' }
    }
  } catch (error) {
    return { status: 'error', error: error.message }
  }
}

/**
 * Switch provider dynamically
 */
export async function switchProvider(newProvider) {
  logInfo('WA_SERVICE', `Switching provider: ${state.provider} -> ${newProvider}`)
  
  state.provider = newProvider
  state.initialized = false
  
  return await initWhatsAppService()
}

/**
 * Get current service state
 */
export function getState() {
  return { ...state }
}

// Export state for monitoring
export { state }
