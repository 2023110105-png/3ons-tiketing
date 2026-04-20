// Debug Helper - Quick diagnostics for the system

import { supabase } from './supabase';
import { getActiveTenantId } from './tenantUtils';

export const debugHelper = {
  // Check system health
  async checkHealth() {
    const results = {
      timestamp: new Date().toISOString(),
      tenantId: getActiveTenantId(),
      checks: {}
    };
    
    // 1. Check Supabase connection
    try {
      const { data, error } = await supabase.from('tenants').select('count', { count: 'exact' });
      results.checks.supabase = error ? { status: 'error', error: error.message } : { status: 'ok', count: data };
    } catch (e) {
      results.checks.supabase = { status: 'error', error: e.message };
    }
    
    // 2. Check participants table
    try {
      const { count, error } = await supabase
        .from('participants')
        .select('*', { count: 'exact' })
        .eq('tenant_id', getActiveTenantId());
      results.checks.participants = error ? { status: 'error', error: error.message } : { status: 'ok', count };
    } catch (e) {
      results.checks.participants = { status: 'error', error: e.message };
    }
    
    // 3. Check auth session
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      results.checks.auth = error ? { status: 'error', error: error.message } : { status: 'ok', user: session?.user?.email };
    } catch (e) {
      results.checks.auth = { status: 'error', error: e.message };
    }
    
    console.log('[DebugHelper] Health check:', results);
    return results;
  },
  
  // Quick test: Create and delete a test participant
  async testParticipantLifecycle() {
    const tenantId = getActiveTenantId();
    const testTicketId = `TEST-${Date.now()}`;
    
    try {
      // Create
      const { data: created, error: createError } = await supabase
        .from('participants')
        .insert({
          tenant_id: tenantId,
          ticket_id: testTicketId,
          name: 'Test User',
          category: 'Regular',
          day: 1
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Read
      const { error: readError } = await supabase
        .from('participants')
        .select('*')
        .eq('id', created.id)
        .single();
      
      if (readError) throw readError;
      
      // Update
      const { error: updateError } = await supabase
        .from('participants')
        .update({ name: 'Updated Test User' })
        .eq('id', created.id);
      
      if (updateError) throw updateError;
      
      // Delete
      const { error: deleteError } = await supabase
        .from('participants')
        .delete()
        .eq('id', created.id);
      
      if (deleteError) throw deleteError;
      
      console.log('[DebugHelper] Participant lifecycle test: PASSED ✅');
      return { success: true, participantId: created.id };
    } catch (error) {
      console.error('[DebugHelper] Participant lifecycle test: FAILED ❌', error);
      return { success: false, error: error.message };
    }
  },
  
  // Check realtime subscription
  testRealtime() {
    const tenantId = getActiveTenantId();
    
    const channel = supabase
      .channel(`test:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, (payload) => {
        console.log('[DebugHelper] Realtime test received:', payload);
      })
      .subscribe((status) => {
        console.log('[DebugHelper] Realtime subscription status:', status);
      });
    
    // Auto-unsubscribe after 10 seconds
    setTimeout(() => {
      channel.unsubscribe();
      console.log('[DebugHelper] Realtime test: Channel closed');
    }, 10000);
    
    return channel;
  },
  
  // Log current state
  logState() {
    const state = {
      tenantId: getActiveTenantId(),
      userAgent: navigator?.userAgent,
      url: window?.location?.href,
      localStorage: {
        user_session: localStorage.getItem('user_session') ? 'present' : 'missing',
        pending_checkins: localStorage.getItem('pending_checkins') ? 'present' : 'missing'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('[DebugHelper] Current state:', state);
    return state;
  }
};

// Browser console access
if (typeof window !== 'undefined') {
  window.debugHelper = debugHelper;
  console.log('[DebugHelper] Available via window.debugHelper');
  console.log('[DebugHelper] Usage:');
  console.log('  window.debugHelper.checkHealth()');
  console.log('  window.debugHelper.testParticipantLifecycle()');
  console.log('  window.debugHelper.testRealtime()');
  console.log('  window.debugHelper.logState()');
  console.log('  window.debugHelper.testSessionPersistence()');
}

/**
 * Test session persistence - simulates login and verifies storage
 */
export function testSessionPersistence() {
  const testUser = {
    id: 'test-123',
    username: 'testuser',
    name: 'Test User',
    user_type: 'tenant_admin',
    tenant_id: 'test-tenant',
    tenant: { id: 'test-tenant', name: 'Test Tenant' }
  };
  
  // Save session
  const sessionData = {
    user: testUser,
    loginAt: new Date().toISOString()
  };
  localStorage.setItem('user_session', JSON.stringify(sessionData));
  console.log('[SessionTest] Session saved:', sessionData);
  
  // Verify saved
  const stored = localStorage.getItem('user_session');
  if (!stored) {
    console.error('[SessionTest] FAILED: Session not found in localStorage');
    return false;
  }
  
  // Parse and validate
  try {
    const parsed = JSON.parse(stored);
    if (parsed.user && parsed.user.username === 'testuser') {
      console.log('[SessionTest] PASSED: Session persisted correctly');
      console.log('[SessionTest] To test refresh:');
      console.log('  1. Refresh browser (F5)');
      console.log('  2. Check console for [AuthSaaS] logs');
      console.log('  3. Run window.debugHelper.logState()');
      return true;
    } else {
      console.error('[SessionTest] FAILED: Invalid session data');
      return false;
    }
  } catch (e) {
    console.error('[SessionTest] FAILED:', e.message);
    return false;
  }
}

// Add to debugHelper
debugHelper.testSessionPersistence = testSessionPersistence;

export default debugHelper;
