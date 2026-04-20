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
 * Update active event untuk tenant (stored in localStorage)
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
    // Save to localStorage
    const key = `active_event_${tenantId}`
    localStorage.setItem(key, eventId)
    return true
  } catch (err) {
    console.error('Error setting active event:', err)
    return false
  }
}

/**
 * Get active event ID untuk tenant (from localStorage)
 * @param {string} tenantId - ID tenant
 * @returns {Promise<string|null>} - Active event ID
 */
export async function getActiveEventIdFromDB(tenantId) {
  if (!tenantId) return null

  try {
    // Get from localStorage
    const key = `active_event_${tenantId}`
    return localStorage.getItem(key)
  } catch (err) {
    console.error('Error getting active event:', err)
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

/**
 * Delete event dari database (beserta semua data terkait)
 * @param {string} tenantId - ID tenant
 * @param {string} eventId - ID event yang akan dihapus
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteEventFromDB(tenantId, eventId) {
  if (!tenantId || !eventId) {
    console.error('Tenant ID and Event ID are required')
    return false
  }

  try {
    // Hapus event (cascade akan menghapus participants dan checkin_logs)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('tenant_id', tenantId) // Pastikan hanya hapus event milik tenant ini

    if (error) {
      console.error('Error deleting event:', error)
      return false
    }

    // Hapus dari localStorage jika ini adalah active event
    const activeKey = `active_event_${tenantId}`
    const currentActive = localStorage.getItem(activeKey)
    if (currentActive === eventId) {
      localStorage.removeItem(activeKey)
    }

    console.log(`[deleteEventFromDB] Deleted event ${eventId} for tenant ${tenantId}`)
    return true
  } catch (err) {
    console.error('Exception deleting event:', err)
    return false
  }
}

export default {
  fetchEventsByTenant,
  createEventInDB,
  setActiveEventInDB,
  getActiveEventIdFromDB,
  deleteEventFromDB,
  subscribeToEvents
}
