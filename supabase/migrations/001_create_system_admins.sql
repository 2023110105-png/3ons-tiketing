-- ============================================
-- SUPABASE SETUP: system_admins table
-- ============================================

-- Create system_admins table
CREATE TABLE IF NOT EXISTS system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all operations on system_admins" 
ON system_admins 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create policy for anon users (read only)
CREATE POLICY "Allow read system_admins for anon" 
ON system_admins 
FOR SELECT 
TO anon 
USING (true);

-- ============================================
-- Insert sample system admin if not exists
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM system_admins WHERE username = 'developer') THEN
        INSERT INTO system_admins (username, password_hash, full_name, email, is_active)
        VALUES (
            'developer', 
            '$2a$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
            'System Developer',
            'developer@example.com',
            true
        );
    END IF;
END $$;

-- ============================================
-- Realtime setup
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE system_admins;
