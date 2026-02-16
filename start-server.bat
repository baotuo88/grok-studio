@echo off
REM Grok Studio 本地服务器启动脚本 (Windows)

echo.
echo 🚀 启动 Grok Studio 本地服务器...
echo.

REM 检测 Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python
    goto :found_python
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python3
    goto :found_python
)

echo ❌ 错误：未找到 Python
echo 请先安装 Python: https://www.python.org/downloads/
pause
exit /b 1

:found_python
for /f "tokens=2" %%i in ('%PYTHON_CMD% --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ 找到 Python %PYTHON_VERSION%
echo.

REM 设置端口
set PORT=8000
echo 📡 服务器将在端口 %PORT% 启动
echo.
echo 🌐 访问地址: http://localhost:%PORT%
echo 📝 按 Ctrl+C 停止服务器
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM 启动服务器
%PYTHON_CMD% -m http.server %PORT%

pause
