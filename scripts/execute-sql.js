#!/usr/bin/env node
/**
 * Execute SQL migration directly to Supabase PostgreSQL
 * Uses pg client for direct connection
 * 
 * Usage: node scripts/execute-sql.js
 */

/* eslint-env node */
/* global process */

import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Supabase connection info (dari Dashboard → Settings → Database)
const SUPABASE_HOST = 'db.jmttblccfmqnqwoyzazc.supabase.co'
const SUPABASE_PORT = 5432
const SUPABASE_DATABASE = 'postgres'
const SUPABASE_USER = 'postgres'
// PASSWORD dari: Dashboard → Settings → Database → Connection string
// Format: postgres://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres

async function executeMigration() {
  console.log('🚀 Executing SQL Migration to Supabase...\n')
  
  // Read SQL file
  const sqlPath = path.join(__dirname, 'migrate-v1-to-v2.sql')
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ SQL file not found:', sqlPath)
    process.exit(1)
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log('📄 SQL file loaded:', sqlPath)
  console.log('📊 Size:', (sql.length / 1024).toFixed(2), 'KB\n')
  
  // Get password from environment or prompt
  const password = process.env.SUPABASE_DB_PASSWORD || 
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'YOUR_SUPABASE_DB_PASSWORD_HERE' // GANTI INI!
  
  if (password.includes('YOUR_')) {
    console.error('❌ Please set your Supabase database password!')
    console.log('\nCara mendapatkan password:')
    console.log('1. Buka https://app.supabase.com')
    console.log('2. Pilih project Anda')
    console.log('3. Dashboard → Settings → Database')
    console.log('4. Copy password dari connection string')
    console.log('\nAtau set environment variable:')
    console.log('  $env:SUPABASE_DB_PASSWORD="your-password" (PowerShell)')
    console.log('  set SUPABASE_DB_PASSWORD=your-password (CMD)')
    process.exit(1)
  }
  
  const client = new Client({
    host: SUPABASE_HOST,
    port: SUPABASE_PORT,
    database: SUPABASE_DATABASE,
    user: SUPABASE_USER,
    password: password,
    ssl: { rejectUnauthorized: false } // Required for Supabase
  })
  
  try {
    console.log('🔌 Connecting to Supabase...')
    await client.connect()
    console.log('✅ Connected!\n')
    
    // Execute SQL
    console.log('⚙️  Executing SQL statements...')
    await client.query(sql)
    console.log('✅ SQL executed successfully!\n')
    
    // Verify
    console.log('🔍 Verifying tables...')
    const tables = ['super_admins', 'tenants', 'users', 'events', 'participants', 'checkin_logs']
    
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`)
      console.log(`  ✓ ${table}: ${result.rows[0].count} rows`)
    }
    
    console.log('\n🎉 Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. npm run dev')
    console.log('2. Login dengan: platform_admin / admin123')
    
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    if (err.message.includes('password authentication failed')) {
      console.log('\n⚠️  Password salah! Dapatkan password dari:')
      console.log('   Supabase Dashboard → Settings → Database → Connection string')
    }
    if (err.message.includes('does not exist')) {
      console.log('\n⚠️  Table sudah ada atau error lainnya')
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

executeMigration()
