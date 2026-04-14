/**
 * Supabase API Client
 * Centralized Supabase configuration
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseKey)

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

// Auth helpers
export const signInWithPassword = async (email, password) => {
  if (!supabase) throw new Error('Supabase not initialized')
  return supabase.auth.signInWithPassword({ email, password })
}

export const signOut = async () => {
  if (!supabase) return
  return supabase.auth.signOut()
}

export const getCurrentUser = async () => {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Database helpers
export const from = (table) => {
  if (!supabase) throw new Error('Supabase not initialized')
  return supabase.from(table)
}

// Realtime subscription helper
export const subscribeToTable = (table, callback, filter = '*') => {
  if (!supabase) return null
  
  const channel = supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, callback)
    .subscribe()
  
  return channel
}
