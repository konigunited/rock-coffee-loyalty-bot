@echo off
echo ========================================
echo  TELEGRAM LOYALTY BOT - STARTUP
echo ========================================
echo.

cd /d "C:\Users\F12$\Desktop\rc_bot"
call venv\Scripts\activate.bat

echo Checking configuration...
if not exist .env (
    echo ERROR: .env file not found!
    pause
    exit /b 1
)

if not exist credentials.json (
    echo WARNING: credentials.json not found!
    echo Please download credentials.json from Google Cloud Console
    echo.
)

echo Starting bot...
python main.py

pause