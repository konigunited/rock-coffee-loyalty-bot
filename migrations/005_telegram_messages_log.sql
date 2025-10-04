-- Migration 005: Create telegram_messages_log table for Telegram message tracking
-- Replaces SMS functionality with Telegram bot messages

-- Create telegram_messages_log table
CREATE TABLE IF NOT EXISTS telegram_messages_log (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  telegram_id BIGINT,
  message TEXT NOT NULL,
  template_type VARCHAR(50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_by INTEGER NOT NULL REFERENCES users(id),
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_messages_log_client_id ON telegram_messages_log(client_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_log_sent_at ON telegram_messages_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_log_status ON telegram_messages_log(status);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_log_sent_by ON telegram_messages_log(sent_by);

-- Add comment to table
COMMENT ON TABLE telegram_messages_log IS 'Logs all Telegram messages sent to clients via bot';
COMMENT ON COLUMN telegram_messages_log.client_id IS 'Reference to client who received the message';
COMMENT ON COLUMN telegram_messages_log.telegram_id IS 'Telegram ID where message was sent';
COMMENT ON COLUMN telegram_messages_log.message IS 'Message text that was sent';
COMMENT ON COLUMN telegram_messages_log.template_type IS 'Type of message template used (birthday, promo, balance, invite, custom)';
COMMENT ON COLUMN telegram_messages_log.status IS 'Delivery status: pending, sent, or failed';
COMMENT ON COLUMN telegram_messages_log.sent_by IS 'User (manager/admin) who sent the message';

-- End migration
