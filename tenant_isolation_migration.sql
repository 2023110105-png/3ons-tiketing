-- ============================================
-- MULTI-TENANT ISOLATION MIGRATION
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. CREATE PARTICIPANTS TABLE WITH TENANT_ID
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ticket_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    category TEXT DEFAULT 'Regular',
    day INTEGER DEFAULT 1,
    day_number INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FIX: Add missing columns if table already existed without them
ALTER TABLE participants ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Regular';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS day INTEGER DEFAULT 1;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add composite unique constraint for ticket_id per tenant
ALTER TABLE participants 
DROP CONSTRAINT IF EXISTS unique_ticket_per_tenant;

-- Only add constraint if ticket_id column exists and is not null
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'participants' AND column_name = 'ticket_id'
    ) THEN
        ALTER TABLE participants 
        ADD CONSTRAINT unique_ticket_per_tenant UNIQUE (tenant_id, ticket_id);
    END IF;
END $$;

-- Index untuk performance
CREATE INDEX IF NOT EXISTS idx_participants_tenant ON participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_participants_ticket ON participants(ticket_id);
CREATE INDEX IF NOT EXISTS idx_participants_day ON participants(day, tenant_id);

-- FIX: Add user_id column to tenant_admins and gate_users for RLS
ALTER TABLE tenant_admins ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE gate_users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_tenant_admins_user ON tenant_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_users_user ON gate_users(user_id);

-- Enable RLS
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their tenant's participants
DROP POLICY IF EXISTS "tenant_participants_isolation" ON participants;
CREATE POLICY "tenant_participants_isolation" ON participants
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()
        UNION
        SELECT tenant_id FROM gate_users WHERE user_id = auth.uid()
    )
);

-- 2. CREATE EVENTS TABLE WITH TENANT_ID
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_id TEXT DEFAULT 'event-default',
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FIX: Add missing columns if table already existed
ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_id TEXT DEFAULT 'event-default';
ALTER TABLE events ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Unique constraint per tenant
ALTER TABLE events 
DROP CONSTRAINT IF EXISTS unique_event_per_tenant;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'event_id'
    ) THEN
        ALTER TABLE events 
        ADD CONSTRAINT unique_event_per_tenant UNIQUE (tenant_id, event_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_events_isolation" ON events;
CREATE POLICY "tenant_events_isolation" ON events
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()
        UNION
        SELECT tenant_id FROM gate_users WHERE user_id = auth.uid()
    )
);

-- 3. CREATE CHECKIN LOGS TABLE WITH TENANT_ID
CREATE TABLE IF NOT EXISTS checkin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ticket_id TEXT NOT NULL,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    gate_id TEXT,
    gate_name TEXT,
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    checked_in_by UUID,
    day INTEGER DEFAULT 1,
    day_number INTEGER DEFAULT 1,
    status TEXT DEFAULT 'checked_in',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FIX: Add missing columns if table already existed
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES participants(id) ON DELETE CASCADE;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS gate_id TEXT;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS gate_name TEXT;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS checked_in_by UUID;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS day INTEGER DEFAULT 1;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'checked_in';
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_checkin_logs_tenant ON checkin_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checkin_logs_ticket ON checkin_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_checkin_logs_time ON checkin_logs(checked_in_at);

-- Enable RLS
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_checkin_isolation" ON checkin_logs;
CREATE POLICY "tenant_checkin_isolation" ON checkin_logs
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()
        UNION
        SELECT tenant_id FROM gate_users WHERE user_id = auth.uid()
    )
);

-- 4. CREATE FUNCTION TO GET CURRENT TENANT ID
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    -- Get tenant_id from current session
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CREATE TRIGGER FUNCTION FOR AUTO-SET TENANT_ID
CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-set tenant_id from session if not provided
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_current_tenant_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to participants
DROP TRIGGER IF EXISTS trigger_set_tenant_participants ON participants;
CREATE TRIGGER trigger_set_tenant_participants
    BEFORE INSERT ON participants
    FOR EACH ROW
    EXECUTE FUNCTION set_tenant_id();

-- Apply trigger to events  
DROP TRIGGER IF EXISTS trigger_set_tenant_events ON events;
CREATE TRIGGER trigger_set_tenant_events
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION set_tenant_id();

-- Apply trigger to checkin_logs
DROP TRIGGER IF EXISTS trigger_set_tenant_checkin ON checkin_logs;
CREATE TRIGGER trigger_set_tenant_checkin
    BEFORE INSERT ON checkin_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_tenant_id();

-- 6. CREATE REALTIME PUBLICATION FOR TENANT TABLES
-- (Realtime will broadcast per table, filtering happens in app)

-- Verify all tables have tenant_id
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'tenant_id'
AND table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- DONE! Now each tenant has isolated data
-- ============================================
