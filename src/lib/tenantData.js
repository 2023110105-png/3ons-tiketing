// Tenant Data Operations - Multi-tenant CRUD with Realtime
import { supabase } from './supabase';
import { getActiveTenantId } from './tenantUtils';

// ============================================
// PARTICIPANT OPERATIONS (Tenant Isolated)
// ============================================

export async function getParticipants(day = null) {
  const tenantId = getActiveTenantId();
  
  let query = supabase
    .from('participants')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  
  if (day) {
    query = query.or(`day.eq.${day},day_number.eq.${day}`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[TenantData] Error fetching participants:', error);
    throw error;
  }
  
  return data || [];
}

export async function createParticipant(participantData) {
  const tenantId = getActiveTenantId();
  
  const { data, error } = await supabase
    .from('participants')
    .insert({
      ...participantData,
      tenant_id: tenantId
    })
    .select()
    .single();
  
  if (error) {
    console.error('[TenantData] Error creating participant:', error);
    throw error;
  }
  
  return data;
}

export async function updateParticipant(participantId, updates) {
  const tenantId = getActiveTenantId();
  
  const { data, error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', participantId)
    .eq('tenant_id', tenantId) // Security: ensure tenant match
    .select()
    .single();
  
  if (error) {
    console.error('[TenantData] Error updating participant:', error);
    throw error;
  }
  
  return data;
}

export async function deleteParticipant(participantId) {
  const tenantId = getActiveTenantId();
  
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('tenant_id', tenantId); // Security: ensure tenant match
  
  if (error) {
    console.error('[TenantData] Error deleting participant:', error);
    throw error;
  }
  
  return true;
}

// ============================================
// CHECKIN OPERATIONS (Tenant Isolated)
// ============================================

export async function recordCheckIn(ticketId, gateInfo = {}) {
  const tenantId = getActiveTenantId();
  
  // Get participant first
  const { data: participant } = await supabase
    .from('participants')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('tenant_id', tenantId)
    .single();
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  const { data, error } = await supabase
    .from('checkin_logs')
    .insert({
      tenant_id: tenantId,
      ticket_id: ticketId,
      participant_id: participant.id,
      gate_id: gateInfo.gate_id || 'unknown',
      gate_name: gateInfo.gate_name || 'Unknown Gate',
      checked_in_by: gateInfo.user_id || null,
      day: gateInfo.day || 1,
      status: 'checked_in'
    })
    .select()
    .single();
  
  if (error) {
    console.error('[TenantData] Error recording checkin:', error);
    throw error;
  }
  
  return data;
}

export async function getCheckIns(day = null) {
  const tenantId = getActiveTenantId();
  
  let query = supabase
    .from('checkin_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('checked_in_at', { ascending: false });
  
  if (day) {
    query = query.or(`day.eq.${day},day_number.eq.${day}`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[TenantData] Error fetching checkins:', error);
    throw error;
  }
  
  return data || [];
}

// ============================================
// REALTIME SUBSCRIPTIONS (Tenant Isolated)
// ============================================

export function subscribeToParticipants(callback) {
  const tenantId = getActiveTenantId();
  
  const channel = supabase
    .channel(`participants:${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
  
  return () => {
    channel.unsubscribe();
  };
}

export function subscribeToCheckIns(callback) {
  const tenantId = getActiveTenantId();
  
  const channel = supabase
    .channel(`checkin_logs:${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'checkin_logs',
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
  
  return () => {
    channel.unsubscribe();
  };
}

// ============================================
// STATS OPERATIONS (Tenant Isolated)
// ============================================

export async function getTenantStats(day = null) {
  const tenantId = getActiveTenantId();
  
  // Get participants count
  let participantsQuery = supabase
    .from('participants')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId);
  
  if (day) {
    participantsQuery = participantsQuery.or(`day.eq.${day},day_number.eq.${day}`);
  }
  
  const { count: totalCount, data: participants } = await participantsQuery;
  
  // Get checkin count
  let checkinQuery = supabase
    .from('checkin_logs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId);
  
  if (day) {
    checkinQuery = checkinQuery.or(`day.eq.${day},day_number.eq.${day}`);
  }
  
  const { count: checkedInCount } = await checkinQuery;
  
  // Calculate by category
  const byCategory = {};
  if (participants) {
    participants.forEach(p => {
      const cat = p.category || 'Regular';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, checkedIn: 0 };
      byCategory[cat].total++;
    });
  }
  
  return {
    total: totalCount || 0,
    checkedIn: checkedInCount || 0,
    notCheckedIn: (totalCount || 0) - (checkedInCount || 0),
    percentage: totalCount ? Math.round(((checkedInCount || 0) / totalCount) * 100) : 0,
    byCategory
  };
}

export default {
  getParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  recordCheckIn,
  getCheckIns,
  subscribeToParticipants,
  subscribeToCheckIns,
  getTenantStats
};
