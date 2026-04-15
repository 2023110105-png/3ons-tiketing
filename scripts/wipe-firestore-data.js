/* eslint-env node */
/* global process */
// Script untuk menghapus SEMUA data peserta dari Firebase Firestore
// PERINGATAN: Data akan dihapus permanen dari Firestore!

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';

// Load .env file
config({ path: '.env' });

// Firebase config - sama dengan aplikasi
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || ''
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Error: Firebase config harus di-set di environment');
  console.error('💡 Contoh:');
  console.error('   VITE_FIREBASE_API_KEY=xxx');
  console.error('   VITE_FIREBASE_PROJECT_ID=yyy');
  console.error('   node scripts/wipe-firestore-data.js --confirm');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteCollectionDocs(collectionPath, batchSize = 500) {
  const colRef = collection(db, ...collectionPath.split('/'));
  const snapshot = await getDocs(colRef);
  
  if (snapshot.empty) {
    console.log(`   ℹ️  ${collectionPath} - sudah kosong`);
    return 0;
  }

  let deleted = 0;
  const batches = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  for (const document of snapshot.docs) {
    currentBatch.delete(document.ref);
    count++;
    deleted++;

    if (count === batchSize) {
      batches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    batches.push(currentBatch.commit());
  }

  await Promise.all(batches);
  console.log(`   🗑️  ${collectionPath} - ${deleted} dokumen dihapus`);
  return deleted;
}

async function wipeAll() {
  console.log('🔥 FIRESTORE WIPE TOOL 🔥\n');
  console.log(`Project: ${firebaseConfig.projectId}`);
  console.log('\n⚠️  PERINGATAN: Semua data akan dihapus permanen dari Firestore!\n');
  
  const confirmed = process.argv.includes('--confirm');
  
  if (!confirmed) {
    console.log('💡 Untuk menghapus, jalankan dengan flag --confirm:\n');
    console.log('   VITE_FIREBASE_API_KEY=xxx \\');
    console.log('   VITE_FIREBASE_PROJECT_ID=yyy \\');
    console.log('   node scripts/wipe-firestore-data.js --confirm\n');
    console.log('🛑 Penghapusan dibatalkan. Data aman.');
    return;
  }
  
  console.log('🗑️  Menghapus data dari Firestore...\n');
  
  // eslint-disable-next-line no-unused-vars
  let totalDeleted = 0;

  // Hapus semua participants dari semua events di semua tenants
  try {
    const tenantsCol = collection(db, 'tenants');
    const tenantsSnapshot = await getDocs(tenantsCol);
    
    console.log(`📁 Ditemukan ${tenantsSnapshot.docs.length} tenant(s)`);
    
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      console.log(`\n🏢 Tenant: ${tenantId}`);
      
      // Hapus sub-collection users
      await deleteCollectionDocs(`tenants/${tenantId}/users`);
      
      // Get all events untuk tenant ini
      const eventsCol = collection(db, 'tenants', tenantId, 'events');
      const eventsSnapshot = await getDocs(eventsCol);
      
      console.log(`   📅 Ditemukan ${eventsSnapshot.docs.length} event(s)`);
      
      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        
        // Hapus participants
        const participantsDeleted = await deleteCollectionDocs(`tenants/${tenantId}/events/${eventId}/participants`);
        
        // Hapus checkins
        await deleteCollectionDocs(`tenants/${tenantId}/events/${eventId}/checkins`);
        
        // Hapus admin_logs
        await deleteCollectionDocs(`tenants/${tenantId}/events/${eventId}/admin_logs`);
        
        // Hapus event document itu sendiri
        await deleteDoc(eventDoc.ref);
        console.log(`      ✅ Event ${eventId} dihapus (${participantsDeleted} participants)`);
      }
      
      // Hapus tenant document itu sendiri
      await deleteDoc(tenantDoc.ref);
      console.log(`   ✅ Tenant ${tenantId} dihapus`);
    }
    
    console.log('\n🎉 Selesai! Semua data peserta telah dihapus dari Firebase Firestore.');
    console.log('📊 Data sekarang hanya tersedia di Supabase.');
    
  } catch (err) {
    console.error('\n❌ Error saat menghapus:', err.message);
    process.exit(1);
  }
}

wipeAll().catch(console.error);
