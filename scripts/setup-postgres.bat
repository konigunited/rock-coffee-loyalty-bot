@echo off
echo 🐘 PostgreSQL Setup for Rock Coffee Bot
echo =======================================

REM Try to find PostgreSQL installation
set PGPATH=""
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PGPATH="C:\Program Files\PostgreSQL\15\bin"
if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" set PGPATH="C:\Program Files\PostgreSQL\14\bin"
if exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" set PGPATH="C:\Program Files\PostgreSQL\13\bin"
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PGPATH="C:\Program Files\PostgreSQL\16\bin"

if %PGPATH%=="" (
    echo ❌ PostgreSQL not found in standard locations
    echo Please run these commands manually in pgAdmin or psql:
    echo.
    echo 1. Connect to PostgreSQL as postgres user
    echo 2. Run: ALTER USER postgres PASSWORD 'RockCoffee2024!';
    echo 3. Run: CREATE DATABASE rock_coffee_bot;
    echo 4. Run: GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;
    echo.
    pause
    exit /b 1
)

echo ✅ Found PostgreSQL at %PGPATH%

echo.
echo 🔐 Setting up password and database...
echo Please enter the current PostgreSQL password when prompted

REM Set password
%PGPATH%\psql.exe -U postgres -c "ALTER USER postgres PASSWORD 'RockCoffee2024!';"
if %errorlevel% neq 0 (
    echo ❌ Failed to set password
    echo You may need to set it manually through pgAdmin
    goto :manual_instructions
)

echo ✅ Password set successfully

REM Create database
%PGPATH%\psql.exe -U postgres -c "CREATE DATABASE rock_coffee_bot;"
if %errorlevel% neq 0 (
    echo ⚠️ Database might already exist, continuing...
) else (
    echo ✅ Database created successfully
)

REM Grant privileges
%PGPATH%\psql.exe -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;"
if %errorlevel% neq 0 (
    echo ❌ Failed to grant privileges
) else (
    echo ✅ Privileges granted successfully
)

echo.
echo 🎉 PostgreSQL setup complete!
echo.
echo 📋 Database Details:
echo Host: localhost
echo Port: 5432
echo Database: rock_coffee_bot
echo User: postgres
echo Password: RockCoffee2024!
echo.
echo 🚀 Next steps:
echo 1. Run: npm run migrate
echo 2. Run: npm run quick-start
echo.
pause
goto :end

:manual_instructions
echo.
echo 📋 Manual Setup Instructions:
echo =============================
echo 1. Open pgAdmin or connect to PostgreSQL
echo 2. Connect as postgres user
echo 3. Run these SQL commands:
echo.
echo    ALTER USER postgres PASSWORD 'RockCoffee2024!';
echo    CREATE DATABASE rock_coffee_bot;
echo    GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;
echo.
echo 4. Then run: npm run migrate
echo 5. Then run: npm run quick-start
echo.
pause

:end