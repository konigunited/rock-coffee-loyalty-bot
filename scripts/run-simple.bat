@echo off
echo 🤖 Rock Coffee Bot - Simple Start
echo ==================================

echo Stopping any existing Node processes...
taskkill /f /im node.exe 2>nul

echo.
echo Starting bot with simple JavaScript...
echo Token: 8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs
echo Admin ID: 8092298631
echo.

cd /d "%~dp0\.."
node scripts\start-bot.js

pause