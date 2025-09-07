@echo off
echo Rock Coffee Bot - Status Check
echo ===============================

echo Checking bot token...
echo Token: 8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs
echo.

echo Checking database connection...
set PGPASSWORD=7R4P5T4R

REM Find PostgreSQL
set PSQL=""
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"

echo Testing database connection...
%PSQL% -h localhost -U postgres -d rock_coffee_bot -c "SELECT 'Database connection OK' as status;"

echo.
echo Checking admin user...
%PSQL% -h localhost -U postgres -d rock_coffee_bot -c "SELECT telegram_id, username, full_name, role FROM users WHERE telegram_id = 8092298631;"

echo.
echo Checking all users...
%PSQL% -h localhost -U postgres -d rock_coffee_bot -c "SELECT telegram_id, username, full_name, role, is_active FROM users;"

set PGPASSWORD=
echo.
echo Next steps:
echo 1. Make sure npm run quick-start is running
echo 2. Check if your admin user exists above
echo 3. Find bot in Telegram using token
echo.
pause