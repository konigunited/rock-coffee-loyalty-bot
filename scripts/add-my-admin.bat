@echo off
echo Rock Coffee Bot - Adding Admin User
echo ====================================

set TELEGRAM_ID=8092298631
set USERNAME=F12
set FULLNAME=Administrator

set PGPASSWORD=7R4P5T4R

REM Find PostgreSQL
set PSQL=""
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"

echo Adding admin user...
echo Telegram ID: %TELEGRAM_ID%
echo Username: %USERNAME%
echo Full Name: %FULLNAME%
echo.

%PSQL% -h localhost -U postgres -d rock_coffee_bot -c "INSERT INTO users (telegram_id, username, full_name, role, is_active) VALUES (%TELEGRAM_ID%, '%USERNAME%', '%FULLNAME%', 'admin', true) ON CONFLICT (telegram_id) DO UPDATE SET username = '%USERNAME%', full_name = '%FULLNAME%', role = 'admin', is_active = true;"

if %errorlevel%==0 (
    echo ✅ Admin user added successfully!
    echo.
    echo ✅ Your admin account is ready!
    echo.
    echo 🚀 Next steps:
    echo 1. Make sure bot is running: npm run quick-start
    echo 2. Find your bot in Telegram
    echo 3. Send /start
    echo 4. You should see the admin panel!
) else (
    echo ❌ Failed to add admin user
)

set PGPASSWORD=
echo.
pause