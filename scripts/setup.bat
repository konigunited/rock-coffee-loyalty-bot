@echo off
setlocal enabledelayedexpansion

echo 🤖 Rock Coffee Bot - Setup Script
echo ==================================

REM Check if Node.js is installed
echo 🔍 Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%

REM Check if PostgreSQL is installed
echo 🔍 Checking PostgreSQL...
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL is not installed. Please install PostgreSQL 12+ first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('psql --version') do set POSTGRES_VERSION=%%i
echo ✅ PostgreSQL found: %POSTGRES_VERSION%

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully

REM Check .env file
echo ⚙️ Checking environment configuration...
if not exist .env (
    echo ❌ .env file not found
    pause
    exit /b 1
)

REM Check if password needs to be updated
findstr "DB_PASSWORD=your_password_here" .env >nul
if %errorlevel% equ 0 (
    echo ⚠️  Warning: Please update DB_PASSWORD in .env file
    echo   Current: your_password_here
    echo   Please edit .env file manually and set your PostgreSQL password
    pause
)

REM Build TypeScript
echo 🔨 Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✅ Build completed

REM Run migrations
echo 🔄 Running database migrations...
call npm run migrate
if %errorlevel% neq 0 (
    echo ❌ Migration failed - please check your database connection
    echo   Make sure PostgreSQL is running and credentials in .env are correct
    pause
    exit /b 1
)
echo ✅ Database migrations completed

echo.
echo 🎉 Setup completed successfully!
echo ==================================
echo.
echo 📋 Next steps:
echo 1. Add yourself as admin user:
echo    psql -h localhost -U postgres -d rock_coffee_bot
echo    INSERT INTO users (telegram_id, username, full_name, role, is_active)
echo    VALUES (YOUR_TELEGRAM_ID, 'username', 'Full Name', 'admin', true);
echo.
echo 2. Start the bot:
echo    npm run dev
echo.
echo 3. Test the bot in Telegram:
echo    Find your bot and send /start
echo.
echo 🚀 Rock Coffee Bot is ready to rock!
pause