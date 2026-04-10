-- Tambah kolom wa_sent_at untuk tracking pengiriman tiket WhatsApp
-- Jalankan ini di Supabase SQL Editor

-- Cek apakah kolom sudah ada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'participants' 
                   AND column_name = 'wa_sent_at') THEN
        -- Tambah kolom wa_sent_at
        ALTER TABLE participants 
        ADD COLUMN wa_sent_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Kolom wa_sent_at berhasil ditambahkan';
    ELSE
        RAISE NOTICE 'Kolom wa_sent_at sudah ada';
    END IF;
END $$;

-- Buat index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_participants_wa_sent_at 
ON participants(wa_sent_at) 
WHERE wa_sent_at IS NOT NULL;

-- Verifikasi
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'participants' 
AND column_name = 'wa_sent_at';
