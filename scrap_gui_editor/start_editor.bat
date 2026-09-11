@echo off
setlocal
cd /d "%~dp0"

echo.
echo Scrappy GUI Editor
echo Local only - binds to 127.0.0.1
echo.

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 server.py
  goto :eof
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python server.py
  goto :eof
)

echo Python 3 is required to start the local server used for folder
echo access, PNG reloads, and timestamped backups.
echo Install Python from https://www.python.org/ and try again.
pause
