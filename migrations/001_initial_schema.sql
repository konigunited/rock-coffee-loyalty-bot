-- Rock Coffee Loyalty Bot Database Schema
-- Migration 001: Initial schema with access control

-- Users table (staff members)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(50),
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'barista', 'client')),
  password_hash VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Clients table (loyalty program members)
CREATE TABLE clients (
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
CREATE TABLE point_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('earn', 'spend', 'adjust', 'bonus')),
  points INTEGER NOT NULL,
  amount DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log for auditing
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(20),
  target_id INTEGER,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Coffee shop info
CREATE TABLE coffee_shop_info (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Rock Coffee',
  address TEXT,
  working_hours TEXT,
  phone VARCHAR(20),
  points_rate DECIMAL(3,2) DEFAULT 0.1, -- 1 point per 10 rubles
  welcome_bonus INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default coffee shop
INSERT INTO coffee_shop_info (name, points_rate, welcome_bonus) 
VALUES ('Rock Coffee', 0.1, 50);

-- Broadcast system tables
CREATE TABLE broadcasts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  segment VARCHAR(50) NOT NULL CHECK (segment IN ('all', 'active', 'vip', 'birthday', 'custom')),
  scheduled_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Broadcast recipients tracking
CREATE TABLE broadcast_recipients (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  telegram_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP,
  UNIQUE(broadcast_id, client_id)
);

-- System settings table
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  value_type VARCHAR(20) DEFAULT 'string' CHECK (value_type IN ('string', 'integer', 'decimal', 'boolean', 'json')),
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO system_settings (key, value, value_type, description, category) VALUES
('points_per_ruble', '0.1', 'decimal', 'Points earned per ruble spent', 'loyalty'),
('ruble_per_point', '1', 'decimal', 'Rubles discount per point spent', 'loyalty'),
('max_spend_percent', '50', 'integer', 'Maximum percentage of order that can be paid with points', 'loyalty'),
('welcome_bonus', '100', 'integer', 'Welcome bonus points for new clients', 'loyalty'),
('birthday_bonus', '200', 'integer', 'Birthday bonus points', 'loyalty'),
('points_expiry_days', '365', 'integer', 'Days after which points expire', 'loyalty'),
('balance_notifications', 'true', 'boolean', 'Enable balance reminder notifications', 'notifications'),
('auto_notifications', 'true', 'boolean', 'Enable automatic notifications', 'notifications'),
('collect_stats', 'true', 'boolean', 'Enable statistics collection', 'system'),
('debug_mode', 'false', 'boolean', 'Enable debug mode', 'system'),
('backup_schedule', 'daily', 'string', 'Backup schedule (daily, weekly, monthly)', 'system'),
('keep_backups', '30', 'integer', 'Number of backups to keep', 'system');

-- ACCESS CONTROL VIEWS

-- View for barista - LIMITED DATA ACCESS ONLY
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

-- View for manager/admin - FULL DATA ACCESS
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

-- Indexes for performance
CREATE INDEX idx_clients_card_number ON clients(card_number);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_telegram_id ON clients(telegram_id);
CREATE INDEX idx_clients_full_name ON clients USING gin(to_tsvector('russian', full_name));
CREATE INDEX idx_point_transactions_client_id ON point_transactions(client_id);
CREATE INDEX idx_point_transactions_created_at ON point_transactions(created_at);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
CREATE INDEX idx_broadcasts_created_by ON broadcasts(created_by);
CREATE INDEX idx_broadcasts_scheduled_at ON broadcasts(scheduled_at);
CREATE INDEX idx_broadcast_recipients_broadcast_id ON broadcast_recipients(broadcast_id);
CREATE INDEX idx_broadcast_recipients_status ON broadcast_recipients(status);
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON broadcasts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log point transactions
CREATE OR REPLACE FUNCTION log_point_transaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clients 
    SET 
        balance = balance + NEW.points,
        visit_count = CASE 
            WHEN NEW.operation_type IN ('earn', 'spend') THEN visit_count + 1
            ELSE visit_count
        END,
        last_visit = CASE 
            WHEN NEW.operation_type IN ('earn', 'spend') THEN NOW()
            ELSE last_visit
        END,
        total_spent = CASE 
            WHEN NEW.operation_type = 'earn' AND NEW.amount IS NOT NULL THEN total_spent + NEW.amount
            ELSE total_spent
        END
    WHERE id = NEW.client_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for automatic balance updates
CREATE TRIGGER trigger_log_point_transaction 
    AFTER INSERT ON point_transactions
    FOR EACH ROW EXECUTE FUNCTION log_point_transaction();

-- Insert default admin user (to be updated with real data)
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (0, 'admin', 'System Administrator', 'admin', true);

-- Grant appropriate permissions
GRANT SELECT ON barista_client_view TO rock_coffee_barista;
GRANT SELECT ON manager_client_view TO rock_coffee_manager;
GRANT ALL ON ALL TABLES IN SCHEMA public TO rock_coffee_admin;