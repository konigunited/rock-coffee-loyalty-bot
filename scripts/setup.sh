#!/bin/bash

# Rock Coffee Bot Setup Script
echo "🤖 Rock Coffee Bot - Setup Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${BLUE}🔍 Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js found: ${NODE_VERSION}${NC}"

# Check if PostgreSQL is installed
echo -e "${BLUE}🔍 Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed. Please install PostgreSQL 12+ first.${NC}"
    exit 1
fi

POSTGRES_VERSION=$(psql --version)
echo -e "${GREEN}✅ PostgreSQL found: ${POSTGRES_VERSION}${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Check .env file
echo -e "${BLUE}⚙️ Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Read database password from .env
DB_PASSWORD=$(grep "DB_PASSWORD=" .env | cut -d '=' -f2)
if [ "$DB_PASSWORD" = "your_password_here" ]; then
    echo -e "${YELLOW}⚠️  Warning: Please update DB_PASSWORD in .env file${NC}"
    echo -e "${YELLOW}   Current: your_password_here${NC}"
    echo -e "${BLUE}   Please enter your PostgreSQL password:${NC}"
    read -s password
    sed -i "s/DB_PASSWORD=your_password_here/DB_PASSWORD=$password/" .env
    echo -e "${GREEN}✅ Database password updated${NC}"
fi

# Test database connection
echo -e "${BLUE}🗄️ Testing database connection...${NC}"
DB_HOST=$(grep "DB_HOST=" .env | cut -d '=' -f2)
DB_PORT=$(grep "DB_PORT=" .env | cut -d '=' -f2)
DB_NAME=$(grep "DB_NAME=" .env | cut -d '=' -f2)
DB_USER=$(grep "DB_USER=" .env | cut -d '=' -f2)
DB_PASSWORD=$(grep "DB_PASSWORD=" .env | cut -d '=' -f2)

# Try to connect to PostgreSQL
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Failed to connect to database${NC}"
    echo -e "${YELLOW}   Please check your PostgreSQL connection and credentials${NC}"
    exit 1
fi

# Create database if it doesn't exist
echo -e "${BLUE}🏗️ Creating database if not exists...${NC}"
PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database created: ${DB_NAME}${NC}"
else
    echo -e "${YELLOW}ℹ️  Database ${DB_NAME} already exists${NC}"
fi

# Run migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
npm run migrate
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# Build TypeScript
echo -e "${BLUE}🔨 Building TypeScript...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Success message
echo ""
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo "=================================="
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "1. Add yourself as admin user:"
echo -e "   ${YELLOW}psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME${NC}"
echo -e "   ${YELLOW}INSERT INTO users (telegram_id, username, full_name, role, is_active)${NC}"
echo -e "   ${YELLOW}VALUES (YOUR_TELEGRAM_ID, 'username', 'Full Name', 'admin', true);${NC}"
echo ""
echo -e "2. Start the bot:"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo -e "3. Test the bot in Telegram:"
echo -e "   ${YELLOW}Find your bot and send /start${NC}"
echo ""
echo -e "${GREEN}🚀 Rock Coffee Bot is ready to rock!${NC}"