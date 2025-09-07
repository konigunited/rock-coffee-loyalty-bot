@echo off
chcp 65001 > nul
echo 🤖 Rock Coffee Bot - Настройка PostgreSQL (с автопаролем)
echo ======================================================

REM Создаем временный файл с паролем
echo localhost:5432:*:postgres:7R4P5T4R > %TEMP%\pgpass.conf
set PGPASSFILE=%TEMP%\pgpass.conf

REM Находим PostgreSQL
set PSQL_PATH=""
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\15\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\16\bin\psql.exe"

if %PSQL_PATH%=="" (
    echo ❌ PostgreSQL не найден
    del %TEMP%\pgpass.conf
    pause
    exit /b 1
)

echo ✅ Найден PostgreSQL: %PSQL_PATH%
echo 🔐 Используется автоматический пароль: 7R4P5T4R
echo.

echo 📊 Создание базы данных rock_coffee_bot...
%PSQL_PATH% -h localhost -U postgres -c "CREATE DATABASE rock_coffee_bot;" 2>nul

if %errorlevel%==0 (
    echo ✅ База данных создана успешно!
) else (
    echo ⚠️ База данных возможно уже существует или неверный пароль
)

echo.
echo 🔑 Предоставление прав доступа...
%PSQL_PATH% -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;" 2>nul

echo.
echo 🧹 Очистка временных файлов...
del %TEMP%\pgpass.conf 2>nul

echo.
echo 🎉 Настройка завершена!
echo.
echo 📋 Проверьте результат командой:
echo npm run migrate
echo.
echo 🚀 Если миграция прошла успешно, запускайте:
echo npm run quick-start
echo.
pause