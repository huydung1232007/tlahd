@echo off
cd /d "%~dp0"
node scripts/start-local.mjs --stop
if errorlevel 1 pause
