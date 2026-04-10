// Script untuk mengimpor data peserta dari CSV ke Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// Generate ticket ID
function generateTicketId(prefix, index) {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}${timestamp}${String(index).padStart(3, '0')}`;
}

// Generate QR data
function generateQRData(ticketId, day) {
  return JSON.stringify({
    tid: ticketId,
    t: 'tenant-default',
    e: 'event-default',
    d: day,
    sig: 'SIG_' + Date.now(),
    v: 2
  });
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }
  return data;
}

// Import participants to Supabase
async function importParticipants() {
  console.log('🚀 Memulai import data peserta...\n');
  
  try {
    // 1. Hapus semua data peserta yang ada
    console.log('🗑️  Menghapus data peserta lama...');
    const { error: deleteError } = await supabase
      .from('workspace_state')
      .update({
        store: {
          tenants: {
            'tenant-default': {
              events: {
                'event-default': {
                  participants: [],
                  checkin_logs: [],
                  pendingCheckIns: []
                }
              }
            }
          }
        }
      })
      .eq('id', 'default');
    
    if (deleteError) {
      console.error('❌ Gagal menghapus data lama:', deleteError);
      return;
    }
    console.log('✅ Data lama berhasil dihapus\n');
    
    // 2. Baca data CSV Hari 1
    console.log('📄 Membaca data CSV Hari 1...');
    const day1Data = parseCSV(path.join(__dirname, '../api-server/data/day_1.csv'));
    console.log(`✅ Ditemukan ${day1Data.length} peserta untuk Hari 1\n`);
    
    // 3. Baca data CSV Hari 2
    console.log('📄 Membaca data CSV Hari 2...');
    const day2Data = parseCSV(path.join(__dirname, '../api-server/data/day2.csv'));
    console.log(`✅ Ditemukan ${day2Data.length} peserta untuk Hari 2\n`);
    
    // 4. Siapkan data peserta
    const allParticipants = [];
    
    // Proses data hari 1
    day1Data.forEach((row, index) => {
      const ticketId = generateTicketId('T1', index + 1);
      allParticipants.push({
        id: `p1_${Date.now()}_${index}`,
        ticket_id: ticketId,
        name: row.nama,
        phone: row.telepon,
        email: '',
        category: row.kategori,
        day_number: 1,
        qr_data: generateQRData(ticketId, 1),
        created_at: new Date().toISOString(),
        is_active: true
      });
    });
    
    // Proses data hari 2
    day2Data.forEach((row, index) => {
      const ticketId = generateTicketId('T2', index + 1);
      allParticipants.push({
        id: `p2_${Date.now()}_${index}`,
        ticket_id: ticketId,
        name: row.nama,
        phone: row.telepon,
        email: '',
        category: row.kategori,
        day_number: 2,
        qr_data: generateQRData(ticketId, 2),
        created_at: new Date().toISOString(),
        is_active: true
      });
    });
    
    console.log(`📊 Total peserta yang akan diimpor: ${allParticipants.length}`);
    console.log(`   - Hari 1: ${day1Data.length} peserta`);
    console.log(`   - Hari 2: ${day2Data.length} peserta\n`);
    
    // 5. Update workspace_state dengan data baru
    console.log('💾 Menyimpan data ke Supabase...');
    
    // Dapatkan data workspace yang ada
    const { data: workspaceData, error: fetchError } = await supabase
      .from('workspace_state')
      .select('store')
      .eq('id', 'default')
      .single();
    
    if (fetchError) {
      console.error('❌ Gagal mengambil data workspace:', fetchError);
      return;
    }
    
    // Update dengan data peserta baru
    const updatedStore = {
      ...workspaceData.store,
      tenants: {
        ...workspaceData.store?.tenants,
        'tenant-default': {
          ...workspaceData.store?.tenants?.['tenant-default'],
          events: {
            ...workspaceData.store?.tenants?.['tenant-default']?.events,
            'event-default': {
              ...workspaceData.store?.tenants?.['tenant-default']?.events?.['event-default'],
              participants: allParticipants,
              checkin_logs: [],
              pendingCheckIns: [],
              currentDay: 1
            }
          }
        }
      }
    };
    
    const { error: updateError } = await supabase
      .from('workspace_state')
      .update({ store: updatedStore })
      .eq('id', 'default');
    
    if (updateError) {
      console.error('❌ Gagal menyimpan data:', updateError);
      return;
    }
    
    console.log('✅ Import berhasil!\n');
    console.log('📈 Ringkasan Import:');
    console.log(`   Total Peserta: ${allParticipants.length}`);
    console.log(`   Hari 1: ${day1Data.length} peserta`);
    console.log(`   Hari 2: ${day2Data.length} peserta`);
    console.log(`\n🎉 Data peserta siap digunakan!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Jalankan import
importParticipants();
