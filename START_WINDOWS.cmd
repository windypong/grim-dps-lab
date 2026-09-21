@echo off
setlocal
cd /d "%~dp0"
echo Grim DPS Lab v3 - Automatic Build Compiler BETA
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1" %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo.
  echo Startup failed. Read the error above and README_KO.md.
  if not defined GRIM_LAB_CI pause
)
exit /b %RESULT%
