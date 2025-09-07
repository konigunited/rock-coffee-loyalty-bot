@echo off
echo Rock Coffee Bot - Database Migration
echo ====================================

REM Create pgpass file for automatic authentication
echo localhost:5432:*:postgres:7R4P5T4R > "%USERPROFILE%\.pgpass"

REM Find PostgreSQL
set PSQL=""
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"

if %PSQL%=="" (
    echo PostgreSQL not found
    del "%USERPROFILE%\.pgpass" 2>nul
    pause
    exit /b 1
)

echo Found PostgreSQL: %PSQL%
echo Applying migrations to rock_coffee_bot database...
echo.

REM Execute migration file directly
%PSQL% -h localhost -U postgres -d rock_coffee_bot -w -f migrations/001_initial_schema.sql

if %errorlevel%==0 (
    echo.
    echo Migration completed successfully!
    echo.
    echo Adding default admin user...
    %PSQL% -h localhost -U postgres -d rock_coffee_bot -w -c "INSERT INTO users (telegram_id, username, full_name, role, is_active) VALUES (0, 'system_admin', 'System Administrator', 'admin', true) ON CONFLICT (telegram_id) DO NOTHING;"
    echo Default admin user added!
) else (
    echo.
    echo Migration failed! Please check the error above.
)

echo.
echo Cleaning up...
del "%USERPROFILE%\.pgpass" 2>nul

echo.
echo Database setup completed!
echo.
echo Next step: npm run quick-start
echo.
pause