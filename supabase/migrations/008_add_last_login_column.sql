-- ============================================
-- ADD last_login_at COLUMN TO TABLES
-- ============================================

-- Add column to system_admins
ALTER TABLE system_admins 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add column to tenant_admins  
ALTER TABLE tenant_admins 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add column to gate_users
ALTER TABLE gate_users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Verify columns added
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('system_admins', 'tenant_admins', 'gate_users')
AND column_name = 'last_login_at';
