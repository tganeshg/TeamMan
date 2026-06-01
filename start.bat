@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "VENV_DIR=%SCRIPT_DIR%backend\.venv"

echo === TeamMan Startup ===

echo [1/4] Setting up Python virtual environment...
cd /d "%SCRIPT_DIR%backend"

if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo     Creating venv...
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        echo Make sure Python 3.x is installed and on PATH.
        pause
        exit /b 1
    )
)

echo [2/4] Installing backend dependencies...
"%VENV_DIR%\Scripts\pip.exe" install -r requirements.txt -q
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies.
    pause
    exit /b 1
)

echo [3/4] Starting backend on http://localhost:8000 ...
start "TeamMan Backend" cmd /k "cd /d "%SCRIPT_DIR%backend" && "%VENV_DIR%\Scripts\uvicorn.exe" main:app --host 0.0.0.0 --port 8000 --reload || (echo. && echo === BACKEND ERROR — window kept open === && pause)"

echo [4/4] Installing and starting frontend on http://localhost:3000 ...
cd /d "%SCRIPT_DIR%frontend"
call npm install --silent
start "TeamMan Frontend" cmd /k "npm run dev || (echo. && echo === FRONTEND ERROR — window kept open === && pause)"

echo.
echo TeamMan is starting... waiting 10 seconds.
timeout /t 10 /nobreak >nul

start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop TeamMan.
pause
