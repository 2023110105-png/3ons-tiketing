// Script untuk menghapus SEMUA data dari Firebase
// PERINGATAN: Data akan dihapus permanen!

// Gunakan Firebase REST API (tidak perlu install package)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'yamaha-scan-tiketing'
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY

if (!FIREBASE_API_KEY) {
  console.error('❌ Error: FIREBASE_API_KEY harus di-set di environment')
  console.error('💡 Contoh: FIREBASE_API_KEY=xxx node scripts/wipeFirebase.js --confirm')
  process.exit(1)
}

const BASE_URL = `https://${FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app`

// Paths yang akan dihapus
const PATHS_TO_DELETE = [
  '/tenants',
  '/events', 
  '/participants',
  '/checkin_logs',
  '/wa_logs',
  '/backups'
]

async function wipePath(path) {
  try {
    const url = `${BASE_URL}${path}.json?auth=${FIREBASE_API_KEY}`
    const res = await fetch(url, { method: 'DELETE' })
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    
    console.log(`✅ ${path} - dihapus`)
    return true
  } catch (err) {
    console.error(`❌ ${path} - gagal: ${err.message}`)
    return false
  }
}

async function wipeAll() {
  console.log('🔥 FIREBASE WIPE TOOL 🔥\n')
  console.log(`Project: ${FIREBASE_PROJECT_ID}`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log('\n⚠️  PERINGATAN: Semua data akan dihapus permanen!\n')
  
  // Check if --confirm flag is present
  const confirmed = process.argv.includes('--confirm')
  
  if (!confirmed) {
    console.log('💡 Untuk menghapus, jalankan dengan flag --confirm:')
    console.log(`   FIREBASE_API_KEY=xxx node scripts/wipeFirebase.js --confirm\n`)
    console.log('🛑 Penghapusan dibatalkan. Data aman.')
    return
  }
  
  console.log('🗑️  Menghapus data...\n')
  
  let success = 0
  let failed = 0
  
  for (const path of PATHS_TO_DELETE) {
    const result = await wipePath(path)
    if (result) {
      success++
    } else {
      failed++
    }
  }
  
  console.log(`\n🎉 Selesai!`)
  console.log(`✅ Berhasil: ${success}`)
  console.log(`❌ Gagal: ${failed}`)
  console.log('\n📊 Firebase sudah bersih!')
}

wipeAll().catch(console.error)
