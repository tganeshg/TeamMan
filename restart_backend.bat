@echo off
echo Stopping any process on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo Starting backend with latest code...
cd /d "%~dp0backend"
.\.venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 3001
