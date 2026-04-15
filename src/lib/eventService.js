/**
 * Event Service - Supabase Integration with Tenant Isolation
 * 
 * Fungsi untuk mengelola events dengan tenant isolation
 * Setiap tenant hanya bisa melihat dan mengelola events mereka sendiri
 */

import { supabase } from './supabase'

/**
 * Fetch events untuk tenant yang sedang login
 * @param {string} tenantId - ID tenant dari user yang login
 * @returns {Promise<Array>} - Array of events
 */
export async function fetchEventsByTenant(tenantId) {
  if (!tenantId) {
    console.error('Tenant ID is required')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching events:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Exception fetching events:', err)
    return []
  }
}

/**
 * Create new event untuk tenant
 * @param {string} tenantId - ID tenant
 * @param {string} name - Nama event
 * @param {object} options - Options tambahan
 * @returns {Promise<object>} - Created event data
 */
export async function createEventInDB(tenantId, name, options = {}) {
  if (!tenantId || !name) {
    throw new Error('Tenant ID and name are required')
  }

  const eventData = {
    tenant_id: tenantId,
    name: name.trim(),
    is_archived: false,
    current_day: options.currentDay || 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single()

    if (error) {
      console.error('Error creating event:', error)
      throw error
    }

    return data
  } catch (err) {
    console.error('Exception creating event:', err)
    throw err
  }
}

/**
 * Update active event untuk tenant
 * @param {string} tenantId - ID tenant
 * @param {string} eventId - ID event yang aktif
 * @returns {Promise<boolean>} - Success status
 */
export async function setActiveEventInDB(tenantId, eventId) {
  if (!tenantId || !eventId) {
    console.error('Tenant ID and Event ID are required')
    return false
  }

  try {
    // Update tenant active_event_id
    const { error } = await supabase
      .from('tenants')
      .update({ 
        active_event_id: eventId,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)

    if (error) {
      console.error('Error setting active event:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception setting active event:', err)
    return false
  }
}

/**
 * Get active event ID untuk tenant
 * @param {string} tenantId - ID tenant
 * @returns {Promise<string|null>} - Active event ID
 */
export async function getActiveEventIdFromDB(tenantId) {
  if (!tenantId) return null

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('active_event_id')
      .eq('id', tenantId)
      .single()

    if (error) {
      console.error('Error getting active event:', error)
      return null
    }

    return data?.active_event_id || null
  } catch (err) {
    console.error('Exception getting active event:', err)
    return null
  }
}

/**
 * Subscribe to realtime events changes untuk tenant
 * @param {string} tenantId - ID tenant
 * @param {function} callback - Callback function saat ada perubahan
 * @returns {function} - Unsubscribe function
 */
export function subscribeToEvents(tenantId, callback) {
  if (!tenantId) return () => {}

  const subscription = supabase
    .channel(`events-${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        console.log('Events change received:', payload)
        callback(payload)
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

export default {
  fetchEventsByTenant,
  createEventInDB,
  setActiveEventInDB,
  getActiveEventIdFromDB,
  subscribeToEvents
}
