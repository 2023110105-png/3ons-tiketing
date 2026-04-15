-- ============================================
-- TEMPORARY: Disable RLS for development
-- Run this if RLS policies causing issues
-- ============================================

-- Disable RLS on auth tables
ALTER TABLE system_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE gate_users DISABLE ROW LEVEL SECURITY;

-- Also disable RLS on related tables
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_logs DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('system_admins', 'tenant_admins', 'gate_users', 'tenants')
AND schemaname = 'public';
