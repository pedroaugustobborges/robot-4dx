-- ÍRIS Robot - Initial Database Schema
-- Run this in the Supabase SQL editor or via Supabase CLI
--
-- IMPORTANT: After creating the table, enable Realtime for the `commands` table:
--   Dashboard → Database → Replication → Source → enable `commands` table
--   OR via SQL: ALTER PUBLICATION supabase_realtime ADD TABLE commands;

-- Commands table: stores all speech/expression commands for ÍRIS
CREATE TABLE IF NOT EXISTS commands (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text        TEXT NOT NULL,
  type        TEXT DEFAULT 'direct',      -- 'direct' | 'ai' | 'expression' | 'scheduled'
  status      TEXT DEFAULT 'pending',     -- 'pending' | 'done' | 'error'
  expression  TEXT DEFAULT 'neutral',     -- 'neutral' | 'happy' | 'curious' | 'thinking' | 'surprised'
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

-- Anyone can read commands (the robot display page is public)
CREATE POLICY "anon_read" ON commands
  FOR SELECT USING (true);

-- Only authenticated users can insert commands (admin panel)
CREATE POLICY "auth_insert" ON commands
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Anyone can update the status field (robot display page marks commands as done)
-- The robot page is public/anonymous so we allow anon updates
CREATE POLICY "anon_update" ON commands
  FOR UPDATE USING (true) WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE commands;

-- Index for faster queries by status and time
CREATE INDEX IF NOT EXISTS commands_status_idx ON commands(status);
CREATE INDEX IF NOT EXISTS commands_created_at_idx ON commands(created_at DESC);
