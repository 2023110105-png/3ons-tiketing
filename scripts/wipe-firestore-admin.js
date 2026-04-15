/* eslint-env node */
/* global process */
// Script untuk menghapus data dari Firebase Firestore menggunakan Admin SDK
// PERINGATAN: Data akan dihapus permanen!

import { config } from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Load .env file
config({ path: '.env' });

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './serviceAccountKey.json';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
} catch {
  console.error('❌ Error: Tidak dapat membaca service account key');
  console.error(`💡 Path yang dicoba: ${SERVICE_ACCOUNT_PATH}`);
  console.error('\n📋 Cara mendapatkan Service Account Key:');
  console.error('   1. Buka https://console.firebase.google.com');
  console.error('   2. Project Settings (gear icon) > Service Accounts');
  console.error('   3. Klik "Generate new private key"');
  console.error('   4. Simpan file JSON di folder project ini sebagai serviceAccountKey.json');
  console.error('\n   Atau set environment variable:');
  console.error('   FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/key.json node scripts/wipe-firestore-admin.js --confirm');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);
  
  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();
  
  if (snapshot.size === 0) {
    resolve(0);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  const processed = snapshot.size;
  
  // Recurse on the next process tick, to avoid exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
  
  return processed;
}

async function wipeAll() {
  console.log('🔥 FIRESTORE WIPE TOOL (ADMIN SDK) 🔥\n');
  console.log('⚠️  PERINGATAN: Semua data akan dihapus permanen dari Firestore!\n');
  
  const confirmed = process.argv.includes('--confirm');
  
  if (!confirmed) {
    console.log('💡 Untuk menghapus, jalankan dengan flag --confirm:\n');
    console.log('   node scripts/wipe-firestore-admin.js --confirm\n');
    console.log('🛑 Penghapusan dibatalkan. Data aman.');
    process.exit(0);
  }
  
  console.log('🗑️  Menghapus data dari Firestore...\n');

  try {
    // Get all tenants
    const tenantsSnapshot = await db.collection('tenants').get();
    console.log(`📁 Ditemukan ${tenantsSnapshot.size} tenant(s)`);
    
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      console.log(`\n🏢 Tenant: ${tenantId}`);
      
      // Delete users subcollection
      await deleteCollection(`tenants/${tenantId}/users`);
      console.log('   ✅ Users dihapus');
      
      // Get all events
      const eventsSnapshot = await db.collection(`tenants/${tenantId}/events`).get();
      console.log(`   📅 Ditemukan ${eventsSnapshot.size} event(s)`);
      
      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        
        // Count participants before delete
        const participantsSnapshot = await db.collection(`tenants/${tenantId}/events/${eventId}/participants`).get();
        const participantCount = participantsSnapshot.size;
        
        // Delete all subcollections
        await deleteCollection(`tenants/${tenantId}/events/${eventId}/participants`);
        await deleteCollection(`tenants/${tenantId}/events/${eventId}/checkins`);
        await deleteCollection(`tenants/${tenantId}/events/${eventId}/admin_logs`);
        
        // Delete event document
        await eventDoc.ref.delete();
        console.log(`      ✅ Event ${eventId} dihapus (${participantCount} participants)`);
      }
      
      // Delete tenant document
      await tenantDoc.ref.delete();
      console.log(`   ✅ Tenant ${tenantId} dihapus`);
    }
    
    console.log('\n🎉 Selesai! Semua data telah dihapus dari Firebase Firestore.');
    console.log('📊 Data sekarang hanya tersedia di Supabase.');
    
  } catch (err) {
    console.error('\n❌ Error saat menghapus:', err.message);
    console.error(err);
    process.exit(1);
  }
  
  process.exit(0);
}

wipeAll();
