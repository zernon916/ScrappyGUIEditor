@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Need Node.js from https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing desktop app dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Starting Scrappy GUI Editor...
call npm start
