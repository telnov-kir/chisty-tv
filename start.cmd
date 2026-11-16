@echo off
chcp 65001 >nul
title Chisty TV - local server
cd /d "%~dp0"
echo Starting Chisty TV local server...
echo Browser will open at http://localhost:8765
echo Keep this window open while using the app.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
echo.
echo Server stopped. If there was an error above, read its text.
pause