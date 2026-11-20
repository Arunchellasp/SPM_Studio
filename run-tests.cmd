@echo off
rem SPM Studio: run all tests (unit, automated UI, typecheck, lint, build)
title SPM Studio tests
cd /d "%~dp0studio"
echo === 0/4 Packages (installs what git pull added) ===
call npm install --no-audit --no-fund
if not exist test-results mkdir test-results
echo.
echo === 1/4 Unit tests (Vitest) ===
call npx vitest run --reporter=default --reporter=json --outputFile.json=test-results/unit-report.json
echo.
echo === 2/4 Automated UI tests (Playwright, Chromium 1920 x 1080) ===
call npx playwright install chromium
call npx playwright test
echo.
echo === 3/4 Typecheck + lint ===
call npm run typecheck && call npm run lint && echo TYPECHECK+LINT OK> test-results\static-ok.txt
echo.
echo === 4/4 Build ===
call npm run build && echo BUILD OK> test-results\build-ok.txt
echo.
echo Reports: studio\test-results\unit-report.json and ui-report.json
pause
