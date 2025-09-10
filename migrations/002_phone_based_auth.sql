-- Rock Coffee Loyalty Bot Database Schema
-- Migration 002: Phone-based authentication support
-- This migration adds support for contact-based authentication while preserving existing clients

-- Add index for faster phone lookups (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_phone_unique') THEN
        CREATE UNIQUE INDEX idx_clients_phone_unique ON clients(phone) WHERE phone IS NOT NULL;
    END IF;
END $$;

-- Update clients table to support phone-based auth
-- Make telegram_id nullable to support clients without Telegram initially
ALTER TABLE clients ALTER COLUMN telegram_id DROP NOT NULL;

-- Add column for tracking authentication method
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'full_registration' CHECK (auth_method IN ('full_registration', 'phone_contact', 'manual'));

-- Add column for tracking if client completed full profile
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT true;

-- Add column for first name extraction from contact
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name VARCHAR(50);

-- Update existing clients to have proper auth_method and profile_completed
UPDATE clients 
SET 
    auth_method = 'full_registration',
    profile_completed = true
WHERE auth_method IS NULL;

-- Extract first names from existing full_name data
UPDATE clients 
SET first_name = CASE 
    WHEN full_name ~ '^[А-Яа-яЁё]+\s+([А-Яа-яЁё]+)' THEN 
        substring(full_name from '^[А-Яа-яЁё]+\s+([А-Яа-яЁё]+)')
    ELSE 
        split_part(full_name, ' ', 1)
END
WHERE first_name IS NULL AND full_name IS NOT NULL;

-- Create function to generate sequential card numbers
CREATE OR REPLACE FUNCTION generate_card_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_card_number VARCHAR(20);
    max_number INTEGER;
BEGIN
    -- Get the highest existing card number (assuming they're numeric)
    SELECT COALESCE(MAX(CASE 
        WHEN card_number ~ '^\d+$' THEN card_number::INTEGER 
        ELSE 0 
    END), 0) INTO max_number
    FROM clients;
    
    -- Generate next sequential number
    new_card_number := (max_number + 1)::TEXT;
    
    RETURN new_card_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle phone-based client creation
CREATE OR REPLACE FUNCTION create_client_by_phone(
    p_phone VARCHAR(20),
    p_telegram_id BIGINT,
    p_first_name VARCHAR(50) DEFAULT NULL,
    p_last_name VARCHAR(50) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    client_id INTEGER;
    full_name_value VARCHAR(100);
    card_number_value VARCHAR(20);
BEGIN
    -- Generate card number
    card_number_value := generate_card_number();
    
    -- Build full name
    IF p_last_name IS NOT NULL AND p_first_name IS NOT NULL THEN
        full_name_value := p_last_name || ' ' || p_first_name;
    ELSIF p_first_name IS NOT NULL THEN
        full_name_value := p_first_name;
    ELSE
        full_name_value := 'Клиент ' || card_number_value;
    END IF;

    -- Insert new client
    INSERT INTO clients (
        telegram_id,
        card_number,
        full_name,
        first_name,
        phone,
        balance,
        auth_method,
        profile_completed,
        created_at,
        updated_at
    ) VALUES (
        p_telegram_id,
        card_number_value,
        full_name_value,
        COALESCE(p_first_name, 'Клиент'),
        p_phone,
        100, -- Welcome bonus
        'phone_contact',
        p_last_name IS NOT NULL, -- Profile completed if we have last name
        NOW(),
        NOW()
    )
    RETURNING id INTO client_id;

    RETURN client_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to find or create client by phone
CREATE OR REPLACE FUNCTION find_or_create_client_by_phone(
    p_phone VARCHAR(20),
    p_telegram_id BIGINT,
    p_first_name VARCHAR(50) DEFAULT NULL,
    p_last_name VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
    client_id INTEGER,
    is_new_client BOOLEAN,
    card_number VARCHAR(20),
    full_name VARCHAR(100),
    balance INTEGER
) AS $$
DECLARE
    existing_client clients%ROWTYPE;
    new_client_id INTEGER;
BEGIN
    -- Try to find existing client by phone
    SELECT * INTO existing_client 
    FROM clients 
    WHERE phone = p_phone AND is_active = true
    LIMIT 1;

    IF FOUND THEN
        -- Update telegram_id if it changed or was null
        IF existing_client.telegram_id IS NULL OR existing_client.telegram_id != p_telegram_id THEN
            UPDATE clients 
            SET telegram_id = p_telegram_id, updated_at = NOW()
            WHERE id = existing_client.id;
        END IF;

        -- Return existing client
        RETURN QUERY SELECT 
            existing_client.id,
            false,
            existing_client.card_number,
            existing_client.full_name,
            existing_client.balance;
    ELSE
        -- Create new client
        new_client_id := create_client_by_phone(p_phone, p_telegram_id, p_first_name, p_last_name);
        
        -- Return new client data
        RETURN QUERY SELECT 
            new_client_id,
            true,
            c.card_number,
            c.full_name,
            c.balance
        FROM clients c 
        WHERE c.id = new_client_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create view for phone-based client authentication
CREATE OR REPLACE VIEW client_auth_view AS
SELECT 
    c.id,
    c.telegram_id,
    c.card_number,
    c.full_name,
    c.first_name,
    c.phone,
    c.birth_date,
    c.balance,
    c.total_spent,
    c.visit_count,
    c.last_visit,
    c.notes,
    c.is_active,
    c.auth_method,
    c.profile_completed,
    c.created_at,
    c.updated_at,
    CASE 
        WHEN c.auth_method = 'phone_contact' AND NOT c.profile_completed 
        THEN true 
        ELSE false 
    END as needs_profile_completion
FROM clients c;

-- Update existing indexes
DROP INDEX IF EXISTS idx_clients_phone;
CREATE INDEX idx_clients_phone_lookup ON clients(phone) WHERE phone IS NOT NULL AND is_active = true;
CREATE INDEX idx_clients_telegram_auth ON clients(telegram_id) WHERE telegram_id IS NOT NULL AND is_active = true;
CREATE INDEX idx_clients_auth_method ON clients(auth_method);

-- Add constraint to ensure phone uniqueness for active clients
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_phone_active_unique 
ON clients(phone) 
WHERE is_active = true AND phone IS NOT NULL;

-- Update activity log to track new authentication events
INSERT INTO activity_log (user_id, action, details, created_at) 
VALUES (1, 'system_migration', '{"migration": "002_phone_based_auth", "description": "Added phone-based authentication support"}', NOW());

COMMENT ON COLUMN clients.auth_method IS 'Method used for client authentication: full_registration, phone_contact, manual';
COMMENT ON COLUMN clients.profile_completed IS 'Whether client has completed full profile setup';
COMMENT ON COLUMN clients.first_name IS 'Extracted or provided first name for personalization';
-- Convert existing 5-digit card numbers to sequential numbers
DO $$
DECLARE
    client_record RECORD;
    new_number INTEGER := 1;
BEGIN
    -- Process all existing clients in order of creation
    FOR client_record IN 
        SELECT id, card_number 
        FROM clients 
        WHERE is_active = true 
        ORDER BY created_at ASC
    LOOP
        -- Update card number to sequential
        UPDATE clients 
        SET card_number = new_number::TEXT, updated_at = NOW()
        WHERE id = client_record.id;
        
        new_number := new_number + 1;
    END LOOP;
    
    RAISE NOTICE 'Converted % client card numbers to sequential format', new_number - 1;
END $$;

COMMENT ON FUNCTION generate_card_number IS 'Generates sequential card numbers (1, 2, 3, ...)';
COMMENT ON FUNCTION create_client_by_phone IS 'Creates a new client using phone-based authentication';
COMMENT ON FUNCTION find_or_create_client_by_phone IS 'Finds existing client by phone or creates new one';