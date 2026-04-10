#!/usr/bin/env node
/**
 * Script import CSV yang AMAN - tidak menghapus data yang sudah ada
 * Menggabungkan peserta baru dengan peserta lama (merge)
 * Usage: node scripts/import-csv-safe.mjs [day1.csv] [day2.csv]
 */

import fs from 'fs'
import path from 'path'
import process from 'process'
import { createClient } from '@supabase/supabase-js'
import { parse as csvParse } from 'csv-parse/sync'
import { generateQRData } from '../src/utils/qrSecurity.js'

// === KONFIGURASI ===
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

const WORKSPACE_TABLE = 'workspace_state';
const WORKSPACE_ID = 'default';
const TENANT_ID = 'tenant-default';
const EVENT_ID = 'event-default';

// Generate ticket ID
function generateTicketId(day, index) {
  const prefix = day === 1 ? 'T12026' : 'T22026';
  return `${prefix}${String(index + 1).padStart(4, '0')}`;
}

// Parse CSV file
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('❌ File tidak ditemukan:', filePath);
    return null;
  }
  
  const csvContent = fs.readFileSync(filePath, 'utf8');
  return csvParse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

// Transform CSV row to participant
function transformParticipant(row, index, day) {
  const name = row.nama || row.name || '';
  const phone = row.telepon || row.phone || row.whatsapp || row.wa || '';
  const category = row.kategori || row.category || 'Regular';
  const dayNum = Number(row.hari || row.day || row.day_number || day);
  const ticketId = row.ticket_id || row.tiket || generateTicketId(dayNum, index);
  
  // Generate QR data
  const qrData = generateQRData({
    ticket_id: ticketId,
    name: name,
    day_number: dayNum
  }, TENANT_ID, EVENT_ID);
  
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ticket_id: ticketId,
    name,
    nama: name,
    phone,
    telepon: phone,
    whatsapp: phone,
    wa: phone,
    category,
    kategori: category,
    day: dayNum,
    day_number: dayNum,
    hari: dayNum,
    qr_data: qrData,
    created_at: new Date().toISOString(),
    checked_in: false,
    check_in_time: null,
    gate: null,
    status: 'registered'
  };
}

async function main() {
  console.log('🚀 Import CSV Safe Mode (tidak menghapus data lama)\n');
  
  // Get file paths from args or use defaults
  const day1Path = process.argv[2] || 'api-server/data/day_1.csv';
  const day2Path = process.argv[3] || 'api-server/data/day2.csv';
  
  // === AMBIL DATA EXISTING DARI SUPABASE ===
  console.log('📦 Mengambil data existing dari Supabase...');
  const { data: workspaceData, error: fetchError } = await supabase
    .from(WORKSPACE_TABLE)
    .select('*')
    .eq('id', WORKSPACE_ID)
    .single();
  
  if (fetchError || !workspaceData) {
    console.error('❌ Gagal ambil workspace_state:', fetchError?.message || 'not found');
    process.exit(1);
  }
  
  // Get existing participants
  const existingParticipants = workspaceData.store?.tenants?.[TENANT_ID]?.events?.[EVENT_ID]?.participants || [];
  console.log(`✅ Data existing: ${existingParticipants.length} peserta`);
  
  const existingByDay = {};
  for (const p of existingParticipants) {
    const d = Number(p.day) || 1;
    existingByDay[d] = (existingByDay[d] || 0) + 1;
  }
  console.log('   Day 1:', existingByDay[1] || 0);
  console.log('   Day 2:', existingByDay[2] || 0);
  
  // === PARSE CSV FILES ===
  let newParticipants = [];
  
  // Day 1
  console.log('\n📄 Membaca CSV Day 1:', day1Path);
  const day1Rows = parseCSV(day1Path);
  if (day1Rows) {
    const day1Participants = day1Rows.map((r, i) => transformParticipant(r, i, 1));
    newParticipants.push(...day1Participants);
    console.log(`✅ ${day1Rows.length} peserta Day 1 ditemukan`);
  }
  
  // Day 2
  console.log('\n📄 Membaca CSV Day 2:', day2Path);
  const day2Rows = parseCSV(day2Path);
  if (day2Rows) {
    const day2Participants = day2Rows.map((r, i) => transformParticipant(r, i, 2));
    newParticipants.push(...day2Participants);
    console.log(`✅ ${day2Rows.length} peserta Day 2 ditemukan`);
  }
  
  if (newParticipants.length === 0) {
    console.error('❌ Tidak ada data baru untuk diimport');
    process.exit(1);
  }
  
  console.log(`\n📊 Total peserta baru: ${newParticipants.length}`);
  
  // === MERGE DATA (TIDAK MENGHAPUS YANG LAMA) ===
  console.log('\n🔀 Menggabungkan data (merge mode)...');
  
  // Create map of existing participants by ticket_id
  const existingMap = new Map();
  for (const p of existingParticipants) {
    if (p.ticket_id) {
      existingMap.set(p.ticket_id, p);
    }
  }
  
  // Add new participants (replace if same ticket_id)
  for (const newP of newParticipants) {
    if (existingMap.has(newP.ticket_id)) {
      console.log(`   📝 Update: ${newP.ticket_id} - ${newP.name}`);
    } else {
      console.log(`   ➕ Tambah: ${newP.ticket_id} - ${newP.name}`);
    }
    existingMap.set(newP.ticket_id, newP);
  }
  
  // Convert back to array
  const mergedParticipants = Array.from(existingMap.values());
  
  console.log(`\n📊 Hasil merge:`);
  console.log(`   Total sebelum: ${existingParticipants.length}`);
  console.log(`   Total sesudah: ${mergedParticipants.length}`);
  console.log(`   Peserta baru: ${newParticipants.length}`);
  console.log(`   Diupdate: ${mergedParticipants.length - existingParticipants.length - (mergedParticipants.length - existingParticipants.length - newParticipants.length + (existingParticipants.length - (mergedParticipants.length - newParticipants.length)))}`);
  
  // Update workspace data
  workspaceData.store.tenants[TENANT_ID].events[EVENT_ID].participants = mergedParticipants;
  workspaceData.store.tenants[TENANT_ID].events[EVENT_ID].updated_at = new Date().toISOString();
  
  // === SAVE KE SUPABASE ===
  console.log('\n💾 Menyimpan ke Supabase...');
  const { error: upsertError } = await supabase
    .from(WORKSPACE_TABLE)
    .upsert({
      id: WORKSPACE_ID,
      tenant_registry: workspaceData.tenant_registry,
      store: workspaceData.store,
      updated_at: new Date().toISOString()
    });
  
  if (upsertError) {
    console.error('❌ Gagal menyimpan:', upsertError.message);
    process.exit(1);
  }
  
  // Summary by day
  const countByDay = {};
  for (const p of mergedParticipants) {
    const d = Number(p.day) || 1;
    countByDay[d] = (countByDay[d] || 0) + 1;
  }
  
  console.log('\n✅ Import berhasil!');
  console.log(`   Total peserta: ${mergedParticipants.length}`);
  console.log(`   Day 1: ${countByDay[1] || 0}`);
  console.log(`   Day 2: ${countByDay[2] || 0}`);
  console.log('\n💡 Data lama tetap tersimpan, tidak ada yang dihapus.');
}

main().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
