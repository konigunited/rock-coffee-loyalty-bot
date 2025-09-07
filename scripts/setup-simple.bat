@echo off
chcp 65001 > nul
echo 🤖 Rock Coffee Bot - Настройка PostgreSQL
echo ==========================================

REM Устанавливаем пароль в переменную окружения
set PGPASSWORD=7R4P5T4R

REM Попробуем найти psql
set PSQL_PATH=""
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\15\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\16\bin\psql.exe"

if %PSQL_PATH%=="" (
    echo ❌ PostgreSQL не найден
    echo Используйте pgAdmin
    pause
    exit /b 1
)

echo ✅ Найден PostgreSQL: %PSQL_PATH%
echo.

echo 📊 Создание базы данных...
%PSQL_PATH% -U postgres -c "CREATE DATABASE rock_coffee_bot;"

if %errorlevel%==0 (
    echo ✅ База данных создана успешно!
) else (
    echo ⚠️ База данных возможно уже существует
)

echo.
echo 🔑 Предоставление прав доступа...
%PSQL_PATH% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;"

if %errorlevel%==0 (
    echo ✅ Права предоставлены успешно!
) else (
    echo ⚠️ Возможно права уже предоставлены
)

echo.
echo 🎉 Настройка PostgreSQL завершена!
echo.
echo 📋 Следующие шаги:
echo 1. npm run migrate
echo 2. npm run quick-start
echo.
pause