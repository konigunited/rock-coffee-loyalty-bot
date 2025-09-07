@echo off
echo Rock Coffee Bot - Add Admin User
echo ==================================

set /p TELEGRAM_ID="Enter your Telegram ID: "
set /p USERNAME="Enter your username: "
set /p FULLNAME="Enter your full name: "

if "%TELEGRAM_ID%"=="" (
    echo Error: Telegram ID is required
    pause
    exit /b 1
)

if "%FULLNAME%"=="" (
    set FULLNAME=Admin User
)

set PGPASSWORD=7R4P5T4R

REM Find PostgreSQL
set PSQL=""
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"

echo.
echo Adding admin user...
echo Telegram ID: %TELEGRAM_ID%
echo Username: %USERNAME%
echo Full Name: %FULLNAME%
echo.

%PSQL% -h localhost -U postgres -d rock_coffee_bot -c "INSERT INTO users (telegram_id, username, full_name, role, is_active) VALUES (%TELEGRAM_ID%, '%USERNAME%', '%FULLNAME%', 'admin', true) ON CONFLICT (telegram_id) DO UPDATE SET username = '%USERNAME%', full_name = '%FULLNAME%', role = 'admin', is_active = true;"

if %errorlevel%==0 (
    echo ✅ Admin user added successfully!
    echo.
    echo You can now use the bot:
    echo 1. Find your bot in Telegram
    echo 2. Send /start
    echo 3. You should see the admin panel
) else (
    echo ❌ Failed to add admin user
)

set PGPASSWORD=
echo.
pause