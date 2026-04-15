/**
 * Script untuk regenerasi QR data untuk SEMUA peserta Day 1 dan Day 2
 * Usage: node scripts/regenerate-all-qr.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { generateQRData } from '../src/utils/qrSecurity.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TENANT_ID = 'tenant-default';
const EVENT_ID = 'event-default';

async function regenerateAllQR() {
  console.log('🚀 Memulai regenerasi QR untuk semua peserta...\n');

  // Ambil semua peserta Day 1 dan Day 2
  const { data: participants, error } = await supabase
    .from('participants')
    .select('*')
    .in('day_number', [1, 2])
    .order('day_number', { ascending: true })
    .order('nama', { ascending: true });

  if (error) {
    console.error('❌ Gagal mengambil data peserta:', error.message);
    process.exit(1);
  }

  console.log(`📊 Total peserta: ${participants.length}`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const failedList = [];

  for (const p of participants) {
    const day = p.day_number || p.day || p.hari || 1;
    
    // Generate QR data baru
    const qrData = generateQRData({
      ticket_id: p.ticket_id,
      name: p.nama || p.name,
      day_number: day
    }, TENANT_ID, EVENT_ID);

    if (!qrData) {
      console.log(`❌ [${p.ticket_id}] Gagal generate QR`);
      failed++;
      failedList.push({ ticket_id: p.ticket_id, reason: 'generate_failed' });
      continue;
    }

    // Update ke database
    const { error: updateError } = await supabase
      .from('participants')
      .update({ 
        qr_data: qrData,
        updated_at: new Date().toISOString()
      })
      .eq('ticket_id', p.ticket_id);

    if (updateError) {
      console.log(`❌ [${p.ticket_id}] Gagal update: ${updateError.message}`);
      failed++;
      failedList.push({ ticket_id: p.ticket_id, reason: updateError.message });
    } else {
      console.log(`✅ [${p.ticket_id}] Day ${day} - ${p.nama || p.name} - QR updated`);
      updated++;
    }

    // Delay kecil untuk menghindari rate limit
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('\n📋 RINGKASAN:');
  console.log(`   Total peserta: ${participants.length}`);
  console.log(`   Berhasil: ${updated}`);
  console.log(`   Gagal: ${failed}`);
  
  if (failedList.length > 0) {
    console.log('\n❌ Daftar yang gagal:');
    failedList.forEach(f => console.log(`   - ${f.ticket_id}: ${f.reason}`));
  }

  console.log('\n✨ Selesai! QR data telah diregenerasi untuk semua peserta.');
  console.log('   Sekarang Anda bisa menggunakan "Kirim ke Semua" di WA Delivery.');
}

regenerateAllQR().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
