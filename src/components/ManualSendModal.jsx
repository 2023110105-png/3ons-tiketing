import { useState, useEffect } from 'react'
import { X, Send, Phone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiFetch } from '../utils/api'
import { generateWaMessage, getWhatsAppShareLink } from '../utils/whatsapp'

// Smart retry dengan exponential backoff
const RETRY_DELAYS = [1000, 2000, 4000, 8000]
const MAX_RETRIES = 4

function normalizePhone(value) {
  let phone = String(value || '').replace(/\s+/g, '').trim()
  // Add Indonesian country code if needed
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1)
  }
  if (!phone.startsWith('62') && phone.length > 0) {
    phone = '62' + phone
  }
  return phone
}

function validatePhone(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized || normalized.length < 10) {
    return { valid: false, error: 'Nomor WhatsApp terlalu pendek' }
  }
  if (!/^62\d{9,15}$/.test(normalized)) {
    return { valid: false, error: 'Format nomor tidak valid (contoh: 08123456789)' }
  }
  return { valid: true, normalized }
}

async function sendWithRetry(sendFn, maxRetries = MAX_RETRIES) {
  let lastError = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendFn()
      if (result?.success) {
        return { success: true, attempts: attempt + 1, result }
      }
      lastError = result?.error || 'Unknown error'
    } catch (err) {
      lastError = err?.message || 'Network error'
    }
    
    if (attempt < maxRetries) {
      const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  return { success: false, attempts: maxRetries + 1, error: lastError }
}

export default function ManualSendModal({ 
  isOpen, 
  onClose, 
  participant, 
  qrImageUrl, 
  onSendSuccess,
  tenantId = 'Primavera Production'
}) {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState(null) // 'success' | 'failed' | null
  const [sendError, setSendError] = useState(null)
  const [phoneError, setPhoneError] = useState(null)

  // Reset state when modal opens with new participant
  useEffect(() => {
    if (isOpen && participant) {
      // Pre-fill phone if available
      const initialPhone = participant.phone || participant.wa_number || participant.whatsapp || ''
      setPhone(initialPhone)
      setSendStatus(null)
      setSendError(null)
      setPhoneError(null)
    }
  }, [isOpen, participant])

  if (!isOpen || !participant) return null

  const handlePhoneChange = (e) => {
    const value = e.target.value
    setPhone(value)
    setPhoneError(null)
    setSendStatus(null)
  }

  const handleSendViaLink = () => {
    // Validate phone first
    const phoneValidation = validatePhone(phone)
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error)
      return
    }

    // Update participant phone with edited value
    const participantWithPhone = { ...participant, phone: phoneValidation.normalized }
    const waUrl = getWhatsAppShareLink(participantWithPhone)
    window.open(waUrl, '_blank')
    toast.success('WhatsApp dibuka', 'Mengarahkan ke WhatsApp Web/App')
  }

  const handleSend = async () => {
    // Validate phone
    const phoneValidation = validatePhone(phone)
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error)
      return
    }

    setSending(true)
    setSendStatus(null)
    setSendError(null)

    const normalizedPhone = phoneValidation.normalized

    try {
      const result = await sendWithRetry(async () => {
        const body = {
          ...participant,
          tenant_id: tenantId,
          phone: normalizedPhone,
          send_wa: true,
          send_email: false,
          wa_message: generateWaMessage(participant),
          wa_send_mode: 'message_with_barcode'
        }

        const res = await apiFetch('/api/send-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        
        const data = await res.json().catch(() => ({}))
        
        if (!res.ok || data?.success === false) {
          return { success: false, error: data?.error || `HTTP ${res.status}` }
        }
        return { success: true, data }
      })

      if (result.success) {
        setSendStatus('success')
        toast.success('Terkirim!', `${participant.name || participant.ticket_id} berhasil dikirim ke ${normalizedPhone}`)
        if (onSendSuccess) {
          onSendSuccess({ participant, phone: normalizedPhone, attempts: result.attempts })
        }
      } else {
        setSendStatus('failed')
        setSendError(result.error)
        toast.error('Gagal mengirim', `${participant.name || participant.ticket_id}: ${result.error}`)
      }
    } catch (err) {
      setSendStatus('failed')
      setSendError(err?.message || 'Gagal mengirim')
      toast.error('Error', err?.message || 'Gagal mengirim')
    } finally {
      setSending(false)
    }
  }

  // Format phone for display (with spaces for readability)
  const formatPhoneDisplay = (phone) => {
    const p = normalizePhone(phone)
    if (!p || p.length < 10) return phone
    // Format: +62 812 3456 7890
    return `+${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 9)} ${p.slice(9)}`
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal manual-send-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <Send size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Kirim Tiket Manual
          </h3>
          <button className="modal-close" onClick={onClose} disabled={sending}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Ticket Preview */}
          <div className="manual-send-preview">
            <div className="manual-send-preview-label">Preview Tiket:</div>
            <div className="qr-preview-card manual-send-ticket">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Ticket" className="qr-image-lg" />
              ) : (
                <div className="qr-placeholder">Memuat QR...</div>
              )}
            </div>
            <div className="manual-send-ticket-info">
              <strong>{participant.name || '-'}</strong>
              <span>{participant.ticket_id} · {participant.category} · Hari {participant.day_number || '-'}</span>
            </div>
          </div>

          {/* Phone Input */}
          <div className="manual-send-form">
            <label className="manual-send-label">
              <Phone size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Nomor WhatsApp Tujuan
            </label>
            <input
              type="tel"
              className={`form-input manual-send-input ${phoneError ? 'is-error' : ''}`}
              placeholder="Contoh: 08123456789"
              value={phone}
              onChange={handlePhoneChange}
              disabled={sending}
            />
            {phoneError && (
              <div className="manual-send-error">
                <AlertCircle size={14} style={{ marginRight: 4 }} />
                {phoneError}
              </div>
            )}
            {phone && !phoneError && (
              <div className="manual-send-hint">
                Akan dikirim ke: <strong>{formatPhoneDisplay(phone)}</strong>
              </div>
            )}
          </div>

          {/* Status Messages */}
          {sendStatus === 'success' && (
            <div className="manual-send-status success">
              <CheckCircle2 size={16} style={{ marginRight: 6 }} />
              Tiket berhasil dikirim!
            </div>
          )}
          {sendStatus === 'failed' && (
            <div className="manual-send-status failed">
              <AlertCircle size={16} style={{ marginRight: 6 }} />
              Gagal: {sendError}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={sending}
          >
            Batal
          </button>
          <button 
            className="btn btn-whatsapp" 
            onClick={handleSendViaLink}
            disabled={sending || !phone.trim()}
            title="Kirim via WhatsApp Web (buka link wa.me)"
          >
            <Send size={16} style={{ marginRight: 6 }} />
            Kirim via Link
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSend}
            disabled={sending || !phone.trim()}
          >
            {sending ? (
              <>
                <Loader2 size={16} className="spinner" style={{ marginRight: 6 }} />
                Mengirim...
              </>
            ) : (
              <>
                <Send size={16} style={{ marginRight: 6 }} />
                Kirim Otomatis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
