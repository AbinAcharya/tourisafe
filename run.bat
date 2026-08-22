@echo off
REM Run Tourisafe on Windows: launches uvicorn in a new window and opens browser
cd /d "%~dp0"
echo Starting Tourisafe (uvicorn) in a new console window...
start "Tourisafe Server" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
timeout /t 1 >nul 2>&1
echo Opening browser to http://127.0.0.1:8000
start "" "http://127.0.0.1:8000"
exit /b 0
