-- Signatures table: stores participant names and hand-drawn signatures
CREATE TABLE IF NOT EXISTS signatures (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  signature_data TEXT NOT NULL,   -- base64 PNG data URL
  displayed    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- Participants sign anonymously
CREATE POLICY "anon_insert_signatures" ON signatures
  FOR INSERT WITH CHECK (true);

-- Main display page reads publicly
CREATE POLICY "anon_read_signatures" ON signatures
  FOR SELECT USING (true);

-- Main page marks as displayed
CREATE POLICY "anon_update_signatures" ON signatures
  FOR UPDATE USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE signatures;

CREATE INDEX IF NOT EXISTS signatures_displayed_idx ON signatures(displayed, created_at DESC);
