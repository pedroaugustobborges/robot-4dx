-- Add cargo (job position) column to signatures table
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS cargo TEXT;
