-- Add last_birthday_bonus_at column to track automatic birthday accruals
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_birthday_bonus_at TIMESTAMP;

-- Index to speed up queries filtering by last birthday bonus date
CREATE INDEX IF NOT EXISTS idx_clients_last_birthday_bonus_at
  ON clients(last_birthday_bonus_at);
