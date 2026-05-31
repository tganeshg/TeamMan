@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

echo === TeamMan Startup ===

echo [1/3] Installing backend dependencies...
cd /d "%SCRIPT_DIR%backend"
pip install -r requirements.txt -q

echo [2/3] Starting backend on http://localhost:8000 ...
start "TeamMan Backend" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [3/3] Installing and starting frontend on http://localhost:3000 ...
cd /d "%SCRIPT_DIR%frontend"
call npm install --silent
start "TeamMan Frontend" cmd /c "npm run dev"

echo.
echo TeamMan is starting... waiting 5 seconds.
timeout /t 5 /nobreak >nul

start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop TeamMan.
pause
