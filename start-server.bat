@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  GBN Offline Pack - Local Server
echo  ===============================
echo  Open in browser: http://localhost:8080/
echo  Press Ctrl+C to stop
echo.

where python >nul 2>&1
if %errorlevel%==0 (
  python -m http.server 8080
  goto :eof
)

where py >nul 2>&1
if %errorlevel%==0 (
  py -m http.server 8080
  goto :eof
)

where npx >nul 2>&1
if %errorlevel%==0 (
  npx --yes serve -l 8080
  goto :eof
)

echo [ERROR] Python or Node.js (npx) required.
pause
