# Quick Migration for Rock Coffee Bot
Write-Host "Rock Coffee Bot - Quick Migration" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$env:PGPASSWORD = "7R4P5T4R"

$psqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $psqlPath = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
}

if (-not (Test-Path $psqlPath)) {
    Write-Host "PostgreSQL not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Using PostgreSQL: $psqlPath" -ForegroundColor Green
Write-Host "Executing migration..." -ForegroundColor Yellow

try {
    $result = & $psqlPath -h localhost -U postgres -d rock_coffee_bot -f "ПРОСТАЯ МИГРАЦИЯ.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "Migration failed:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "`nNext step: npm run quick-start" -ForegroundColor Cyan
Read-Host "Press Enter to continue"