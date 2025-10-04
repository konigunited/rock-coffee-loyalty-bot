-- Migration 006: Create sessions table for persistent session storage
-- Replaces in-memory Map with PostgreSQL storage

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_sessions_updated_at ON sessions;
CREATE TRIGGER trigger_update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_sessions_updated_at();

-- Add comments
COMMENT ON TABLE sessions IS 'Stores user session data persistently across server restarts';
COMMENT ON COLUMN sessions.user_id IS 'Telegram user ID (from message.from.id)';
COMMENT ON COLUMN sessions.data IS 'Session data stored as JSONB (waitingFor, clientId, tempData, etc.)';
COMMENT ON COLUMN sessions.expires_at IS 'Session expiration timestamp (auto-cleanup)';

-- End migration
