-- Migration 007: Create broadcasts tables
-- This migration adds the broadcasts and broadcast_recipients tables
-- Required for the broadcast messaging system

-- Create broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  segment VARCHAR(50) NOT NULL DEFAULT 'all',
  scheduled_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create broadcast recipients tracking table
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  telegram_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP,
  UNIQUE(broadcast_id, client_id)
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'broadcasts_created_by_fkey') THEN
        ALTER TABLE broadcasts
        ADD CONSTRAINT broadcasts_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'broadcast_recipients_broadcast_id_fkey') THEN
        ALTER TABLE broadcast_recipients
        ADD CONSTRAINT broadcast_recipients_broadcast_id_fkey
        FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'broadcast_recipients_client_id_fkey') THEN
        ALTER TABLE broadcast_recipients
        ADD CONSTRAINT broadcast_recipients_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_by ON broadcasts(created_by);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON broadcasts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_id ON broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(status);

-- Create trigger for updated_at if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_broadcasts_updated_at') THEN
        CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON broadcasts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

SELECT 'Broadcasts tables created successfully!' as message;
