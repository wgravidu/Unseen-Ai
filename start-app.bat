@echo off
title UNSEEN AI Launcher
cd /d "%~dp0"

echo ============================================
echo   UNSEEN AI - Starting...
echo ============================================
echo.

REM --- Backend (FastAPI, port 8000) ---
curl -s http://127.0.0.1:8000/health >nul 2>&1
if %errorlevel%==0 (
  echo [OK] Backend already running on port 8000
) else (
  echo [..] Starting backend...
  start "UNSEEN AI Backend - do not close" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
)

REM --- Frontend (Vite, port 5173) ---
curl -s http://127.0.0.1:5173/ >nul 2>&1
if %errorlevel%==0 (
  echo [OK] Frontend already running on port 5173
) else (
  echo [..] Starting frontend...
  start "UNSEEN AI Frontend - do not close" cmd /k "cd /d "%~dp0unseen-ai" && npm run dev"
)

REM --- Wait until the web app responds, then open the browser ---
echo.
echo Waiting for the app to be ready...
set /a tries=0
:waitloop
curl -s http://127.0.0.1:5173/ >nul 2>&1
if %errorlevel%==0 goto ready
set /a tries+=1
if %tries% GEQ 30 goto timeout
timeout /t 1 /nobreak >nul
goto waitloop

:ready
echo [OK] App is ready!
start "" http://127.0.0.1:5173/
echo.
echo Local:   http://localhost:5173
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  set "LANIP=%%A"
  goto lanipdone
)
:lanipdone
if defined LANIP echo Network: http://%LANIP: =%:5173 - Open this on mobile
echo Browser opened: http://127.0.0.1:5173/
echo Keep the two black server windows open while using the app.
echo To STOP the app: close those two windows (or press Ctrl+C in them).
goto end

:timeout
echo [!] App did not respond within 30 seconds.
echo     Check the two server windows for error messages.

:end
echo.
pause
