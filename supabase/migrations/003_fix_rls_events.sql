-- ============================================
-- FIX RLS FOR EVENTS TABLE
-- Disable RLS untuk development / quick fix
-- ============================================

-- Disable RLS on events table
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Note: Untuk production, buat policy seperti ini:
-- CREATE POLICY "Tenant admins can manage their events" ON events
--   FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id');

-- Verify
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'events';
