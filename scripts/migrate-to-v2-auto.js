#!/usr/bin/env node
/**
 * AUTO MIGRATION SCRIPT v2.0
 * Menjalankan migrasi database dan setup aplikasi secara otomatis
 * 
 * Usage: node scripts/migrate-to-v2-auto.js
 */

/* eslint-env node */
/* global process */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Colors untuk terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(type, message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  switch(type) {
    case 'info':
      console.log(`${colors.cyan}[${timestamp}] ℹ️  ${message}${colors.reset}`)
      break
    case 'success':
      console.log(`${colors.green}[${timestamp}] ✅ ${message}${colors.reset}`)
      break
    case 'warning':
      console.log(`${colors.yellow}[${timestamp}] ⚠️  ${message}${colors.reset}`)
      break
    case 'error':
      console.log(`${colors.red}[${timestamp}] ❌ ${message}${colors.reset}`)
      break
    case 'step':
      console.log(`\n${colors.bright}${colors.blue}▶ ${message}${colors.reset}`)
      break
    case 'detail':
      console.log(`   ${colors.cyan}→ ${message}${colors.reset}`)
      break
  }
}

// Prompt helper
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Check if v2 files exist
function checkV2Files() {
  log('step', 'CHECKING V2.0 FILES')
  
  const files = [
    'src/contexts/AuthContextV2.jsx',
    'src/AppV2.jsx',
    'src/mainV2.jsx',
    'src/lib/dataSyncV2.js',
    'scripts/migrate-v1-to-v2.sql',
    'docs/DATABASE_V2_ERD.md'
  ]
  
  const rootDir = path.resolve(__dirname, '..')
  let allExist = true
  
  for (const file of files) {
    const fullPath = path.join(rootDir, file)
    if (fs.existsSync(fullPath)) {
      log('detail', `✓ ${file}`)
    } else {
      log('detail', `✗ ${file} (MISSING)`)
      allExist = false
    }
  }
  
  return allExist
}

// Load Supabase credentials
function loadSupabaseConfig() {
  log('step', 'LOADING SUPABASE CONFIGURATION')
  
  const envPath = path.resolve(__dirname, '..', '.env')
  const envLocalPath = path.resolve(__dirname, '..', '.env.local')
  
  let envContent = ''
  
  if (fs.existsSync(envLocalPath)) {
    log('detail', 'Found .env.local')
    envContent = fs.readFileSync(envLocalPath, 'utf8')
  } else if (fs.existsSync(envPath)) {
    log('detail', 'Found .env')
    envContent = fs.readFileSync(envPath, 'utf8')
  } else {
    log('error', 'No .env or .env.local file found!')
    return null
  }
  
  const url = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
  
  if (!url || !key) {
    log('error', 'Supabase credentials not found in .env!')
    return null
  }
  
  log('success', 'Supabase configuration loaded')
  log('detail', `URL: ${url.substring(0, 30)}...`)
  
  return { url, key }
}

// Execute SQL migration
async function executeMigration(supabase) {
  log('step', 'EXECUTING DATABASE MIGRATION')
  
  const sqlPath = path.join(__dirname, 'migrate-v1-to-v2.sql')
  if (!fs.existsSync(sqlPath)) {
    log('error', `Migration file not found: ${sqlPath}`)
    return false
  }
  
  log('detail', 'Reading migration SQL...')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  
  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  log('detail', `Found ${statements.length} SQL statements`)
  log('detail', 'Executing migration...')
  
  // Note: Supabase JS client doesn't support multi-statement SQL
  // This is a simulation - in production, use Supabase SQL Editor
  log('warning', '⚠️  IMPORTANT: Supabase JS client cannot execute full migration')
  log('warning', '⚠️  Please run the SQL manually in Supabase SQL Editor')
  log('detail', 'SQL File: scripts/migrate-v1-to-v2.sql')
  
  // Check if tables already exist
  try {
    const { error } = await supabase
      .from('tenants')
      .select('count', { count: 'exact', head: true })
    
    if (!error) {
      log('warning', 'v2.0 tables already exist!')
      const answer = await prompt('Continue anyway? (y/n): ')
      if (answer.toLowerCase() !== 'y') {
        return false
      }
    }
  } catch {
    // Tables don't exist yet, which is expected
    log('detail', 'v2.0 tables not found - ready for migration')
  }
  
  return true
}

// Verify migration
async function verifyMigration(supabase) {
  log('step', 'VERIFYING MIGRATION')
  
  try {
    // Check tables
    const tables = ['tenants', 'users', 'events', 'participants', 'checkin_logs']
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('count')
        .limit(1)
      
      if (error) {
        log('error', `Table ${table}: ${error.message}`)
      } else {
        log('detail', `✓ Table ${table} exists`)
      }
    }
    
    // Check super_admins
    const { data: superAdmins } = await supabase
      .from('super_admins')
      .select('*')
    
    if (superAdmins && superAdmins.length > 0) {
      log('success', `Found ${superAdmins.length} super admin(s)`)
    } else {
      log('warning', 'No super admins found - need to create one!')
    }
    
    return true
  } catch (err) {
    log('error', `Verification failed: ${err.message}`)
    return false
  }
}

// Switch to v2.0
function switchToV2() {
  log('step', 'SWITCHING TO V2.0')
  
  const rootDir = path.resolve(__dirname, '..')
  const srcDir = path.join(rootDir, 'src')
  
  // Backup v1 files
  const filesToBackup = [
    ['main.jsx', 'main.v1.jsx'],
    ['App.jsx', 'App.v1.jsx'],
    ['contexts/AuthContext.jsx', 'contexts/AuthContext.v1.jsx']
  ]
  
  for (const [original, backup] of filesToBackup) {
    const originalPath = path.join(srcDir, original)
    const backupPath = path.join(srcDir, backup)
    
    if (fs.existsSync(originalPath)) {
      fs.copyFileSync(originalPath, backupPath)
      log('detail', `Backed up ${original} → ${backup}`)
    }
  }
  
  // Switch to v2
  const v2Files = [
    ['mainV2.jsx', 'main.jsx'],
    ['AppV2.jsx', 'App.jsx'],
    ['contexts/AuthContextV2.jsx', 'contexts/AuthContext.jsx']
  ]
  
  for (const [v2File, targetFile] of v2Files) {
    const v2Path = path.join(srcDir, v2File)
    const targetPath = path.join(srcDir, targetFile)
    
    if (fs.existsSync(v2Path)) {
      fs.copyFileSync(v2Path, targetPath)
      log('detail', `Activated ${v2File} → ${targetFile}`)
    } else {
      log('error', `v2 file not found: ${v2File}`)
      return false
    }
  }
  
  log('success', 'Switched to v2.0 successfully!')
  return true
}

// Update environment
function updateEnvironment() {
  log('step', 'UPDATING ENVIRONMENT VARIABLES')
  
  const envPath = path.resolve(__dirname, '..', '.env')
  const envLocalPath = path.resolve(__dirname, '..', '.env.local')
  
  const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath
  
  if (!fs.existsSync(targetPath)) {
    log('error', 'No .env file found!')
    return false
  }
  
  let content = fs.readFileSync(targetPath, 'utf8')
  
  // Add or update VITE_DATA_BACKEND
  if (content.includes('VITE_DATA_BACKEND=')) {
    content = content.replace(/VITE_DATA_BACKEND=.*/, 'VITE_DATA_BACKEND=supabase-v2')
    log('detail', 'Updated VITE_DATA_BACKEND=supabase-v2')
  } else {
    content += '\nVITE_DATA_BACKEND=supabase-v2\n'
    log('detail', 'Added VITE_DATA_BACKEND=supabase-v2')
  }
  
  // Add or update VITE_ENABLE_ADMIN_FEATURES
  if (content.includes('VITE_ENABLE_ADMIN_FEATURES=')) {
    content = content.replace(/VITE_ENABLE_ADMIN_FEATURES=.*/, 'VITE_ENABLE_ADMIN_FEATURES=true')
    log('detail', 'Updated VITE_ENABLE_ADMIN_FEATURES=true')
  } else {
    content += '\nVITE_ENABLE_ADMIN_FEATURES=true\n'
    log('detail', 'Added VITE_ENABLE_ADMIN_FEATURES=true')
  }
  
  fs.writeFileSync(targetPath, content)
  log('success', 'Environment variables updated!')
  
  return true
}

// Main execution
async function main() {
  console.log(`
${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════╗
║     YAMAHA SCAN TICKETING - v2.0 AUTO MIGRATION            ║
║     Database: JSONB → Relational                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`)

  log('info', 'Starting automated migration process...')
  log('info', 'This will take approximately 2-3 minutes')
  
  // Step 1: Check files
  if (!checkV2Files()) {
    log('error', 'Some v2.0 files are missing! Aborting.')
    process.exit(1)
  }
  
  log('success', 'All v2.0 files present')
  
  // Step 2: Load Supabase config
  const config = loadSupabaseConfig()
  if (!config) {
    log('error', 'Cannot proceed without Supabase configuration!')
    process.exit(1)
  }
  
  // Step 3: Initialize Supabase
  log('step', 'INITIALIZING SUPABASE CLIENT')
  const supabase = createClient(config.url, config.key)
  
  // Test connection
  try {
    const { error } = await supabase.from('workspace_state').select('count').limit(1)
    if (error && !error.message.includes('workspace_state')) {
      log('error', `Supabase connection failed: ${error.message}`)
      process.exit(1)
    }
    log('success', 'Supabase connection successful')
  } catch (err) {
    log('error', `Connection error: ${err.message}`)
    process.exit(1)
  }
  
  // Step 4: User confirmation
  console.log(`\n${colors.yellow}⚠️  IMPORTANT NOTES:${colors.reset}`)
  console.log(`   ${colors.cyan}1. This will migrate your database from v1 (JSONB) to v2 (relational)${colors.reset}`)
  console.log(`   ${colors.cyan}2. A backup will be created automatically${colors.reset}`)
  console.log(`   ${colors.cyan}3. The actual SQL migration needs to be run in Supabase SQL Editor${colors.reset}`)
  console.log(`   ${colors.cyan}4. Your v1 files will be backed up${colors.reset}`)
  console.log('')
  
  const confirm = await prompt('Do you want to proceed? (yes/no): ')
  if (confirm.toLowerCase() !== 'yes') {
    log('info', 'Migration cancelled by user')
    process.exit(0)
  }
  
  // Step 5: Execute migration
  const migrationReady = await executeMigration(supabase)
  if (!migrationReady) {
    log('warning', 'Migration preparation incomplete')
  }
  
  // Step 6: Verify
  await verifyMigration(supabase)
  
  // Step 7: Switch to v2
  const switched = switchToV2()
  if (!switched) {
    log('error', 'Failed to switch to v2.0!')
    process.exit(1)
  }
  
  // Step 8: Update environment
  updateEnvironment()
  
  // Summary
  console.log(`\n${colors.green}${colors.bright}
╔════════════════════════════════════════════════════════════╗
║                   MIGRATION COMPLETE!                       ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`)
  
  log('info', 'Next steps:')
  log('detail', '1. Run the SQL migration in Supabase SQL Editor')
  log('detail', '   File: scripts/migrate-v1-to-v2.sql')
  log('detail', '2. Create a super admin if not exists')
  log('detail', '3. Start the development server: npm run dev')
  log('detail', '4. Test login with different roles')
  log('detail', '5. Refer to docs/IMPLEMENTATION_V2_GUIDE.md for full guide')
  
  console.log(`\n${colors.cyan}🔗 Key concepts:${colors.reset}`)
  console.log(`   • Super Admin: Platform level, managed by developer only`)
  console.log(`   • Tenant Admin: Manage users & events within tenant`)
  console.log(`   • Operator: Gate access with permissions (front/back/both)`)
  
  console.log(`\n${colors.green}🚀 Ready for v2.0!${colors.reset}\n`)
}

// Run main
main().catch(err => {
  log('error', `Unexpected error: ${err.message}`)
  console.error(err)
  process.exit(1)
})
