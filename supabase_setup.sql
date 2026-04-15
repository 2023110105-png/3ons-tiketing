-- ============================================
-- SUPABASE SETUP FOR 3ONS TICKETING SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create gate_users table
CREATE TABLE IF NOT EXISTS gate_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    gate_assignment TEXT DEFAULT 'front', -- 'front', 'back', 'both'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Create tenant_admins table
CREATE TABLE IF NOT EXISTS tenant_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    can_manage_gate_users BOOLEAN DEFAULT true,
    can_manage_events BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_export_data BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 3. Create system_admins table
CREATE TABLE IF NOT EXISTS system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 4. Enable RLS
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies (allow read for authenticated)
CREATE POLICY IF NOT EXISTS "Allow read gate_users" 
    ON gate_users FOR SELECT TO anon, authenticated USING (true);
    
CREATE POLICY IF NOT EXISTS "Allow read tenant_admins" 
    ON tenant_admins FOR SELECT TO anon, authenticated USING (true);
    
CREATE POLICY IF NOT EXISTS "Allow read system_admins" 
    ON system_admins FOR SELECT TO anon, authenticated USING (true);

-- 6. Seed data - Gate User (Password: gate123)
-- Password hash: SHA256('3ONS_TICKETING_SALT_v2024' + 'gate123')
INSERT INTO gate_users (username, password_hash, name, email, gate_assignment, is_active)
VALUES (
    'gate_depan', 
    '1e5b82ebf2494d748129361194b758d7a05fd097c0226e75d217ccb21bc567f0',
    'Petugas Gate Depan',
    'gate@example.com',
    'front',
    true
)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true;

-- 7. Seed data - Tenant Admin (Password: admin123)
-- Password hash: SHA256('3ONS_TICKETING_SALT_v2024' + 'admin123')
INSERT INTO tenant_admins (username, password_hash, name, email, can_manage_gate_users, can_manage_events, can_view_reports, can_export_data, is_active)
VALUES (
    'admin_tenant',
    'e8f2854e7f1b9692d21fa7e2c30ab94410ff90803f3d2f8130bed3363efb8ac2',
    'Admin Tenant',
    'admin@example.com',
    true, true, true, true,
    true
)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true;

-- 8. Seed data - System Admin (Password: admin123)
-- Password hash: SHA256('3ONS_TICKETING_SALT_v2024' + 'admin123')
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
    is_active = true;

-- 9. Create RPC functions for last_login updates
CREATE OR REPLACE FUNCTION update_last_login_gate(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE gate_users SET last_login = now() WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_last_login_admin(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
BEGIN
    UPDATE tenant_admins SET last_login = now() WHERE id = user_id;
END;
$$;

-- ============================================
-- END SETUP
-- ============================================
