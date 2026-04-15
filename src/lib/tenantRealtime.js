// Tenant Realtime Manager - Isolated Real-time Sync per Tenant
import { supabase } from './supabase';
import { getActiveTenantId } from './tenantUtils';

const activeChannels = new Map();
const callbacks = new Map();

// ============================================
// TENANT REALTIME CHANNEL MANAGER
// ============================================

export function createTenantChannel(table, onChangeCallback) {
  const tenantId = getActiveTenantId();
  const channelKey = `${table}:${tenantId}`;
  
  // Unsubscribe existing if any
  if (activeChannels.has(channelKey)) {
    const existing = activeChannels.get(channelKey);
    existing.unsubscribe();
    activeChannels.delete(channelKey);
  }
  
  // Store the callback
  if (!callbacks.has(channelKey)) {
    callbacks.set(channelKey, []);
  }
  if (onChangeCallback) {
    callbacks.get(channelKey).push(onChangeCallback);
  }
  
  // Create new channel with tenant filter
  const channel = supabase
    .channel(`${table}:${tenantId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        console.log(`[TenantRealtime] ${table} change for tenant ${tenantId}:`, payload.eventType);
        
        // Call all registered callbacks
        const channelCallbacks = callbacks.get(channelKey) || [];
        channelCallbacks.forEach(cb => cb(payload));
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[TenantRealtime] Connected to ${table} for tenant ${tenantId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[TenantRealtime] Error connecting to ${table}`);
      }
    });
  
  activeChannels.set(channelKey, channel);
  
  // Return unsubscribe function
  return () => {
    channel.unsubscribe();
    activeChannels.delete(channelKey);
    callbacks.delete(channelKey);
  };
}

// ============================================
// TABLE-SPECIFIC SUBSCRIPTIONS
// ============================================

export function subscribeParticipants(onChange) {
  const tenantId = getActiveTenantId();
  
  return createTenantChannel('participants', (payload) => {
    onChange({
      type: payload.eventType,
      data: payload.new || payload.old,
      tenantId
    });
  });
}

export function subscribeCheckIns(onChange) {
  const tenantId = getActiveTenantId();
  
  return createTenantChannel('checkin_logs', (payload) => {
    onChange({
      type: payload.eventType,
      data: payload.new || payload.old,
      tenantId
    });
  });
}

export function subscribeEvents(onChange) {
  const tenantId = getActiveTenantId();
  
  return createTenantChannel('events', (payload) => {
    onChange({
      type: payload.eventType,
      data: payload.new || payload.old,
      tenantId
    });
  });
}

// ============================================
// BULK SUBSCRIPTION MANAGER
// ============================================

export function subscribeToAllTables(handlers) {
  const unsubscribers = [];
  
  if (handlers.participants) {
    unsubscribers.push(subscribeParticipants(handlers.participants));
  }
  
  if (handlers.checkins) {
    unsubscribers.push(subscribeCheckIns(handlers.checkins));
  }
  
  if (handlers.events) {
    unsubscribers.push(subscribeEvents(handlers.events));
  }
  
  // Return combined unsubscribe
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// ============================================
// REALTIME STATE SYNC
// ============================================

export async function syncTenantState() {
  const tenantId = getActiveTenantId();
  
  // Fetch fresh data
  const [participants, events, checkins] = await Promise.all([
    supabase.from('participants').select('*').eq('tenant_id', tenantId),
    supabase.from('events').select('*').eq('tenant_id', tenantId),
    supabase.from('checkin_logs').select('*').eq('tenant_id', tenantId)
  ]);
  
  return {
    participants: participants.data || [],
    events: events.data || [],
    checkins: checkins.data || [],
    timestamp: new Date().toISOString()
  };
}

// ============================================
// BROADCAST CHANNEL (Cross-tab sync)
// ============================================

export function createBroadcastChannel(channelName, onMessage) {
  const tenantId = getActiveTenantId();
  const fullChannelName = `${channelName}:${tenantId}`;
  
  const channel = supabase.channel(fullChannelName);
  
  channel
    .on('broadcast', { event: '*' }, (payload) => {
      console.log(`[Broadcast] ${fullChannelName}:`, payload);
      onMessage(payload);
    })
    .subscribe();
  
  return {
    send: (message) => {
      channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });
    },
    unsubscribe: () => channel.unsubscribe()
  };
}

// ============================================
// PRESENCE (Who's online in this tenant)
// ============================================

export function subscribeTenantPresence(onJoin, onLeave) {
  const tenantId = getActiveTenantId();
  
  const channel = supabase.channel(`presence:${tenantId}`);
  
  channel
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach(presence => onJoin?.(presence));
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach(presence => onLeave?.(presence));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          online_at: new Date().toISOString(),
          tenant_id: tenantId
        });
      }
    });
  
  return () => channel.unsubscribe();
}

export default {
  createTenantChannel,
  subscribeParticipants,
  subscribeCheckIns,
  subscribeEvents,
  subscribeToAllTables,
  syncTenantState,
  createBroadcastChannel,
  subscribeTenantPresence
};
