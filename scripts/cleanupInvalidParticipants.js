// Script untuk menghapus peserta yang ticket_id-nya tidak valid
// Hanya simpan: Day 1 (1-62), Day 2 (1-152)

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus di-set di .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Valid ticket patterns
const VALID_RANGES = {
  1: { min: 1, max: 62 },    // Day 1: 1-62
  2: { min: 1, max: 152 }   // Day 2: 1-152
}

function isValidTicketId(ticketId, day) {
  if (!ticketId || !day) return false
  
  // Extract number from ticket_id (e.g., "T-001" -> 1, "DAY1-005" -> 5)
  const match = String(ticketId).match(/(\d+)/)
  if (!match) return false
  
  const num = parseInt(match[1], 10)
  const dayNum = parseInt(day, 10)
  
  const range = VALID_RANGES[dayNum]
  if (!range) return false
  
  return num >= range.min && num <= range.max
}

async function cleanupParticipants() {
  console.log('🔍 Memeriksa data peserta...\n')
  
  // Ambil semua peserta
  const { data: participants, error } = await supabase
    .from('participants')
    .select('id, ticket_id, name, day, day_number, hari')
  
  if (error) {
    console.error('❌ Error mengambil data:', error)
    return
  }
  
  console.log(`📊 Total peserta di database: ${participants.length}`)
  
  // Filter yang tidak valid
  const invalidParticipants = participants.filter(p => {
    const day = p.day || p.day_number || p.hari || 1
    return !isValidTicketId(p.ticket_id, day)
  })
  
  const validParticipants = participants.filter(p => {
    const day = p.day || p.day_number || p.hari || 1
    return isValidTicketId(p.ticket_id, day)
  })
  
  console.log(`✅ Peserta valid: ${validParticipants.length}`)
  console.log(`❌ Peserta invalid (akan dihapus): ${invalidParticipants.length}\n`)
  
  if (invalidParticipants.length === 0) {
    console.log('🎉 Tidak ada data invalid! Database sudah bersih.')
    return
  }
  
  // Tampilkan yang akan dihapus
  console.log('📋 Peserta yang akan dihapus:')
  console.log('-'.repeat(60))
  invalidParticipants.slice(0, 20).forEach(p => {
    const day = p.day || p.day_number || p.hari || 1
    console.log(`  • ${p.ticket_id} | ${p.name?.substring(0, 30) || '-'} | Day ${day}`)
  })
  if (invalidParticipants.length > 20) {
    console.log(`  ... dan ${invalidParticipants.length - 20} lainnya`)
  }
  console.log('-'.repeat(60))
  
  // Konfirmasi sebelum hapus
  console.log('\n⚠️  PERINGATAN: Ini akan MENGHAPUS data secara permanen!')
  console.log('   Setelah dihapus, data tidak bisa dikembalikan.\n')
  
  // Auto-confirm untuk script (bisa diubah ke prompt jika perlu)
  const shouldDelete = process.argv.includes('--confirm')
  
  if (!shouldDelete) {
    console.log('💡 Untuk menghapus, jalankan dengan flag --confirm:')
    console.log('   node scripts/cleanupInvalidParticipants.js --confirm\n')
    console.log('🛑 Penghapusan dibatalkan. Data aman.')
    return
  }
  
  // Hapus data invalid
  console.log('🗑️  Menghapus data invalid...\n')
  
  const idsToDelete = invalidParticipants.map(p => p.id)
  
  // Hapus dalam batch (max 100 per batch)
  const batchSize = 100
  let deletedCount = 0
  
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize)
    
    const { error: deleteError } = await supabase
      .from('participants')
      .delete()
      .in('id', batch)
    
    if (deleteError) {
      console.error(`❌ Error menghapus batch ${i/batchSize + 1}:`, deleteError)
    } else {
      deletedCount += batch.length
      console.log(`✅ Batch ${i/batchSize + 1}: ${batch.length} data dihapus`)
    }
  }
  
  console.log(`\n🎉 Selesai! Total ${deletedCount} peserta invalid telah dihapus.`)
  console.log(`📊 Sisa peserta valid di database: ${validParticipants.length}`)
}

// Jalankan
cleanupParticipants().catch(console.error)
