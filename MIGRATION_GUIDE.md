# Database Migration Guide

## Current Issue: Registration Not Working

**Problem:** New users cannot register because `ip_address` column is missing in `activity_log` table.

**Error in logs:**
```
ERROR:  column "ip_address" of relation "activity_log" does not exist at character 86
```

---

## How to Apply Migration 002 on Production Server

### Option 1: Using Migration File (Recommended)

```bash
# 1. Pull latest changes from git
cd ~/rc_bot
git pull origin main

# 2. Apply the migration
docker exec rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty < migrations/002_add_ip_address_column.sql

# 3. Verify the migration
docker exec rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty -c "\d activity_log"
```

### Option 2: Direct SQL Command

```bash
# Apply directly without file
docker exec rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty -c "ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip_address INET;"

# Verify
docker exec rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty -c "\d activity_log"
```

### Option 3: Interactive psql Session

```bash
# Enter database shell
docker exec -it rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty

# Run SQL manually
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip_address INET;

# Check result
\d activity_log

# Exit
\q
```

---

## Verification Steps

After applying the migration, verify that:

1. **Column exists:**
```bash
docker exec rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'ip_address';"
```

Expected output:
```
 column_name | data_type
-------------+-----------
 ip_address  | inet
```

2. **Test registration:**
```bash
# Monitor logs in real-time
docker-compose logs -f rock_coffee_bot

# In another terminal, try to register a new user via Telegram bot
# You should no longer see the "column ip_address does not exist" error
```

3. **Check for errors:**
```bash
# Check recent logs for errors
docker-compose logs --tail 50 rock_coffee_db | grep ERROR
```

---

## Rollback (If Needed)

If something goes wrong, you can remove the column:

```bash
docker exec rock_coffee_db psql -U rock_coffee_user -d rock_coffee_loyalty -c "ALTER TABLE activity_log DROP COLUMN IF EXISTS ip_address;"
```

**Note:** This is safe because the application has fallback code in `UserService.logActivity()` that handles the missing column gracefully.

---

## Migration History

| Migration | Date | Description |
|-----------|------|-------------|
| 001_initial_schema.sql | Initial | Full database schema with all tables |
| 001_basic_schema.sql | Initial | Alternative basic schema |
| **002_add_ip_address_column.sql** | **2025-10-11** | **Fix missing ip_address column in activity_log** |

---

## Common Issues

### Issue: "psql: FATAL: role does not exist"
**Solution:** Check that you're using the correct database user name from docker-compose.yml

### Issue: "database does not exist"
**Solution:** Verify database name in docker-compose.yml environment variables

### Issue: "docker: command not found"
**Solution:** Make sure Docker is installed and running on the production server

### Issue: Migration already applied
**Don't worry!** The migration uses `IF NOT EXISTS` checks, so it's safe to run multiple times.
