# Rock Coffee Bot - Финальная настройка PostgreSQL
Write-Host "🤖 Rock Coffee Bot - PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Найдем PostgreSQL
$pgPaths = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\14\bin"
)

$pgPath = $null
foreach ($path in $pgPaths) {
    if (Test-Path "$path\psql.exe") {
        $pgPath = $path
        Write-Host "✅ Найден PostgreSQL: $path" -ForegroundColor Green
        break
    }
}

if (-not $pgPath) {
    Write-Host "❌ PostgreSQL не найден!" -ForegroundColor Red
    Write-Host "Используйте ручную настройку через pgAdmin" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit
}

# Устанавливаем пароль в переменную окружения
$env:PGPASSWORD = "7R4P5T4R"

Write-Host "`n🗄️ Создание базы данных..." -ForegroundColor Yellow

try {
    # Создаем базу данных
    $output = & "$pgPath\psql.exe" -U postgres -c "CREATE DATABASE rock_coffee_bot;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ База данных создана успешно!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ База данных возможно уже существует" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Ошибка создания базы данных: $_" -ForegroundColor Red
}

Write-Host "`n🚀 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. npm run migrate    - Применить миграции" -ForegroundColor White
Write-Host "2. npm run quick-start - Запустить бота" -ForegroundColor White

Read-Host "`nНажмите Enter для продолжения"