// ===== ULTRA-RELIABLE WHATSAPP BOT SERVICE =====
// Smart Retry System dengan Exponential Backoff

import { log } from '../utils/logger.js'

// Konfigurasi Bot (dapat diubah via environment variables)
const BOT_CONFIG = {
  // Exponential backoff delays (ms): 1s, 2s, 4s, 8s
  RETRY_DELAYS: process.env.WA_RETRY_DELAYS 
    ? process.env.WA_RETRY_DELAYS.split(',').map(Number) 
    : [1000, 2000, 4000, 8000],
  MAX_RETRIES: parseInt(process.env.WA_MAX_RETRIES) || 4,
  BATCH_SIZE: parseInt(process.env.WA_BATCH_SIZE) || 5,
  DELAY_BETWEEN_BATCHES: parseInt(process.env.WA_BATCH_DELAY) || 2000,
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.WA_RATE_LIMIT) || 30,
}

// Queue untuk mengelola pengiriman massal
class WhatsAppQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.sentCount = 0
    this.failedCount = 0
    this.lastResetTime = Date.now()
  }

  // Cek rate limit
  checkRateLimit() {
    const now = Date.now()
    const oneMinute = 60 * 1000
    
    // Reset counter setiap menit
    if (now - this.lastResetTime > oneMinute) {
      this.sentCount = 0
      this.failedCount = 0
      this.lastResetTime = now
    }
    
    return this.sentCount < BOT_CONFIG.RATE_LIMIT_PER_MINUTE
  }

  // Tambah ke queue
  add(item) {
    this.queue.push({
      ...item,
      attempts: 0,
      addedAt: Date.now()
    })
    if (!this.processing) {
      this.process()
    }
  }

  // Proses queue
  async process() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      // Cek rate limit
      if (!this.checkRateLimit()) {
        log('warn', 'whatsapp_rate_limit', { 
          message: 'Rate limit reached, waiting...',
          limit: BOT_CONFIG.RATE_LIMIT_PER_MINUTE 
        })
        await new Promise(r => setTimeout(r, 5000)) // Wait 5s
        continue
      }

      // Ambil batch
      const batch = this.queue.splice(0, BOT_CONFIG.BATCH_SIZE)
      
      // Proses batch secara parallel
      await Promise.all(
        batch.map(item => this.sendWithRetry(item))
      )

      // Delay antar batch
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, BOT_CONFIG.DELAY_BETWEEN_BATCHES))
      }
    }

    this.processing = false
  }

  // Smart Retry dengan Exponential Backoff
  async sendWithRetry(item) {
    const maxRetries = BOT_CONFIG.MAX_RETRIES
    const delays = BOT_CONFIG.RETRY_DELAYS
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendMessage(item)
        
        if (result.success) {
          this.sentCount++
          log('info', 'whatsapp_send_success', {
            ticket_id: item.ticket_id,
            phone: item.phone,
            attempts: attempt + 1
          })
          return { success: true, attempts: attempt + 1 }
        }
        
        // Cek apakah error bisa di-retry
        if (this.isNonRetryableError(result.error)) {
          this.failedCount++
          log('error', 'whatsapp_send_permanent_fail', {
            ticket_id: item.ticket_id,
            error: result.error,
            attempts: attempt + 1
          })
          return { success: false, error: result.error, attempts: attempt + 1 }
        }
        
        // Retry dengan delay
        if (attempt < maxRetries) {
          const delay = delays[Math.min(attempt, delays.length - 1)]
          log('warn', 'whatsapp_retry', {
            ticket_id: item.ticket_id,
            attempt: attempt + 1,
            delay
          })
          await new Promise(r => setTimeout(r, delay))
        }
      } catch (err) {
        const error = err?.message || 'Unknown error'
        
        if (attempt === maxRetries) {
          this.failedCount++
          log('error', 'whatsapp_send_fail', {
            ticket_id: item.ticket_id,
            error,
            attempts: attempt + 1
          })
          return { success: false, error, attempts: attempt + 1 }
        }
      }
    }
    
    return { 
      success: false, 
      error: 'Max retries exceeded',
      attempts: maxRetries + 1 
    }
  }

  // Simulasi kirim pesan (ganti dengan library WhatsApp yang sebenarnya)
  async sendMessage(item) {
    const { phone, wa_message, wa_send_mode, qr_data } = item
    
    // Validasi
    if (!phone || phone.length < 10) {
      return { success: false, error: 'Nomor WhatsApp tidak valid' }
    }
    
    if (!wa_message) {
      return { success: false, error: 'Pesan kosong' }
    }

    try {
      // TODO: Ganti dengan library WhatsApp yang sebenarnya
      // Contoh: whatsapp-web.js, baileys, atau API gateway
      
      // Simulasi pengiriman (90% success rate untuk testing)
      const isSuccess = Math.random() > 0.1
      
      if (!isSuccess) {
        // Simulasi error random
        const errors = [
          'Network timeout',
          'WhatsApp server busy',
          'Connection reset'
        ]
        return { 
          success: false, 
          error: errors[Math.floor(Math.random() * errors.length)]
        }
      }

      // Log pengiriman
      log('info', 'whatsapp_message_sent', {
        phone: phone.replace(/\d{4}$/, '****'), // Masking untuk privacy
        mode: wa_send_mode,
        has_qr: !!qr_data
      })

      return { success: true }
    } catch (err) {
      return { success: false, error: err?.message }
    }
  }

  // Error yang tidak perlu di-retry
  isNonRetryableError(error) {
    const nonRetryable = [
      'nomor tidak valid',
      'tidak terdaftar',
      'bukan user whatsapp',
      'invalid phone',
      'not a whatsapp user',
      'pesan kosong',
      'blocked',
      'banned'
    ]
    const errLower = String(error).toLowerCase()
    return nonRetryable.some(keyword => errLower.includes(keyword))
  }

  // Get status queue
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      config: BOT_CONFIG
    }
  }
}

// Singleton instance
const whatsappQueue = new WhatsAppQueue()

// Export functions
export function getBotConfig() {
  return BOT_CONFIG
}

export function updateBotConfig(newConfig) {
  Object.assign(BOT_CONFIG, newConfig)
  log('info', 'whatsapp_config_updated', BOT_CONFIG)
  return BOT_CONFIG
}

export function getQueueStatus() {
  return whatsappQueue.getStatus()
}

export async function sendTicketMessage(data) {
  return new Promise((resolve) => {
    whatsappQueue.add({
      ...data,
      callback: resolve
    })
  })
}

export function queueBatchMessages(items) {
  items.forEach(item => whatsappQueue.add(item))
  return {
    queued: items.length,
    status: whatsappQueue.getStatus()
  }
}

export { whatsappQueue }
