/* eslint-env node */
/* global process */
// Script untuk menambahkan check-in logs Day 1 (manual/simulasi)
// Mirip pola Day 2 tapi tidak sama persis

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
const WORKSPACE_ID = 'ons-default-workspace';
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
    method: 'manual-seed',
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
      console.error('[Seed] Error:', error.message);
      return null;
    }
    
    return data?.[0]?.store || null;
  } catch (err) {
    console.error('[Seed] Error:', err?.message || err);
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
      console.error('[Seed] Update error:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Seed] Update error:', err?.message || err);
    return false;
  }
}

async function seedDay1CheckIns() {
  console.log('==========================================');
  console.log('   SEED CHECK-IN DAY 1 (MANUAL)');
  console.log('==========================================\n');

  // 1. Load peserta Day 1
  const participants = loadDay1Participants();
  console.log(`📋 Loaded ${participants.length} participants from Day 1 CSV`);

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

  // 4. Generate new check-in logs (pola mirip Day 2 tapi beda)
  // Strategy: Check-in sekitar 60-70% peserta, spread di jam 08:00 - 17:00
  const targetCheckInCount = Math.floor(participants.length * 0.65); // 65% check-in rate
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const toCheckIn = shuffled.slice(0, targetCheckInCount);

  // Generate timestamps (13 April 2026, spread 08:00-16:30)
  const baseDate = new Date('2026-04-13');
  const startHour = 8; // 08:00
  const endHour = 16;  // 16:30

  const newLogs = toCheckIn.map((p, idx) => {
    // Spread waktu secara merata
    const hour = startHour + Math.floor((idx / targetCheckInCount) * (endHour - startHour));
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    
    const checkInTime = new Date(baseDate);
    checkInTime.setHours(hour, minute, second);
    
    return generateCheckInLog(p, checkInTime);
  });

  console.log(`\n✨ Generated ${newLogs.length} new check-in logs for Day 1`);

  // 5. Merge dengan existing logs (hindari duplicate ticket_id)
  const existingTicketIds = new Set(existingLogs.map(log => log.ticket_id));
  const uniqueNewLogs = newLogs.filter(log => !existingTicketIds.has(log.ticket_id));
  
  console.log(`🆕 Unique new logs to add: ${uniqueNewLogs.length}`);

  if (uniqueNewLogs.length === 0) {
    console.log('\n⚠️  All participants already checked in. Nothing to add.');
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
    console.log('\n✅ SUCCESS! Check-in logs Day 1 added.');
    console.log(`\n📊 Summary:`);
    console.log(`   Total participants Day 1: ${participants.length}`);
    console.log(`   New check-ins added: ${uniqueNewLogs.length}`);
    console.log(`   Total check-ins Day 1: ${event.checkInLogs.filter(l => l.day === 1).length}`);
    console.log(`   Check-in rate: ${((uniqueNewLogs.length / participants.length) * 100).toFixed(1)}%`);
    
    console.log('\n🕐 Sample check-in times:');
    uniqueNewLogs.slice(0, 5).forEach(log => {
      const time = new Date(log.checked_in_at).toLocaleTimeString('id-ID');
      console.log(`   - ${log.name}: ${time}`);
    });
  } else {
    console.error('\n❌ Failed to update workspace');
  }
}

// Run
seedDay1CheckIns().catch(console.error);
