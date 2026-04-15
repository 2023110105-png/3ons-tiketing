-- ============================================
-- FIX RLS POLICIES FOR AUTHENTICATION
-- Enable read access for anon key (public access)
-- ============================================

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anon read" ON system_admins;
DROP POLICY IF EXISTS "Allow anon read" ON tenant_admins;
DROP POLICY IF EXISTS "Allow anon read" ON gate_users;

-- Enable RLS on tables (if not already enabled)
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;

-- Create policies for anon key to read users for login
CREATE POLICY "Allow anon read" 
ON system_admins 
FOR SELECT 
TO anon 
USING (is_active = true);

CREATE POLICY "Allow anon read" 
ON tenant_admins 
FOR SELECT 
TO anon 
USING (is_active = true);

CREATE POLICY "Allow anon read" 
ON gate_users 
FOR SELECT 
TO anon 
USING (is_active = true);

-- Allow update last_login (required for login tracking)
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
-- NOTE: For production, restrict these policies!
-- Use authenticated role instead of anon
-- ============================================
