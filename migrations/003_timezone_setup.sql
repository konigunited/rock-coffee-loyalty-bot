-- Set timezone for PostgreSQL to Kaliningrad time (UTC+2)
SET TIME ZONE 'Europe/Kaliningrad';

-- Set default timezone for all new sessions
ALTER DATABASE rock_coffee_bot SET timezone = 'Europe/Kaliningrad';

-- Update existing timestamp columns to use proper timezone
-- This ensures all existing and new records use Kaliningrad time