# Rock Coffee Bot - Настройка через PowerShell
Write-Host "🤖 Rock Coffee Bot - PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Устанавливаем переменные окружения для PostgreSQL
$env:PGUSER = "postgres"
$env:PGPASSWORD = "7R4P5T4R"
$env:PGHOST = "localhost"
$env:PGPORT = "5432"

# Ищем PostgreSQL
$pgPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe", 
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe"
)

$psqlPath = $null
foreach ($path in $pgPaths) {
    if (Test-Path $path) {
        $psqlPath = $path
        Write-Host "✅ Найден PostgreSQL: $path" -ForegroundColor Green
        break
    }
}

if (-not $psqlPath) {
    Write-Host "❌ PostgreSQL не найден!" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit
}

Write-Host "🔐 Используется пароль: 7R4P5T4R" -ForegroundColor Yellow
Write-Host ""

# Создание базы данных
Write-Host "📊 Создание базы данных rock_coffee_bot..." -ForegroundColor Cyan
try {
    $result = & $psqlPath -c "CREATE DATABASE rock_coffee_bot;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ База данных создана успешно!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ База данных возможно уже существует" -ForegroundColor Yellow
        Write-Host "Детали: $result" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Ошибка: $_" -ForegroundColor Red
}

# Предоставление прав
Write-Host "🔑 Предоставление прав доступа..." -ForegroundColor Cyan
try {
    $result = & $psqlPath -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Права предоставлены!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Возможно права уже предоставлены" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Ошибка при предоставлении прав: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Настройка PostgreSQL завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. npm run migrate" -ForegroundColor White
Write-Host "2. npm run quick-start" -ForegroundColor White

# Очищаем переменные окружения
Remove-Item Env:PGPASSWORD
Remove-Item Env:PGUSER 
Remove-Item Env:PGHOST
Remove-Item Env:PGPORT

Read-Host "`nPress Enter to continue"