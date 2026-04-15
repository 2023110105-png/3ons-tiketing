/* eslint-env node */
/* global process */
// Script untuk reset data Supabase dari CSV files
// PERINGATAN: Data peserta di Supabase akan di-replace dengan data dari CSV!

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createHash } from 'crypto';

// Supabase config
const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const TENANT_ID = 'tenant-default';
const EVENT_ID = 'event-default';

// Generate QR data seperti di aplikasi
function generateQRData(ticketId, name, dayNumber, category) {
  const secret = 'ons2026_secure_key_v2';
  const data = `${ticketId}|${name}|${dayNumber}|${category}|${secret}`;
  const hash = createHash('sha256').update(data).digest('hex').substring(0, 16);
  return `ONS2026-${hash.toUpperCase()}`;
}

// Generate ticket ID
function generateTicketId(index, day) {
  return `T${day}2026${String(index + 1).padStart(4, '0')}`;
}

// Parse CSV file
function parseCSV(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  return records;
}

// Transform CSV data to participant format
function transformToParticipant(record, index, day) {
  const ticketId = generateTicketId(index, day);
  const name = record.nama || record.name || '';
  const phone = record.telepon || record.phone || '';
  const category = record.kategori || record.category || 'Regular';
  const dayNumber = parseInt(record.hari || record.day || day);
  
  const id = `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const qrData = generateQRData(ticketId, name, dayNumber, category);
  
  return {
    id,
    ticket_id: ticketId,
    name,
    phone,
    category,
    day_number: dayNumber,
    qr_data: qrData,
    created_at: new Date().toISOString(),
    checked_in: false,
    check_in_time: null,
    gate: null
  };
}

async function resetSupabaseData() {
  console.log('🔄 RESET SUPABASE DATA FROM CSV\n');
  
  const confirmed = process.argv.includes('--confirm');
  
  if (!confirmed) {
    console.log('⚠️  PERINGATAN: Data peserta di Supabase akan di-replace!\n');
    console.log('💡 Untuk melanjutkan, jalankan dengan flag --confirm:\n');
    console.log('   node scripts/reset-supabase-from-csv.js --confirm\n');
    console.log('🛑 Proses dibatalkan.');
    return;
  }
  
  console.log('📖 Membaca CSV files...\n');
  
  // Read CSV files
  const day1Records = parseCSV('./api-server/data/day_1.csv');
  const day2Records = parseCSV('./api-server/data/day2.csv');
  
  console.log(`   ✅ Day 1: ${day1Records.length} peserta`);
  console.log(`   ✅ Day 2: ${day2Records.length} peserta`);
  console.log(`   📊 Total: ${day1Records.length + day2Records.length} peserta\n`);
  
  // Transform to participants
  const day1Participants = day1Records.map((r, i) => transformToParticipant(r, i, 1));
  const day2Participants = day2Records.map((r, i) => transformToParticipant(r, i, 2));
  const allParticipants = [...day1Participants, ...day2Participants];
  
  // Build workspace state structure
  const workspaceState = {
    tenant_registry: {
      activeTenantId: TENANT_ID,
      tenants: {
        [TENANT_ID]: {
          id: TENANT_ID,
          brandName: 'Yamaha Music',
          eventName: 'Strings Fiddler Convention 2026',
          status: 'active',
          created_at: new Date().toISOString(),
          activeEventId: EVENT_ID,
          quota: {
            maxParticipants: 500,
            maxGateDevices: 5,
            maxActiveEvents: 2
          },
          contract: {
            package: 'standard',
            payment_status: 'paid'
          },
          users: []
        }
      }
    },
    store: {
      tenants: {
        [TENANT_ID]: {
          activeEventId: EVENT_ID,
          events: {
            [EVENT_ID]: {
              id: EVENT_ID,
              name: 'Strings Fiddler Convention 2026',
              currentDay: 1,
              isArchived: false,
              created_at: new Date().toISOString(),
              participants: allParticipants,
              deletedParticipantIds: {},
              checkInLogs: [],
              adminLogs: [],
              pendingCheckIns: [],
              offlineQueueHistory: [],
              offlineConfig: {
                maxPendingAttempts: 5
              },
              waTemplate: null,
              waSendMode: 'message_with_barcode'
            }
          }
        }
      }
    }
  };
  
  console.log('💾 Menyimpan ke Supabase...\n');
  
  try {
    // Update workspace_state in Supabase
    const { error } = await supabase
      .from('workspace_state')
      .upsert({
        id: 'default',
        tenant_registry: workspaceState.tenant_registry,
        store: workspaceState.store,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ Error saat menyimpan ke Supabase:', error);
      process.exit(1);
    }
    
    console.log('✅ Berhasil! Data Supabase telah di-reset.\n');
    console.log('📊 Ringkasan:');
    console.log(`   • Day 1: ${day1Participants.length} peserta`);
    console.log(`   • Day 2: ${day2Participants.length} peserta`);
    console.log(`   • Total: ${allParticipants.length} peserta`);
    console.log('\n🎉 Selesai! Refresh aplikasi untuk melihat data yang benar.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

resetSupabaseData();
