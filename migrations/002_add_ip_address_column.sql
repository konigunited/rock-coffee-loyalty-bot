-- Add ip_address column to activity_log table
-- Migration 002: Fix missing ip_address column

-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'activity_log'
        AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE activity_log ADD COLUMN ip_address INET;
        RAISE NOTICE 'Column ip_address added to activity_log table';
    ELSE
        RAISE NOTICE 'Column ip_address already exists in activity_log table';
    END IF;
END $$;

-- Success message
SELECT 'Migration 002 completed: ip_address column added to activity_log' as message;
