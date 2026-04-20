/**
 * Participant Service - Supabase Integration with Tenant Isolation
 * 
 * CRUD operations for participants with tenant and event isolation
 */

import { supabase } from './supabase'

/**
 * Fetch participants by tenant and event
 * @param {string} tenantId - Tenant ID
 * @param {string} eventId - Event ID (UUID dari database)
 * @returns {Promise<Array>} - Array of participants
 */
export async function fetchParticipants(tenantId, eventId) {
  if (!tenantId || !eventId) {
    console.error('Tenant ID and Event ID are required')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching participants:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Exception fetching participants:', err)
    return []
  }
}

/**
 * Add new participant to database
 * @param {string} tenantId - Tenant ID
 * @param {string} eventId - Event ID (UUID)
 * @param {object} participantData - Participant data
 * @returns {Promise<object>} - Created participant
 */
export async function addParticipantToDB(tenantId, eventId, participantData) {
  if (!tenantId || !eventId) {
    throw new Error('Tenant ID and Event ID are required')
  }

  const participant = {
    tenant_id: tenantId,
    event_id: eventId,
    ticket_id: participantData.ticket_id || `T${Date.now()}`,
    name: participantData.name?.trim() || '',
    phone: participantData.phone?.trim() || '',
    email: participantData.email?.trim() || '',
    category: participantData.category || 'Regular',
    day_number: parseInt(participantData.day_number) || 1,
    qr_data: participantData.qr_data || '',
    status: 'registered', // registered, checked_in, cancelled
    checkin_time: null,
    gate: null,
    metadata: participantData.metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('participants')
      .insert([participant])
      .select()
      .single()

    if (error) {
      console.error('Error adding participant:', error)
      throw error
    }

    return data
  } catch (err) {
    console.error('Exception adding participant:', err)
    throw err
  }
}

/**
 * Update participant check-in status
 * @param {string} participantId - Participant UUID
 * @param {object} checkinData - Check-in data
 * @returns {Promise<boolean>} - Success status
 */
export async function checkInParticipant(participantId, checkinData = {}) {
  if (!participantId) return false

  try {
    const { error } = await supabase
      .from('participants')
      .update({
        status: 'checked_in',
        checkin_time: new Date().toISOString(),
        gate: checkinData.gate || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId)

    if (error) {
      console.error('Error checking in participant:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception checking in participant:', err)
    return false
  }
}

/**
 * Delete participant
 * @param {string} participantId - Participant UUID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteParticipantFromDB(participantId) {
  if (!participantId) return false

  try {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId)

    if (error) {
      console.error('Error deleting participant:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception deleting participant:', err)
    return false
  }
}

/**
 * Delete all participants for a tenant and event (bulk delete)
 * @param {string} tenantId - Tenant ID
 * @param {string} eventId - Event ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteAllParticipantsFromDB(tenantId, eventId) {
  if (!tenantId || !eventId) {
    console.error('Tenant ID and Event ID are required for bulk delete')
    return false
  }

  try {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)

    if (error) {
      console.error('Error deleting all participants:', error)
      return false
    }

    console.log(`[deleteAllParticipantsFromDB] Deleted all participants for tenant ${tenantId}, event ${eventId}`)
    return true
  } catch (err) {
    console.error('Exception deleting all participants:', err)
    return false
  }
}

/**
 * Delete all checkin logs for a tenant and event (bulk delete)
 * @param {string} tenantId - Tenant ID
 * @param {string} eventId - Event ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteAllCheckinLogsFromDB(tenantId, eventId) {
  if (!tenantId || !eventId) {
    console.error('Tenant ID and Event ID are required for bulk delete checkin logs')
    return false
  }

  try {
    const { error } = await supabase
      .from('checkin_logs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)

    if (error) {
      console.error('Error deleting all checkin logs:', error)
      return false
    }

    console.log(`[deleteAllCheckinLogsFromDB] Deleted all checkin logs for tenant ${tenantId}, event ${eventId}`)
    return true
  } catch (err) {
    console.error('Exception deleting all checkin logs:', err)
    return false
  }
}

/**
 * Subscribe to realtime participant changes
 * @param {string} tenantId - Tenant ID
 * @param {string} eventId - Event ID
 * @param {function} callback - Callback function
 * @returns {function} - Unsubscribe function
 */
export function subscribeToParticipants(tenantId, eventId, callback) {
  if (!tenantId || !eventId) return () => {}

  const subscription = supabase
    .channel(`participants-${tenantId}-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `tenant_id=eq.${tenantId}&event_id=eq.${eventId}`
      },
      (payload) => {
        console.log('Participants change received:', payload)
        callback(payload)
      }
    )
    .subscribe()

  return () => subscription.unsubscribe()
}

export default {
  fetchParticipants,
  addParticipantToDB,
  checkInParticipant,
  deleteParticipantFromDB,
  deleteAllParticipantsFromDB,
  deleteAllCheckinLogsFromDB,
  subscribeToParticipants
}
