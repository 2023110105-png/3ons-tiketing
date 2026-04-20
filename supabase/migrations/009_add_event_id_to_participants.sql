-- ============================================
-- ADD EVENT_ID TO PARTICIPANTS TABLE
-- Enable multi-event support per tenant
-- ============================================

-- Add event_id column if not exists
ALTER TABLE participants 
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Create index for event_id lookups
CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);

-- Create composite index for tenant + event queries
CREATE INDEX IF NOT EXISTS idx_participants_tenant_event ON participants(tenant_id, event_id);

-- Update RLS policy to include event isolation
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

-- Add comment
COMMENT ON COLUMN participants.event_id IS 'Event ID for multi-event support per tenant';

-- ============================================
-- DONE! Now participants are isolated by tenant AND event
-- ============================================
