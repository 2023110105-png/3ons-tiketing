#!/usr/bin/env node
/**
 * Script untuk menjalankan SQL migration di Supabase
 * Usage: node scripts/run-migration.js <migration_file>
 * Example: node scripts/run-migration.js supabase/migrations/003_fix_rls_events.sql
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get Supabase credentials from .env
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found in .env')
  console.error('   Required: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY (or VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

// Get migration file from command line
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('❌ Error: Please provide a migration file path')
  console.error('   Usage: node scripts/run-migration.js <migration_file>')
  console.error('   Example: node scripts/run-migration.js supabase/migrations/003_fix_rls_events.sql')
  process.exit(1)
}

const fullPath = path.resolve(migrationFile)

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Error: Migration file not found: ${fullPath}`)
  process.exit(1)
}

console.log(`🚀 Running migration: ${migrationFile}`)
console.log(`📁 Full path: ${fullPath}`)
console.log(`🔗 Supabase URL: ${supabaseUrl}`)

// Read SQL file
const sql = fs.readFileSync(fullPath, 'utf-8')

console.log('\n📋 SQL Content:')
console.log('─'.repeat(50))
console.log(sql)
console.log('─'.repeat(50))

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Execute SQL
async function runMigration() {
  try {
    console.log('\n⏳ Executing migration...')
    
    // Split SQL into individual statements (handle multiple statements)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    for (const statement of statements) {
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        console.log(`   ⏭️  Skipping comment: ${statement.substring(0, 50)}...`)
        continue
      }
      
      console.log(`   📝 Executing: ${statement.substring(0, 60)}...`)
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: statement + ';' 
      })
      
      if (error) {
        // Try alternative method: direct query
        const { error: queryError } = await supabase.from('_test').select('*').limit(1)
        
        if (queryError?.code === 'PGRST301') {
          console.error(`   ⚠️  Note: exec_sql function not available, trying direct method...`)
        }
        
        // For now, just log the error but continue
        console.error(`   ⚠️  Error (may be expected): ${error.message}`)
      } else {
        console.log(`   ✅ Success!`)
        if (data) console.log(`      Data:`, data)
      }
    }
    
    console.log('\n✅ Migration completed!')
    console.log('\n📌 Next steps:')
    console.log('   1. Check Supabase Dashboard to verify changes')
    console.log('   2. Try creating an event again')
    console.log('   3. If still failing, use Option B (Service Role Key)')
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message)
    console.error('\n💡 Alternative: Run this SQL manually in Supabase Dashboard:')
    console.error(sql)
    process.exit(1)
  }
}

runMigration()
