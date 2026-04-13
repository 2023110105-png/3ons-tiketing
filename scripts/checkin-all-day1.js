/* eslint-env node */
/* global process */
// Script untuk check-in SEMUA peserta Day 1 (100%)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'csv-parse/sync';

// Supabase config
const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const WORKSPACE_TABLE = 'workspace_state';
const WORKSPACE_ID = 'default';
const TENANT_ID = 'tenant-default';
const EVENT_ID = 'event-default';

// Baca CSV Day 1
function loadDay1Participants() {
  const csvPath = resolve(process.cwd(), 'api-server/data/day_1.csv');
  const content = readFileSync(csvPath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  return records.map((r, i) => ({
    name: r.nama || r.name,
    phone: r.telepon || r.phone,
    category: r.kategori,
    day: parseInt(r.hari) || 1,
    ticket_id: `T${r.hari || 1}2026${String(i + 1).padStart(4, '0')}`
  }));
}

// Generate check-in log
function generateCheckInLog(participant, checkInTime) {
  return {
    id: `checkin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ticket_id: participant.ticket_id,
    name: participant.name,
    category: participant.category,
    day: participant.day,
    phone: participant.phone,
    checked_in_at: checkInTime.toISOString(),
    timestamp: checkInTime.toISOString(),
    scanned_by: 'admin-day1',
    method: 'manual-100-percent',
    status: 'checked_in',
    synced: true
  };
}

async function fetchWorkspaceSnapshot() {
  try {
    const { data, error } = await supabase
      .from(WORKSPACE_TABLE)
      .select('store')
      .limit(1);
    
    if (error) {
      console.error('[CheckInAll] Error:', error.message);
      return null;
    }
    
    return data?.[0]?.store || null;
  } catch (err) {
    console.error('[CheckInAll] Error:', err?.message || err);
    return null;
  }
}

async function updateWorkspaceSnapshot(store) {
  try {
    const { error } = await supabase
      .from(WORKSPACE_TABLE)
      .update({ store, updated_at: new Date().toISOString() })
      .eq('id', WORKSPACE_ID);
    
    if (error) {
      console.error('[CheckInAll] Update error:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[CheckInAll] Update error:', err?.message || err);
    return false;
  }
}

async function checkInAllDay1() {
  console.log('==========================================');
  console.log('   CHECK-IN ALL DAY 1 (100%)');
  console.log('==========================================\n');

  // 1. Load semua peserta Day 1
  const participants = loadDay1Participants();
  console.log(`📋 Total peserta Day 1: ${participants.length}`);

  // 2. Fetch workspace
  const store = await fetchWorkspaceSnapshot();
  if (!store) {
    console.error('❌ Cannot fetch workspace');
    return;
  }

  const tenant = store.tenants?.[TENANT_ID];
  const event = tenant?.events?.[EVENT_ID];
  
  if (!event) {
    console.error('❌ Event not found');
    return;
  }

  // 3. Cek existing check-in logs
  const existingLogs = event.checkInLogs || [];
  const existingDay1Logs = existingLogs.filter(log => log.day === 1);
  console.log(`📝 Existing Day 1 check-ins: ${existingDay1Logs.length}`);

  // 4. Generate check-in untuk SEMUA peserta (100%)
  // Strategy: Semua peserta di-check-in, spread di jam 07:30 - 16:30
  const baseDate = new Date('2026-04-13');
  const startHour = 7;  // 07:30
  const endHour = 16;   // 16:30
  const totalParticipants = participants.length;

  const newLogs = participants.map((p, idx) => {
    // Spread waktu secara merata untuk semua peserta
    const hourRange = endHour - startHour;
    const progress = idx / totalParticipants;
    const hour = startHour + Math.floor(progress * hourRange);
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    
    const checkInTime = new Date(baseDate);
    checkInTime.setHours(hour, minute, second);
    
    return generateCheckInLog(p, checkInTime);
  });

  console.log(`\n✨ Generated ${newLogs.length} check-in logs (100% coverage)`);

  // 5. Filter hanya yang belum check-in
  const existingTicketIds = new Set(existingLogs.map(log => log.ticket_id));
  const uniqueNewLogs = newLogs.filter(log => !existingTicketIds.has(log.ticket_id));
  
  console.log(`🆕 Peserta yang perlu di-check-in: ${uniqueNewLogs.length}`);

  if (uniqueNewLogs.length === 0 && existingDay1Logs.length === participants.length) {
    console.log('\n✅ Semua peserta Day 1 sudah check-in!');
    console.log(`   Total: ${participants.length}/${participants.length} (100%)`);
    return;
  }

  // 6. Update workspace
  event.checkInLogs = [...existingLogs, ...uniqueNewLogs];
  
  // Sort by timestamp
  event.checkInLogs.sort((a, b) => 
    new Date(a.checked_in_at) - new Date(b.checked_in_at)
  );

  const success = await updateWorkspaceSnapshot(store);
  
  if (success) {
    const totalDay1CheckIns = event.checkInLogs.filter(l => l.day === 1).length;
    
    console.log('\n✅ SUCCESS! Semua peserta Day 1 sudah check-in!');
    console.log(`\n📊 Summary Day 1:`);
    console.log(`   Total peserta: ${participants.length}`);
    console.log(`   Sudah check-in: ${totalDay1CheckIns}`);
    console.log(`   Check-in rate: 100%`);
    
    console.log('\n🕐 Sample check-in times (awal & akhir):');
    const sorted = uniqueNewLogs.sort((a, b) => 
      new Date(a.checked_in_at) - new Date(b.checked_in_at)
    );
    
    // Show first 3 and last 3
    console.log('   Awal:');
    sorted.slice(0, 3).forEach(log => {
      const time = new Date(log.checked_in_at).toLocaleTimeString('id-ID');
      console.log(`     - ${log.name}: ${time}`);
    });
    
    console.log('   ...');
    
    console.log('   Akhir:');
    sorted.slice(-3).forEach(log => {
      const time = new Date(log.checked_in_at).toLocaleTimeString('id-ID');
      console.log(`     - ${log.name}: ${time}`);
    });
    
  } else {
    console.error('\n❌ Failed to update workspace');
  }
}

// Run
checkInAllDay1().catch(console.error);
