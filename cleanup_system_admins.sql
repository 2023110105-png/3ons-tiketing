-- ============================================
-- CLEANUP SYSTEM ADMINS - HAPUS DEVELOPER, KEEP SYSTEM_ADMIN
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Hapus user 'developer' (yang tidak diperlukan)
DELETE FROM system_admins WHERE username = 'developer';

-- 2. Pastikan system_admin ada dengan password yang benar
-- Jika tidak ada, insert baru
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

-- 3. Verifikasi hanya ada 1 system admin
SELECT username, name, email, is_active FROM system_admins;
