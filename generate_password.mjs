/**
 * Password Hash Generator for 3ONS Ticketing
 * Run: node generate_password.mjs
 */

import { createHash } from 'crypto'

async function hashPassword(password) {
  const salt = '3ONS_TICKETING_SALT_v2024'
  const saltedPassword = salt + password
  
  const hash = createHash('sha256')
  hash.update(saltedPassword)
  return hash.digest('hex')
}

async function main() {
  const passwords = ['gate123', 'admin123', 'password123']
  
  console.log('========================================')
  console.log('PASSWORD HASH GENERATOR')
  console.log('========================================\n')
  
  for (const pwd of passwords) {
    const hash = await hashPassword(pwd)
    console.log(`Password: "${pwd}"`)
    console.log(`Hash:     "${hash}"`)
    console.log('---')
  }
  
  console.log('\n========================================')
  console.log('SQL INSERT STATEMENTS')
  console.log('========================================\n')
  
  console.log('-- Gate User (gate_depan / gate123)')
  console.log(`INSERT INTO gate_users (username, password_hash, name, email, gate_assignment, is_active)`)
  console.log(`VALUES ('gate_depan', '${await hashPassword('gate123')}', 'Petugas Gate Depan', 'gate@example.com', 'front', true)`)
  console.log(`ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`)
  console.log()
  
  console.log('-- Tenant Admin (admin_tenant / admin123)')
  console.log(`INSERT INTO tenant_admins (username, password_hash, name, email, is_active)`)
  console.log(`VALUES ('admin_tenant', '${await hashPassword('admin123')}', 'Admin Tenant', 'admin@example.com', true)`)
  console.log(`ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`)
  console.log()
  
  console.log('-- System Admin (system_admin / admin123)')
  console.log(`INSERT INTO system_admins (username, password_hash, name, email, is_active)`)
  console.log(`VALUES ('system_admin', '${await hashPassword('admin123')}', 'System Admin', 'sysadmin@example.com', true)`)
  console.log(`ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`)
}

main().catch(console.error)
