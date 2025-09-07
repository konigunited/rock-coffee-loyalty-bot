@echo off
echo Rock Coffee Bot - Database Migration (Fixed)
echo =============================================

REM Set password as environment variable
set PGPASSWORD=7R4P5T4R

REM Find PostgreSQL
set PSQL=""
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"

if %PSQL%=="" (
    echo PostgreSQL not found
    pause
    exit /b 1
)

echo Found PostgreSQL: %PSQL%
echo Using password: 7R4P5T4R
echo Applying migrations to rock_coffee_bot database...
echo.

REM Execute migration file directly
%PSQL% -h localhost -U postgres -d rock_coffee_bot -f migrations/001_basic_schema.sql

if %errorlevel%==0 (
    echo.
    echo ✅ Migration completed successfully!
    echo.
    echo Adding default admin user...
    %PSQL% -h localhost -U postgres -d rock_coffee_bot -c "INSERT INTO users (telegram_id, username, full_name, role, is_active) VALUES (0, 'system_admin', 'System Administrator', 'admin', true) ON CONFLICT (telegram_id) DO NOTHING;"
    if %errorlevel%==0 (
        echo ✅ Default admin user added!
    )
) else (
    echo.
    echo ❌ Migration failed! Please check PostgreSQL connection.
    echo Make sure PostgreSQL is running and password is correct.
)

REM Clear password from environment
set PGPASSWORD=

echo.
echo Database setup completed!
echo.
echo 🚀 Next step: npm run quick-start
echo.
pause