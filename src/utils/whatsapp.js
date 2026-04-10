
function normalizeTokenKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Helper function to replace {{nama}}, {{tiket}}, etc in the template
// + Supports extra placeholders from participant.meta (e.g. {{tanggal_lahir}}, {{catatan}})
export const generateWaMessage = (participant) => {
  const template = String(getWaTemplate() || '')
  const p = participant || {}

  let message = template
    .replace(/\{\{nama\}\}/g, p.name || '')
    .replace(/\{\{tiket\}\}/g, p.ticket_id || '')
    .replace(/\{\{hari\}\}/g, p.day_number || '')
    .replace(/\{\{kategori\}\}/g, p.category || '')

  const meta = p?.meta && typeof p.meta === 'object' ? p.meta : {}
  Object.entries(meta).forEach(([rawKey, rawVal]) => {
    const tokenKey = normalizeTokenKey(rawKey)
    if (!tokenKey) return
    const token = `{{${tokenKey}}}`
    const val = rawVal === undefined || rawVal === null ? '' : String(rawVal)
    // Replace all occurrences of token.
    message = message.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), val)
  })

  return message
}

/**
 * Helper utilities for WhatsApp integration
 */

// Format phone number to Indonesian format (62...)
export function formatPhoneNumberRaw(phone) {
  let cleaned = ('' + phone).replace(/\D/g, '')
  
  // If it starts with '0', replace with '62'
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1)
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned
  }
  
  return cleaned
}

export function formatPhoneDisplay(phone) {
  const p = formatPhoneNumberRaw(phone)
  if (p.length < 10) return phone // Return original if too short
  return `+${p.slice(0,2)} ${p.slice(2,5)}-${p.slice(5,9)}-${p.slice(9)}`
}

// Generate the WhatsApp message and URL
export function getWhatsAppShareLink(participant) {
  const phone = formatPhoneNumberRaw(participant.phone)
  
  // Create a fast, public QR code URL using a free QR API
  // That way we don't need Supabase Storage just for sharing the QR picture
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(participant.qr_data)}`
  
  // Generate message primarily from template
  const message = generateWaMessage(participant)
  const text = `${message}\n\n*Direct Link Barcode:* ${qrUrl}`
  
  const encodedText = encodeURIComponent(text)
  return `https://wa.me/${phone}?text=${encodedText}`
}
