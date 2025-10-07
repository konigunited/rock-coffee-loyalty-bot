-- Migration 004: Fix trigger to properly maintain clients.total_spent and backfill existing values

-- 1) Replace log_point_transaction function to correctly update total_spent for spend operations
CREATE OR REPLACE FUNCTION log_point_transaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clients 
    SET 
        balance = balance + NEW.points,
        visit_count = CASE 
            WHEN NEW.operation_type IN ('earn', 'spend') THEN COALESCE(visit_count, 0) + 1
            ELSE COALESCE(visit_count, 0)
        END,
        last_visit = CASE 
            WHEN NEW.operation_type IN ('earn', 'spend') THEN NOW()
            ELSE last_visit
        END,
        -- Maintain total_spent as sum of money/value spent. If amount is provided use amount, otherwise use ABS(points)
        total_spent = CASE 
            WHEN NEW.operation_type = 'spend' THEN COALESCE(total_spent, 0) + ABS(NEW.points)
            WHEN NEW.operation_type = 'earn' AND NEW.amount IS NOT NULL THEN COALESCE(total_spent, 0) + NEW.amount
            ELSE total_spent
        END
    WHERE id = NEW.client_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2) Backfill clients.total_spent from point_transactions (safe idempotent update)
-- Compute total_spent as sum of ABS(points) for operation_type='spend' (or amount for earns if desired)

UPDATE clients c
SET total_spent = COALESCE(sub.total_spent, 0)
FROM (
  SELECT pt.client_id, SUM( CASE WHEN pt.operation_type = 'spend' THEN ABS(pt.points) ELSE 0 END ) as total_spent
  FROM point_transactions pt
  GROUP BY pt.client_id
) sub
WHERE c.id = sub.client_id;

-- For clients without spend transactions, ensure total_spent is zero
UPDATE clients SET total_spent = 0 WHERE total_spent IS NULL;

-- 3) Ensure trigger exists and is using new function
DROP TRIGGER IF EXISTS trigger_log_point_transaction ON point_transactions;
CREATE TRIGGER trigger_log_point_transaction 
    AFTER INSERT ON point_transactions
    FOR EACH ROW EXECUTE FUNCTION log_point_transaction();

-- End migration
