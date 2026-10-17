@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py dev-server.py --open
) else (
  python dev-server.py --open
)
pause
