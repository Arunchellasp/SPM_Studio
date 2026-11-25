@echo off
rem SPM Studio: start the MOCK runtime (stands in for the C runtime, step 31).
rem Close this window to stop it: the studio header shows OFFLINE within 3 s.
title SPM mock runtime
cd /d "%~dp0studio"
if not exist node_modules (
  echo Run start-studio.cmd once first: it installs the packages.
  pause
  exit /b 1
)
call npm run mock-runtime
pause
