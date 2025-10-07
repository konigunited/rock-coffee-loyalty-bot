-- Rock Coffee Loyalty Bot Database Schema
-- Basic version without complex constraints

-- Users table (staff members)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(50),
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'barista',
  password_hash VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Clients table (loyalty program members)
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  card_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  birth_date DATE,
  balance INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_visit TIMESTAMP,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Point transactions table
CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  operation_type VARCHAR(20) NOT NULL DEFAULT 'earn',
  points INTEGER NOT NULL,
  amount DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log for auditing
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(20),
  target_id INTEGER,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Broadcasts table
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

-- Broadcast recipients tracking
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

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  value_type VARCHAR(20) DEFAULT 'string',
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraints (if they don't exist)
DO $$ 
BEGIN
    -- Add foreign key for point_transactions -> clients
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'point_transactions_client_id_fkey') THEN
        ALTER TABLE point_transactions 
        ADD CONSTRAINT point_transactions_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id);
    END IF;

    -- Add foreign key for point_transactions -> users
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'point_transactions_operator_id_fkey') THEN
        ALTER TABLE point_transactions 
        ADD CONSTRAINT point_transactions_operator_id_fkey 
        FOREIGN KEY (operator_id) REFERENCES users(id);
    END IF;

    -- Add foreign key for activity_log -> users
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'activity_log_user_id_fkey') THEN
        ALTER TABLE activity_log 
        ADD CONSTRAINT activity_log_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;

    -- Add foreign key for broadcasts -> users
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'broadcasts_created_by_fkey') THEN
        ALTER TABLE broadcasts 
        ADD CONSTRAINT broadcasts_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;

    -- Add foreign key for broadcast_recipients -> broadcasts
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'broadcast_recipients_broadcast_id_fkey') THEN
        ALTER TABLE broadcast_recipients 
        ADD CONSTRAINT broadcast_recipients_broadcast_id_fkey 
        FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for broadcast_recipients -> clients
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'broadcast_recipients_client_id_fkey') THEN
        ALTER TABLE broadcast_recipients 
        ADD CONSTRAINT broadcast_recipients_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_card_number ON clients(card_number);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_telegram_id ON clients(telegram_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_client_id ON point_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

-- Create access control views
DROP VIEW IF EXISTS barista_client_view;
CREATE VIEW barista_client_view AS
SELECT 
  c.id,
  c.card_number,
  c.full_name,
  c.balance,
  c.notes,
  c.last_visit,
  c.visit_count,
  c.is_active
FROM clients c
WHERE c.is_active = true;

DROP VIEW IF EXISTS manager_client_view;
CREATE VIEW manager_client_view AS
SELECT 
  c.id,
  c.telegram_id,
  c.card_number,
  c.full_name,
  c.phone,
  c.birth_date,
  c.balance,
  c.total_spent,
  c.visit_count,
  c.last_visit,
  c.notes,
  c.is_active,
  c.created_at,
  c.updated_at,
  CASE 
    WHEN c.birth_date IS NOT NULL 
    AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM c.birth_date) - EXTRACT(DAY FROM CURRENT_DATE) BETWEEN 0 AND 7
    THEN true 
    ELSE false 
  END as is_birthday_soon
FROM clients c
WHERE c.is_active = true;

-- Insert default system settings
INSERT INTO system_settings (key, value, value_type, description, category) VALUES
('points_per_ruble', '0.1', 'decimal', 'Points earned per ruble spent', 'loyalty'),
('ruble_per_point', '1', 'decimal', 'Rubles discount per point spent', 'loyalty'),
('max_spend_percent', '50', 'integer', 'Maximum percentage of order that can be paid with points', 'loyalty'),
('welcome_bonus', '100', 'integer', 'Welcome bonus points for new clients', 'loyalty'),
('birthday_bonus', '200', 'integer', 'Birthday bonus points', 'loyalty')
ON CONFLICT (key) DO NOTHING;

-- Insert default admin user
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (0, 'system_admin', 'System Administrator', 'admin', true)
ON CONFLICT (telegram_id) DO NOTHING;

-- Success message
SELECT 'Database schema created successfully!' as message;