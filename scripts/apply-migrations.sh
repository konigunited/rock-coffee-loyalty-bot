#!/bin/bash

# Script to apply database migrations in Docker container
# Usage: ./scripts/apply-migrations.sh

set -e  # Exit on error

echo "🗄️  Applying database migrations..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is running
if ! docker-compose ps | grep -q "rock_coffee_db.*Up"; then
    echo -e "${RED}❌ PostgreSQL container is not running!${NC}"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

echo -e "${YELLOW}📋 Found migrations:${NC}"
ls -1 migrations/*.sql

# Copy migrations to container
echo -e "\n${YELLOW}📦 Copying migrations to container...${NC}"
docker cp migrations/. rock_coffee_db:/tmp/migrations/

# Apply each migration
echo -e "\n${YELLOW}🚀 Applying migrations...${NC}"

for migration in migrations/*.sql; do
    filename=$(basename "$migration")
    echo -e "\n${YELLOW}→ Applying: $filename${NC}"

    if docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f "/tmp/migrations/$filename"; then
        echo -e "${GREEN}✅ $filename applied successfully${NC}"
    else
        echo -e "${RED}❌ Failed to apply $filename${NC}"
        exit 1
    fi
done

# Verify tables
echo -e "\n${YELLOW}🔍 Verifying tables...${NC}"
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"

echo -e "\n${GREEN}✅ All migrations applied successfully!${NC}"
echo -e "\n${YELLOW}📊 Database statistics:${NC}"
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT pg_size_pretty(pg_database_size('rock_coffee_bot')) as \"Database Size\";
"

echo -e "\n${GREEN}🎉 Done!${NC}"
