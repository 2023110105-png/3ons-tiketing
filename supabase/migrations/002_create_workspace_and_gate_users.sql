-- ============================================
-- SUPABASE SETUP: workspace_state table
-- ============================================

-- Create workspace_state table for dataSync.js
CREATE TABLE IF NOT EXISTS workspace_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    tenant_registry JSONB DEFAULT '{"activeTenantId": "", "tenants": {}}'::jsonb,
    store JSONB DEFAULT '{"tenants": {}}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row
INSERT INTO workspace_state (id, tenant_registry, store)
VALUES (
    'default',
    '{"activeTenantId": "", "tenants": {}}',
    '{"tenants": {}}'
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (Row Level Security)
ALTER TABLE workspace_state ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (adjust as needed for your security model)
CREATE POLICY "Allow all operations on workspace_state" 
ON workspace_state 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create policy for anon users (if needed)
CREATE POLICY "Allow read workspace_state for anon" 
ON workspace_state 
FOR SELECT 
TO anon 
USING (true);

-- ============================================
-- Also ensure gate_users table exists
-- ============================================

CREATE TABLE IF NOT EXISTS gate_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    username TEXT NOT NULL,
    gate_assignment TEXT DEFAULT 'front', -- 'front', 'back', or 'both'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, username)
);

-- Add full_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'gate_users' 
                   AND column_name = 'full_name') THEN
        ALTER TABLE gate_users ADD COLUMN full_name TEXT;
    END IF;
END $$;

-- Drop NOT NULL constraint from password_hash if exists (for Supabase Auth compatibility)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'gate_users' 
               AND column_name = 'password_hash' 
               AND is_nullable = 'NO') THEN
        ALTER TABLE gate_users ALTER COLUMN password_hash DROP NOT NULL;
    END IF;
END $$;

-- Enable RLS on gate_users
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on gate_users"
ON gate_users
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Insert sample gate users if they don't exist
-- ============================================

-- Get the first tenant ID
DO $$
DECLARE
    first_tenant_id UUID;
BEGIN
    SELECT id INTO first_tenant_id FROM tenants LIMIT 1;
    
    IF first_tenant_id IS NOT NULL THEN
        -- Insert gate_depan
        INSERT INTO gate_users (tenant_id, username, name, full_name, gate_assignment, is_active)
        VALUES (first_tenant_id, 'gate_depan', 'Gate Depan', 'Gate Depan', 'front', true)
        ON CONFLICT (tenant_id, username) DO NOTHING;
        
        -- Insert gate_belakang
        INSERT INTO gate_users (tenant_id, username, name, full_name, gate_assignment, is_active)
        VALUES (first_tenant_id, 'gate_belakang', 'Gate Belakang', 'Gate Belakang', 'back', true)
        ON CONFLICT (tenant_id, username) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- Realtime subscription setup
-- ============================================

-- Add workspace_state to realtime publication
BEGIN;
  -- Check if the publication exists, if not create it
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END $$;

  -- Add table to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE workspace_state;
COMMIT;
