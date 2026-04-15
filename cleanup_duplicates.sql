-- ============================================
-- CLEANUP DUPLICATE DATA BY TENANT_ID
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Cek duplikat gate_users (username yang sama untuk tenant yang sama)
SELECT tenant_id, username, COUNT(*) as count
FROM gate_users
GROUP BY tenant_id, username
HAVING COUNT(*) > 1;

-- 2. Cek duplikat tenant_admins (username yang sama untuk tenant yang sama)
SELECT tenant_id, username, COUNT(*) as count
FROM tenant_admins
GROUP BY tenant_id, username
HAVING COUNT(*) > 1;

-- 3. Hapus duplikat gate_users (keep the first one, delete others)
DELETE FROM gate_users
WHERE id NOT IN (
    SELECT MIN(id)
    FROM gate_users
    GROUP BY tenant_id, username
);

-- 4. Hapus duplikat tenant_admins (keep the first one, delete others)
DELETE FROM tenant_admins
WHERE id NOT IN (
    SELECT MIN(id)
    FROM tenant_admins
    GROUP BY tenant_id, username
);

-- 5. Verifikasi hasil
SELECT 'gate_users' as table_name, COUNT(*) as total FROM gate_users
UNION ALL
SELECT 'tenant_admins', COUNT(*) FROM tenant_admins;
