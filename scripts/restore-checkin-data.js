/* eslint-env node */
// Script untuk memulihkan data peserta dan check-in logs

import { createClient } from '@supabase/supabase-js';

// Supabase config (hardcoded untuk restore script)
const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const WORKSPACE_TABLE = 'workspace_state';
const WORKSPACE_ID = 'ons-default-workspace';
const TENANT_ID = 'tenant-default';
const EVENT_ID = 'event-default';

async function fetchWorkspaceSnapshot() {
  try {
    // Coba dengan maybeSingle untuk handle multiple rows
    let { data, error } = await supabase
      .from(WORKSPACE_TABLE)
      .select('store')
      .eq('id', WORKSPACE_ID)
      .maybeSingle();
    
    if (error) {
      console.error('[Restore] Error fetching workspace:', error.message);
      return null;
    }

    // Jika tidak ketemu, coba dengan limit 1
    if (!data) {
      const result = await supabase
        .from(WORKSPACE_TABLE)
        .select('store')
        .limit(1);
      
      if (result.error) {
        console.error('[Restore] Error fetching with limit:', result.error.message);
        return null;
      }
      
      if (result.data && result.data.length > 0) {
        data = result.data[0];
      }
    }
    
    return data?.store || null;
  } catch (err) {
    console.error('[Restore] Error:', err?.message || err);
    return null;
  }
}

async function restoreCheckInData() {
  console.log('==========================================');
  console.log('   MEMULIHKAN DATA PESERTA & CHECK-IN');
  console.log('==========================================\n');

  // 1. Cek data di Supabase
  console.log('📡 Mengambil data dari Supabase...');
  const store = await fetchWorkspaceSnapshot();
  
  if (!store) {
    console.error('❌ Tidak dapat mengambil data dari Supabase');
    console.log('\n💡 Tips: Pastikan koneksi internet aktif dan Supabase URL/key benar');
    return;
  }

  const tenant = store.tenants?.[TENANT_ID];
  const event = tenant?.events?.[EVENT_ID];

  if (!event) {
    console.error('❌ Event tidak ditemukan di workspace');
    return;
  }

  // 2. Tampilkan statistik
  const participants = event.participants || [];
  const checkInLogs = event.checkInLogs || [];
  const currentDay = event.currentDay || 1;

  console.log('\n📊 STATISTIK DATA:');
  console.log('   Total Peserta:', participants.length);
  console.log('   Total Check-in Logs:', checkInLogs.length);
  console.log('   Hari Aktif:', currentDay);
  console.log('   Status Archiving:', event.isArchived ? 'Diarsipkan' : 'Aktif');

  // 3. Tampilkan daftar check-in logs terbaru
  if (checkInLogs.length > 0) {
    console.log('\n📝 CHECK-IN LOGS TERBARU (10 terakhir):');
    const sorted = [...checkInLogs].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.checked_in_at || 0);
      const dateB = new Date(b.timestamp || b.checked_in_at || 0);
      return dateB - dateA;
    });

    sorted.slice(0, 10).forEach((log, idx) => {
      const time = new Date(log.timestamp || log.checked_in_at).toLocaleString('id-ID');
      console.log(`   ${idx + 1}. ${log.name || log.ticket_id} - ${time}`);
    });

    if (sorted.length > 10) {
      console.log(`   ... dan ${sorted.length - 10} log lainnya`);
    }
  } else {
    console.log('\n⚠️  Tidak ada check-in logs di Supabase');
  }

  // 4. Tampilkan peserta berdasarkan kategori
  if (participants.length > 0) {
    const byCategory = participants.reduce((acc, p) => {
      const cat = p.category || 'Unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    console.log('\n👥 PESERTA BERDASARKAN KATEGORI:');
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} peserta`);
    });
  }

  // 5. Cek peserta yang sudah check-in vs belum
  const checkedInIds = new Set(checkInLogs.map(log => 
    String(log.ticket_id || '').trim().toLowerCase()
  ));
  
  const checkedInCount = participants.filter(p => 
    checkedInIds.has(String(p.ticket_id || '').trim().toLowerCase())
  ).length;

  console.log('\n✅ REKAPITULASI CHECK-IN:');
  console.log(`   Sudah Check-in: ${checkedInCount}/${participants.length}`);
  console.log(`   Belum Check-in: ${participants.length - checkedInCount}/${participants.length}`);

  if (participants.length > 0) {
    const percentage = ((checkedInCount / participants.length) * 100).toFixed(1);
    console.log(`   Persentase: ${percentage}%`);
  }

  console.log('\n==========================================');
  console.log('   DATA BERHASIL DIPERIKSA');
  console.log('==========================================');
  console.log('\n💾 Data tersimpan di Supabase.');
  console.log('🔄 Aplikasi akan otomatis sinkron saat online.');
}

// Jalankan restore
restoreCheckInData().catch(console.error);
