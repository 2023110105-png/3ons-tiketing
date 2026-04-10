-- Setup tabel Supabase untuk data persistence
-- Jalankan ini di SQL Editor Supabase

-- Tabel participants (sudah ada, tapi pastikan struktur lengkap)
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  telepon TEXT,
  email TEXT,
  kategori TEXT,
  hari INTEGER,
  ticket_id TEXT UNIQUE,
  qr_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_participants_nama ON participants(nama);
CREATE INDEX IF NOT EXISTS idx_participants_ticket_id ON participants(ticket_id);
CREATE INDEX IF NOT EXISTS idx_participants_hari ON participants(hari);

-- Tabel tenant_settings untuk WA connection status
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id TEXT PRIMARY KEY,
  wa_connection_status TEXT DEFAULT 'disconnected',
  wa_enabled BOOLEAN DEFAULT true,
  wa_phone_number TEXT,
  wa_session_data JSONB,
  event_name TEXT,
  event_date DATE,
  venue TEXT,
  branding JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel wa_send_logs untuk tracking pengiriman
CREATE TABLE IF NOT EXISTS wa_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  ticket_id TEXT,
  participant_name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending', -- pending, success, failed
  message TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk logs
CREATE INDEX IF NOT EXISTS idx_wa_logs_tenant ON wa_send_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_ticket ON wa_send_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status ON wa_send_logs(status);

-- Tabel checkin_logs untuk absensi
CREATE TABLE IF NOT EXISTS checkin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  event_id TEXT,
  ticket_id TEXT,
  participant_name TEXT,
  checkin_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gate TEXT DEFAULT 'main',
  verified_by TEXT,
  notes TEXT
);

-- Index checkin
CREATE INDEX IF NOT EXISTS idx_checkin_ticket ON checkin_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_checkin_time ON checkin_logs(checkin_time);

-- Function untuk auto update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger auto update
DROP TRIGGER IF EXISTS update_participants_updated_at ON participants;
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_settings_updated_at ON tenant_settings;
CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;

-- Allow all access (untuk development - ubah sesuai kebutuhan security)
CREATE POLICY "Allow all" ON participants FOR ALL USING (true);
CREATE POLICY "Allow all" ON tenant_settings FOR ALL USING (true);
CREATE POLICY "Allow all" ON wa_send_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON checkin_logs FOR ALL USING (true);
