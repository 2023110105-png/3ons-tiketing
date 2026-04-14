/* eslint-env node */
// Script untuk menambahkan user baru ke Supabase workspace_state

import { createClient } from '@supabase/supabase-js';

// Supabase config
const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

// === KONFIGURASI USER BARU ===
const NEW_USER = {
  id: 'user-' + Date.now(),
  username: 'zakialhakim16',
  email: 'zakialhakim16@admin.com',
  password: 'mzaki155',
  role: 'admin', // 'admin' untuk Admin Panel, 'operator' untuk Operator
  is_active: true,
  name: 'Zaki Alhakim',
  tenant_id: 'Primavera Production',
  created_at: new Date().toISOString()
};

async function addUserToWorkspace() {
  console.log('==========================================');
  console.log('   MENAMBAHKAN USER BARU');
  console.log('==========================================\n');

  try {
    // 1. Baca workspace_state saat ini
    console.log('🔍 Membaca workspace_state...');
    const { data, error } = await supabase
      .from('workspace_state')
      .select('id, tenant_registry')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('❌ Error membaca workspace:', error.message);
      return;
    }

    const workspaceData = data?.tenant_registry || {};
    
    // 2. Pastikan struktur tenants ada
    if (!workspaceData.tenants) {
      workspaceData.tenants = {};
    }
    
    // 3. Pastikan Primavera Production ada
    if (!workspaceData.tenants['Primavera Production']) {
      workspaceData.tenants['Primavera Production'] = {
        id: 'Primavera Production',
        name: '3oNs Digital',
        users: []
      };
    }
    
    const tenant = workspaceData.tenants['Primavera Production'];
    if (!tenant.users) {
      tenant.users = [];
    }

    // 4. Cek apakah username sudah ada
    const existingUser = tenant.users.find(u => 
      u.username?.toLowerCase() === NEW_USER.username.toLowerCase() ||
      u.email?.toLowerCase() === NEW_USER.email.toLowerCase()
    );

    if (existingUser) {
      console.log('⚠️  User dengan username/email ini sudah ada:');
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log('\n📝 Update password saja...');
      
      // Update password
      existingUser.password = NEW_USER.password;
      existingUser.role = NEW_USER.role;
      existingUser.is_active = true;
    } else {
      // 5. Tambah user baru
      console.log('✨ Menambahkan user baru...');
      tenant.users.push(NEW_USER);
      console.log(`   Username: ${NEW_USER.username}`);
      console.log(`   Email: ${NEW_USER.email}`);
      console.log(`   Role: ${NEW_USER.role}`);
    }

    // 6. Update workspace_state
    console.log('\n💾 Menyimpan ke Supabase...');
    const { error: updateError } = await supabase
      .from('workspace_state')
      .update({ 
        tenant_registry: workspaceData,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'default');

    if (updateError) {
      console.error('❌ Error menyimpan:', updateError.message);
      return;
    }

    console.log('\n✅ USER BERHASIL DITAMBAHKAN!');
    console.log('==========================================');
    console.log(`   Username: ${NEW_USER.username}`);
    console.log(`   Password: ${NEW_USER.password}`);
    console.log(`   Role: ${NEW_USER.role}`);
    console.log(`   Tenant: Primavera Production`);
    console.log('==========================================');
    console.log('\n🔐 Anda bisa login sekarang!');

  } catch (err) {
    console.error('❌ Error tak terduga:', err?.message || err);
  }
}

// Run
addUserToWorkspace().catch(console.error);
