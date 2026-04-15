-- ============================================
-- FINAL CLEANUP - HAPUS SEMUA USER & BUAT ULANG YANG BENAR
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. HAPUS SEMUA DATA di gate_users, tenant_admins (bersihkan total)
DELETE FROM gate_users;
DELETE FROM tenant_admins;

-- 2. HAPUS SEMUA tenant (kecuali yang dibutuhkan)
-- Pertama, pastikan ada tenant 'Primavera Production'
INSERT INTO tenants (id, name, brand_name, slug, is_active)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Primavera Production',
    'Primavera',
    'primavera',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    brand_name = EXCLUDED.brand_name,
    is_active = EXCLUDED.is_active;

-- 3. Buat ulang gate_users yang BENAR (hanya 1)
INSERT INTO gate_users (username, password_hash, name, email, tenant_id, gate_assignment, is_active)
SELECT 
    'gate_depan',
    '1e5b82ebf2494d748129361194b758d7a05fd097c0226e75d217ccb21bc567f0',
    'Petugas Gate Depan',
    'gate@example.com',
    id,
    'front',
    true
FROM tenants WHERE slug = 'primavera';

-- 4. Buat ulang tenant_admins yang BENAR (hanya 1)
INSERT INTO tenant_admins (username, password_hash, name, email, tenant_id, can_manage_gate_users, can_manage_events, can_view_reports, can_export_data, is_active)
SELECT 
    'admin_tenant',
    'e8f2854e7f1b9692d21fa7e2c30ab94410ff90803f3d2f8130bed3363efb8ac2',
    'Admin Tenant',
    'admin@example.com',
    id,
    true, true, true, true,
    true
FROM tenants WHERE slug = 'primavera';

-- 5. Buat ulang system_admins yang BENAR (hanya 1)
DELETE FROM system_admins WHERE username != 'system_admin';
INSERT INTO system_admins (username, password_hash, name, email, is_active)
VALUES (
    'system_admin',
    'e8f2854e7f1b9692d21fa7e2c30ab94410ff90803f3d2f8130bed3363efb8ac2',
    'System Administrator',
    'sysadmin@example.com',
    true
)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = true;

-- 6. Verifikasi hasil akhir
SELECT '=== GATE USERS ===' as info;
SELECT username, name, email FROM gate_users;

SELECT '=== TENANT ADMINS ===' as info;
SELECT username, name, email FROM tenant_admins;

SELECT '=== SYSTEM ADMINS ===' as info;
SELECT username, name, email FROM system_admins;

SELECT '=== TENANTS ===' as info;
SELECT name, slug FROM tenants;
