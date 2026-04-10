/* eslint-env node */
/* global process */
// Script untuk restore admin user setelah reset data

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const TENANT_ID = 'tenant-default';

// Default admin user
const DEFAULT_USERS = [
  {
    id: 'user_admin_001',
    username: 'admin_eventplatform',
    password: 'admin123',
    role: 'admin',
    name: 'Admin Event',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'user_gate_front_001',
    username: 'petugas_depan',
    password: 'gate123',
    role: 'gate_front',
    name: 'Petugas Gate Depan',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'user_gate_back_001',
    username: 'petugas_belakang',
    password: 'gate123',
    role: 'gate_back',
    name: 'Petugas Gate Belakang',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

async function restoreAdminUser() {
  console.log('👤 RESTORE ADMIN USERS\n');
  
  try {
    // Get current workspace state
    const { data, error: fetchError } = await supabase
      .from('workspace_state')
      .select('tenant_registry, store')
      .eq('id', 'default')
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching workspace:', fetchError);
      process.exit(1);
    }
    
    const tenantRegistry = data?.tenant_registry || { activeTenantId: TENANT_ID, tenants: {} };
    
    // Ensure tenant exists
    if (!tenantRegistry.tenants[TENANT_ID]) {
      tenantRegistry.tenants[TENANT_ID] = {
        id: TENANT_ID,
        brandName: 'Yamaha Music',
        eventName: 'Strings Fiddler Convention 2026',
        status: 'active',
        created_at: new Date().toISOString(),
        activeEventId: 'event-default',
        quota: {
          maxParticipants: 500,
          maxGateDevices: 5,
          maxActiveEvents: 2
        },
        contract: {
          package: 'standard',
          payment_status: 'paid'
        },
        users: [],
        branding: {}
      };
    }
    
    // Set users
    tenantRegistry.tenants[TENANT_ID].users = DEFAULT_USERS;
    
    // Update workspace state
    const { error: updateError } = await supabase
      .from('workspace_state')
      .upsert({
        id: 'default',
        tenant_registry: tenantRegistry,
        store: data?.store || { tenants: {} },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (updateError) {
      console.error('❌ Error updating workspace:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Admin users berhasil di-restore!\n');
    console.log('📋 Users yang tersedia:');
    DEFAULT_USERS.forEach(u => {
      console.log(`   • ${u.username} (${u.role}) - pass: ${u.password}`);
    });
    console.log('\n🎉 Silakan login dengan credentials di atas.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

restoreAdminUser();
