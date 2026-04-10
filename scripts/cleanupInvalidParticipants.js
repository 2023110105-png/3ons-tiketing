// Script untuk menghapus peserta yang ticket_id-nya tidak valid
// Hanya simpan: Day 1 (1-62), Day 2 (1-152)
// Menggunakan Supabase REST API (tanpa install package)
// Usage: VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=yyy node scripts/cleanupInvalidParticipants.js --confirm

import { readFileSync } from 'fs'
import { join } from 'path'

// Baca .env file secara manual
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    
    for (const line of lines) {
      const match = line.match(/^(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)=(.+)$/)
      if (match) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch (err) {
    // .env tidak ditemukan, gunakan environment variable yang sudah di-set
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus di-set di .env')
  console.error('💡 Contoh: VITE_SUPABASE_URL=https://xxx.supabase.co VITE_SUPABASE_ANON_KEY=xxx node scripts/cleanupInvalidParticipants.js --confirm')
  process.exit(1)
}

// Helper untuk fetch Supabase REST API
async function supabaseFetch(table, options = {}) {
  const { method = 'GET', body, query } = options
  
  let url = `${supabaseUrl}/rest/v1/${table}`
  if (query) {
    url += '?' + new URLSearchParams(query)
  }
  
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'DELETE' ? 'return=minimal' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error: ${res.status} - ${err}`)
  }
  
  return method === 'DELETE' ? null : res.json()
}

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
  let participants = []
  try {
    participants = await supabaseFetch('participants', {
      query: { select: 'id,ticket_id,name,day,day_number,hari' }
    })
  } catch (err) {
    console.error('❌ Error mengambil data:', err.message)
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
    
    try {
      await supabaseFetch('participants', {
        method: 'DELETE',
        query: { id: `in.(${batch.join(',')})` }
      })
      deletedCount += batch.length
      console.log(`✅ Batch ${i/batchSize + 1}: ${batch.length} data dihapus`)
    } catch (err) {
      console.error(`❌ Error menghapus batch ${i/batchSize + 1}:`, err.message)
    }
  }
  
  console.log(`\n🎉 Selesai! Total ${deletedCount} peserta invalid telah dihapus.`)
  console.log(`📊 Sisa peserta valid di database: ${validParticipants.length}`)
}

// Jalankan
cleanupParticipants().catch(console.error)
