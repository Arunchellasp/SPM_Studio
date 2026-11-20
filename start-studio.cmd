@echo off
rem SPM Studio: start the Electron app (GUI only, step 1)
title SPM Studio
cd /d "%~dp0studio"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org and run again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages, first time only...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
if not exist node_modules\electron\dist\electron.exe (
  echo Downloading the Electron program...
  node node_modules\electron\install.js
  if errorlevel 1 ( pause & exit /b 1 )
)
call npm run dev
pause
