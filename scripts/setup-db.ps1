# Rock Coffee Bot - Database Setup
Write-Host "Rock Coffee Bot - PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Set PostgreSQL environment variables
$env:PGUSER = "postgres"
$env:PGPASSWORD = "7R4P5T4R"
$env:PGHOST = "localhost"
$env:PGPORT = "5432"

# Find PostgreSQL installation
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
        Write-Host "Found PostgreSQL: $path" -ForegroundColor Green
        break
    }
}

if (-not $psqlPath) {
    Write-Host "PostgreSQL not found!" -ForegroundColor Red
    Write-Host "Please use pgAdmin instead" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Using password: 7R4P5T4R" -ForegroundColor Yellow
Write-Host ""

# Create database
Write-Host "Creating database rock_coffee_bot..." -ForegroundColor Cyan
try {
    $result = & $psqlPath -c "CREATE DATABASE rock_coffee_bot;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database created successfully!" -ForegroundColor Green
    } else {
        Write-Host "Database might already exist" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Grant privileges
Write-Host "Granting privileges..." -ForegroundColor Cyan
try {
    $result = & $psqlPath -c "GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Privileges granted!" -ForegroundColor Green
    } else {
        Write-Host "Privileges might already be granted" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error granting privileges: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "PostgreSQL setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. npm run migrate" -ForegroundColor White
Write-Host "2. npm run quick-start" -ForegroundColor White

# Clean up environment variables
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
Remove-Item Env:PGHOST -ErrorAction SilentlyContinue
Remove-Item Env:PGPORT -ErrorAction SilentlyContinue

Read-Host "`nPress Enter to continue"