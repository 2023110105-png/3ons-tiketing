import { Router } from 'express'
import { z } from 'zod'
import { getFirestore } from '../firebaseAdmin.js'
import { safeErrorCode, sendError } from '../utils/http.js'
import { requestLog } from '../utils/logger.js'

const VerifySchema = z.object({
  qr_data: z.string().trim().min(1),
  tenant_id: z.string().trim().min(1),
  secure_code: z.string().optional().default(''),
  secure_ref: z.string().optional().default('')
})

export function createTicketRoutes({ writeRateLimit }) {
  const router = Router()

  // Public ticket verification endpoint for gate scanners
  // Does NOT require platform admin secret - this is called from the field
  router.post('/api/ticket/verify', writeRateLimit, async (req, res) => {
    try {
      const body = VerifySchema.parse(req.body)
      const { qr_data, tenant_id, secure_code, secure_ref } = body

      // Parse QR data to get ticket_id
      let parsedQr
      try {
        parsedQr = JSON.parse(qr_data)
      } catch {
        requestLog(req, 'ticket_verify_invalid_qr', { tenant_id }, 'warn')
        return res.status(400).json({
          success: false,
          valid: false,
          reason: 'invalid_qr_format',
          error_code: 'invalid_qr_format'
        })
      }

      const ticketId = String(parsedQr?.tid || '').trim()
      const qrDay = Number(parsedQr?.d || 1)

      if (!ticketId) {
        requestLog(req, 'ticket_verify_missing_tid', { tenant_id }, 'warn')
        return res.status(400).json({
          success: false,
          valid: false,
          reason: 'missing_ticket_id',
          error_code: 'missing_ticket_id'
        })
      }

      // Look up participant in Firestore
      const db = getFirestore()
      const participantsRef = db
        .collection('tenants')
        .doc(tenant_id)
        .collection('events')
        .doc('event-default')
        .collection('participants')

      let participantDoc = await participantsRef.doc(ticketId).get()
      let participant = null
      let matchedByName = false
      let matchedParticipantId = ticketId

      if (!participantDoc.exists) {
        // AUTO-RECOGNITION: Try to match by name from QR data (for old QR codes after data reset)
        const qrName = String(parsedQr?.n || '').trim()
        
        if (qrName) {
          requestLog(req, 'ticket_verify_trying_name_match', { 
            tenant_id, 
            ticket_id: ticketId, 
            qr_name: qrName,
            qr_day: qrDay 
          }, 'info')
          
          // Search participants by name and day
          const nameQuery = await participantsRef
            .where('name', '==', qrName)
            .where('day_number', '==', qrDay)
            .limit(1)
            .get()
          
          if (!nameQuery.empty) {
            participantDoc = nameQuery.docs[0]
            participant = participantDoc.data()
            matchedByName = true
            matchedParticipantId = participantDoc.id
            
            requestLog(req, 'ticket_verify_name_match_success', { 
              tenant_id, 
              old_ticket_id: ticketId,
              new_ticket_id: matchedParticipantId,
              name: qrName 
            }, 'info')
          }
        }
        
        if (!participant) {
          requestLog(req, 'ticket_verify_not_found', { tenant_id, ticket_id: ticketId }, 'info')
          return res.json({
            success: true,
            valid: false,
            reason: 'ticket_not_found',
            mode: 'server'
          })
        }
      } else {
        participant = participantDoc.data()
      }

      // Check if ticket day matches
      const participantDay = Number(participant?.day || participant?.day_number || 1)
      if (qrDay !== participantDay) {
        requestLog(req, 'ticket_verify_wrong_day', {
          tenant_id,
          ticket_id: ticketId,
          qr_day: qrDay,
          participant_day: participantDay
        }, 'info')
        return res.json({
          success: true,
          valid: false,
          reason: 'wrong_day',
          expected_day: participantDay,
          scanned_day: qrDay,
          mode: 'server'
        })
      }

      // Verify secure code if present on participant record
      if (participant?.secure_code || participant?.secure_ref) {
        const expectedCode = String(participant?.secure_code || participant?.secure_ref || '').trim()
        const providedCode = String(secure_code || secure_ref || '').trim()

        if (expectedCode && providedCode && expectedCode !== providedCode) {
          requestLog(req, 'ticket_verify_invalid_secure', { tenant_id, ticket_id: ticketId }, 'warn')
          return res.json({
            success: true,
            valid: false,
            reason: 'invalid_secure_code',
            mode: 'server'
          })
        }
      }

      // Check if already checked in (gunakan matchedParticipantId yang benar)
      const checkInLogsRef = db
        .collection('tenants')
        .doc(tenant_id)
        .collection('events')
        .doc('event-default')
        .collection('checkin_logs')

      const existingCheckIn = await checkInLogsRef
        .where('ticket_id', '==', matchedParticipantId)
        .where('day', '==', qrDay)
        .limit(1)
        .get()

      if (!existingCheckIn.empty) {
        requestLog(req, 'ticket_verify_duplicate', { tenant_id, ticket_id: matchedParticipantId }, 'info')
        return res.json({
          success: true,
          valid: false,
          reason: 'already_checked_in',
          mode: 'server'
        })
      }

      // All checks passed - ticket is valid
      requestLog(req, 'ticket_verify_success', { 
        tenant_id, 
        ticket_id: matchedParticipantId,
        name_matched: matchedByName 
      }, 'info')
      
      return res.json({
        success: true,
        valid: true,
        reason: 'ok',
        mode: 'server',
        name_matched: matchedByName, // Info untuk frontend
        participant: {
          id: participantDoc.id,
          name: participant?.name || '',
          category: participant?.category || 'Regular',
          ticket_id: matchedParticipantId, // Return the correct (new) ticket_id
          day: participantDay
        }
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, req, 'invalid_payload')
      }
      requestLog(req, 'ticket_verify_error', { error_code: safeErrorCode(err) }, 'error')
      return sendError(res, 500, req, safeErrorCode(err))
    }
  })

  return router
}
