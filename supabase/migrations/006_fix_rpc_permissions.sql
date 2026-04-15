-- ============================================
-- FIX RPC PERMISSIONS FOR update_last_login
-- ============================================

-- 1. Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION update_last_login(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_last_login(TEXT, UUID) TO authenticated;

-- 2. Alternative: Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 3. TEMPORARY: Disable RLS for quick fix
ALTER TABLE system_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE gate_users DISABLE ROW LEVEL SECURITY;

-- 4. Enable RLS back with proper policies
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if exist, then create new ones
DROP POLICY IF EXISTS "Allow all anon" ON system_admins;
DROP POLICY IF EXISTS "Allow all anon" ON tenant_admins;
DROP POLICY IF EXISTS "Allow all anon" ON gate_users;

-- Allow all operations for development
CREATE POLICY "Allow all anon" ON system_admins FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all anon" ON tenant_admins FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all anon" ON gate_users FOR ALL TO anon USING (true) WITH CHECK (true);
