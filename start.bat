@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check the log above.
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 pause
