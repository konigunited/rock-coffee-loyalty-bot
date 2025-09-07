# Rock Coffee Bot PostgreSQL Setup (PowerShell)
Write-Host "🐘 PostgreSQL Setup for Rock Coffee Bot" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$pgPath = "C:\Program Files\PostgreSQL\15\bin"

if (Test-Path "$pgPath\psql.exe") {
    Write-Host "✅ Found PostgreSQL at $pgPath" -ForegroundColor Green
    
    Write-Host "`n🔐 Setting up password and database..." -ForegroundColor Yellow
    Write-Host "Note: You may need to enter the current PostgreSQL password" -ForegroundColor Yellow
    
    # Set environment variable for password
    $env:PGPASSWORD = "RockCoffee2024!"
    
    # Try to set password (may fail if different password exists)
    Write-Host "`n1️⃣ Setting password..." -ForegroundColor Cyan
    & "$pgPath\psql.exe" -U postgres -c "ALTER USER postgres PASSWORD 'RockCoffee2024!';" 2>$null
    
    # Create database
    Write-Host "2️⃣ Creating database..." -ForegroundColor Cyan
    & "$pgPath\psql.exe" -U postgres -c "CREATE DATABASE rock_coffee_bot;" 2>$null
    
    # Grant privileges
    Write-Host "3️⃣ Granting privileges..." -ForegroundColor Cyan
    & "$pgPath\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;" 2>$null
    
    Write-Host "`n🎉 Setup attempted!" -ForegroundColor Green
    Write-Host "If you got password errors, use pgAdmin instead." -ForegroundColor Yellow
    
} else {
    Write-Host "❌ PostgreSQL not found at expected location" -ForegroundColor Red
    Write-Host "Please use pgAdmin or find your PostgreSQL installation" -ForegroundColor Yellow
}

Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. npm run migrate" -ForegroundColor White
Write-Host "2. npm run quick-start" -ForegroundColor White

Read-Host "`nPress Enter to continue"