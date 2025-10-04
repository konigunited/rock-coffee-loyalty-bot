#!/bin/bash

# Quick deploy script for Rock Coffee Bot
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Apply migrations
echo -e "\n${YELLOW}📊 Step 1: Applying database migrations...${NC}"
./scripts/apply-migrations.sh

# Step 2: Build and restart bot
echo -e "\n${YELLOW}🔨 Step 2: Building bot...${NC}"
docker-compose build bot

echo -e "\n${YELLOW}🔄 Step 3: Restarting bot...${NC}"
docker-compose up -d bot

# Step 4: Wait for bot to start
echo -e "\n${YELLOW}⏳ Step 4: Waiting for bot to start...${NC}"
sleep 5

# Step 5: Check health
echo -e "\n${YELLOW}🏥 Step 5: Checking health...${NC}"
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bot is healthy!${NC}"
else
    echo -e "${RED}❌ Bot health check failed!${NC}"
    docker-compose logs --tail=50 bot
    exit 1
fi

# Step 6: Show logs
echo -e "\n${YELLOW}📋 Step 6: Recent logs:${NC}"
docker-compose logs --tail=20 bot

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "\n${YELLOW}📝 Next steps:${NC}"
echo "  1. Test bot in Telegram: /start"
echo "  2. Monitor logs: docker-compose logs -f bot"
echo "  3. Check sessions: docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c 'SELECT COUNT(*) FROM sessions;'"
