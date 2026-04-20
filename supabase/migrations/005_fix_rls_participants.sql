-- ============================================
-- FIX RLS FOR PARTICIPANTS TABLE
-- Disable RLS untuk development / quick fix
-- ============================================

-- Disable RLS on participants table
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;

-- Note: Untuk production, buat policy seperti ini:
-- CREATE POLICY "Tenant users can manage their participants" ON participants
--   FOR ALL USING (tenant_id = current_setting('request.jwt.claims.tenant_id')::uuid);

-- Verify
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'participants';
