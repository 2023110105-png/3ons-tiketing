#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import process from 'process'
import { createClient } from '@supabase/supabase-js'
import { parse as csvParse } from 'csv-parse/sync'

// === KONFIGURASI SUPABASE ===
const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

const WORKSPACE_TABLE = 'workspace_state';
const WORKSPACE_ID = 'default';
const TENANT_ID = 'tenant-default';
const EVENT_ID = 'event-default';

async function main() {
  const target = process.argv[2] || 'api-server/data/day2.csv';
  const resetAll = process.argv.includes('--reset');
  const filePath = path.resolve(process.cwd(), target);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  // === BACA CSV ===
  const csvContent = fs.readFileSync(filePath, 'utf8');
  const rows = csvParse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  console.log('[IMPORT] Jumlah peserta dari CSV:', rows.length);

  // === AMBIL SNAPSHOT WORKSPACE ===
  const { data, error } = await supabase
    .from(WORKSPACE_TABLE)
    .select('*')
    .eq('id', WORKSPACE_ID)
    .single();
  if (error || !data) {
    console.error('Gagal ambil workspace_state:', error?.message || 'not found');
    process.exit(2);
  }


  // === GABUNGKAN PESERTA BARU DENGAN PESERTA LAMA ===
  const snapshot = data;
  const newDay = rows.length > 0 ? Number(rows[0].hari || rows[0].day || rows[0].day_number || 1) : 1;
  const newParticipants = rows.map((r, idx) => {
    const name = r.nama || r.name || '';
    const phone = r.telepon || r.phone || '';
    const category = r.kategori || r.category || '';
    const day = Number(r.hari || r.day || r.day_number || newDay);
    // Buat id unik dari nama+phone+day
    const id = `${name.trim().toLowerCase().replace(/\s+/g, '_')}_${phone.replace(/\D/g, '')}_${day}`;
    return {
      id,
      name,
      phone,
      category,
      day,
      ticket: '', // default kosong
      status: 'registered', // default
    };
  });

  if (!snapshot.store?.tenants?.[TENANT_ID]?.events?.[EVENT_ID]) {
    console.error('Struktur event tidak ditemukan di workspace_state Supabase!');
    process.exit(3);
  }
  let mergedParticipants = [];
  if (resetAll) {
    // Reset semua peserta
    mergedParticipants = [...newParticipants];
    console.log('[RESET] Semua peserta dihapus sebelum import.');
  } else {
    const oldParticipants = snapshot.store.tenants[TENANT_ID].events[EVENT_ID].participants || [];
    // Filter: peserta hari lain tetap, peserta hari yang sama diganti
    mergedParticipants = [
      ...oldParticipants.filter((p) => Number(p.day) !== newDay),
      ...newParticipants
    ];
  }
  snapshot.store.tenants[TENANT_ID].events[EVENT_ID].participants = mergedParticipants;

  // === UPSERT KEMBALI KE SUPABASE ===
  const { error: upsertError } = await supabase
    .from(WORKSPACE_TABLE)
    .upsert({
      id: WORKSPACE_ID,
      tenant_registry: snapshot.tenant_registry,
      store: snapshot.store,
      updated_at: new Date().toISOString()
    });
  if (upsertError) {
    console.error('Gagal upsert workspace_state:', upsertError.message);
    process.exit(4);
  }
  // Log jumlah peserta per hari
  const countByDay = {};
  for (const p of mergedParticipants) {
    const d = Number(p.day) || 1;
    countByDay[d] = (countByDay[d] || 0) + 1;
  }
  console.log('Import peserta ke Supabase sukses! Total peserta sekarang:', mergedParticipants.length);
  Object.entries(countByDay).forEach(([day, count]) => {
    console.log(`  Hari ${day}: ${count} peserta`);
  });
  process.exit(0);
}

main();
