@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  GBN 离线包本地服务器
echo  ====================
echo  启动后请在浏览器打开: http://localhost:8080/
echo  按 Ctrl+C 停止服务
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

echo [错误] 未找到 python 或 npx，请安装 Python 或 Node.js 后重试。
pause
