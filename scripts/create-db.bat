@echo off
echo Rock Coffee Bot - Database Setup
echo ================================

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
echo Using password: 7R4P5T4R
echo.

echo Creating database...
%PSQL% -h localhost -U postgres -w -c "CREATE DATABASE rock_coffee_bot;"

echo.
echo Granting privileges...
%PSQL% -h localhost -U postgres -w -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;"

echo.
echo Cleaning up...
del "%USERPROFILE%\.pgpass" 2>nul

echo.
echo Setup completed!
echo.
echo Next steps:
echo 1. npm run migrate
echo 2. npm run quick-start
echo.
pause