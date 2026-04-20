-- ============================================
-- FIX PARTICIPANTS TABLE SCHEMA
-- Add ALL missing columns for participant service
-- ============================================

-- Add ALL missing columns if not exists
ALTER TABLE participants 
  ADD COLUMN IF NOT EXISTS qr_data TEXT,
  ADD COLUMN IF NOT EXISTS checkin_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS gate TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registered',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comments for clarity
COMMENT ON COLUMN participants.qr_data IS 'Data QR code (encrypted/signed)';
COMMENT ON COLUMN participants.checkin_time IS 'Waktu check-in peserta';
COMMENT ON COLUMN participants.gate IS 'Gate/pos check-in';
COMMENT ON COLUMN participants.status IS 'Status: registered, checked_in, cancelled';
COMMENT ON COLUMN participants.metadata IS 'Data tambahan (JSONB)';

-- Verify structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'participants'
ORDER BY ordinal_position;
