-- ============================================
-- SUPABASE SETUP - 3ONS TICKETING SYSTEM
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Create tenants table first (referenced by other tables)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand_name TEXT,
    slug TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- 2. Create gate_users table
CREATE TABLE IF NOT EXISTS gate_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    gate_assignment TEXT DEFAULT 'front', -- 'front', 'back', 'both'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 3. Create tenant_admins table
CREATE TABLE IF NOT EXISTS tenant_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    can_manage_gate_users BOOLEAN DEFAULT true,
    can_manage_events BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_export_data BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 4. Create system_admins table
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

-- 5. Enable RLS (Row Level Security)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies - Allow read for all (anon + authenticated)
DROP POLICY IF EXISTS "Allow read tenants" ON tenants;
CREATE POLICY "Allow read tenants" ON tenants FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow read gate_users" ON gate_users;
CREATE POLICY "Allow read gate_users" ON gate_users FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow read tenant_admins" ON tenant_admins;
CREATE POLICY "Allow read tenant_admins" ON tenant_admins FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow read system_admins" ON system_admins;
CREATE POLICY "Allow read system_admins" ON system_admins FOR SELECT TO anon, authenticated USING (true);

-- 7. Add is_active column if tenants table already exists without it
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add UNIQUE constraint to slug if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tenants_slug_key' AND conrelid = 'tenants'::regclass
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
    END IF;
END $$;

-- Insert default tenant (using slug as conflict target)
-- If tenant with slug 'primavera' exists, update it; otherwise insert new
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
-- Note: id stays the same (can't change PK on conflict)

-- 7b. Add UNIQUE constraints if tables already exist without them
DO $$
BEGIN
    -- gate_users username unique
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'gate_users_username_key' AND conrelid = 'gate_users'::regclass
    ) THEN
        ALTER TABLE gate_users ADD CONSTRAINT gate_users_username_key UNIQUE (username);
    END IF;
    
    -- tenant_admins username unique
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tenant_admins_username_key' AND conrelid = 'tenant_admins'::regclass
    ) THEN
        ALTER TABLE tenant_admins ADD CONSTRAINT tenant_admins_username_key UNIQUE (username);
    END IF;
    
    -- system_admins username unique
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'system_admins_username_key' AND conrelid = 'system_admins'::regclass
    ) THEN
        ALTER TABLE system_admins ADD CONSTRAINT system_admins_username_key UNIQUE (username);
    END IF;
END $$;

-- 8. Insert gate user (gate_depan / gate123)
-- Password: SHA256('3ONS_TICKETING_SALT_v2024' + 'gate123')
-- Get tenant_id dynamically from tenants table
INSERT INTO gate_users (username, password_hash, name, email, tenant_id, gate_assignment, is_active)
SELECT 
    'gate_depan',
    '1e5b82ebf2494d748129361194b758d7a05fd097c0226e75d217ccb21bc567f0',
    'Petugas Gate Depan',
    'gate@example.com',
    id,  -- Get actual tenant_id from existing tenant
    'front',
    true
FROM tenants WHERE slug = 'primavera'
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true;

-- 9. Insert tenant admin (admin_tenant / admin123)
-- Password: SHA256('3ONS_TICKETING_SALT_v2024' + 'admin123')
-- Get tenant_id dynamically from tenants table
INSERT INTO tenant_admins (username, password_hash, name, email, tenant_id, can_manage_gate_users, can_manage_events, can_view_reports, can_export_data, is_active)
SELECT 
    'admin_tenant',
    'e8f2854e7f1b9692d21fa7e2c30ab94410ff90803f3d2f8130bed3363efb8ac2',
    'Admin Tenant',
    'admin@example.com',
    id,  -- Get actual tenant_id from existing tenant
    true, true, true, true,
    true
FROM tenants WHERE slug = 'primavera'
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true;

-- 10. Insert system admin (system_admin / admin123)
-- Password: SHA256('3ONS_TICKETING_SALT_v2024' + 'admin123')
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

-- 11. Create RPC function for updating last_login (bypasses RLS)
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

-- 12. Create workspace_state table for data storage
CREATE TABLE IF NOT EXISTS workspace_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    tenant_registry JSONB DEFAULT '{}',
    store JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default workspace
INSERT INTO workspace_state (id, tenant_registry, store)
VALUES ('default', '{}', '{"tenants": {}}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for workspace_state
ALTER TABLE workspace_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all workspace_state" ON workspace_state;
CREATE POLICY "Allow all workspace_state" ON workspace_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA COMPLETE
-- ============================================
-- Users created:
-- 1. gate_depan / gate123 (Gate User - Front)
-- 2. admin_tenant / admin123 (Tenant Admin)
-- 3. system_admin / admin123 (System Admin)
-- All users linked to tenant: Primavera Production
