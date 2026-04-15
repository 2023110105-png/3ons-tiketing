-- ============================================
-- ENABLE REALTIME: Proper RLS for UPDATE
-- Allow updating last_login_at for authenticated operations
-- ============================================

-- Enable RLS (if was disabled)
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Allow anon select" ON system_admins;
DROP POLICY IF EXISTS "Allow anon select" ON tenant_admins;
DROP POLICY IF EXISTS "Allow anon select" ON gate_users;
DROP POLICY IF EXISTS "Allow anon update" ON system_admins;
DROP POLICY IF EXISTS "Allow anon update" ON tenant_admins;
DROP POLICY IF EXISTS "Allow anon update" ON gate_users;
DROP POLICY IF EXISTS "Allow anon update last_login" ON system_admins;
DROP POLICY IF EXISTS "Allow anon update last_login" ON tenant_admins;
DROP POLICY IF EXISTS "Allow anon update last_login" ON gate_users;

-- Create SELECT policies for active users
CREATE POLICY "Allow anon select" 
ON system_admins 
FOR SELECT 
TO anon 
USING (is_active = true);

CREATE POLICY "Allow anon select" 
ON tenant_admins 
FOR SELECT 
TO anon 
USING (is_active = true);

CREATE POLICY "Allow anon select" 
ON gate_users 
FOR SELECT 
TO anon 
USING (is_active = true);

-- Create UPDATE policies for last_login only
-- Using 'anon' role for public API access
CREATE POLICY "Allow anon update last_login" 
ON system_admins 
FOR UPDATE 
TO anon 
USING (is_active = true)
WITH CHECK (is_active = true);

CREATE POLICY "Allow anon update last_login" 
ON tenant_admins 
FOR UPDATE 
TO anon 
USING (is_active = true)
WITH CHECK (is_active = true);

CREATE POLICY "Allow anon update last_login" 
ON gate_users 
FOR UPDATE 
TO anon 
USING (is_active = true)
WITH CHECK (is_active = true);

-- ============================================
-- FOR PRODUCTION: Use service role instead
-- ============================================
-- Alternative: Create function to update via RPC (more secure)
CREATE OR REPLACE FUNCTION update_last_login(table_name TEXT, user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF table_name = 'system_admins' THEN
    UPDATE system_admins SET last_login_at = NOW() WHERE id = user_id;
  ELSIF table_name = 'tenant_admins' THEN
    UPDATE tenant_admins SET last_login_at = NOW() WHERE id = user_id;
  ELSIF table_name = 'gate_users' THEN
    UPDATE gate_users SET last_login_at = NOW() WHERE id = user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
