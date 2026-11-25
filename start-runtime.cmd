@echo off
rem SPM Studio: start the C runtime spm_rt with the demo project (step 36: the studio talks to it like to the mock).
rem It listens on ws://127.0.0.1:7600 - close start-mock-runtime.cmd first (only one can have the port).
rem Close this window (or Ctrl+C) to stop it: outputs go to safe, the studio header shows OFFLINE within 3 s.
title SPM runtime spm_rt
cd /d "%~dp0"
set RT=
for %%f in (runtime\build\Release\spm_rt.exe runtime\build\spm_rt.exe runtime\build-win\spm_rt.exe) do if not defined RT if exist %%f set RT=%%f
if not defined RT (
  echo spm_rt.exe is not built yet. Build it once:
  echo   cmake -S runtime -B runtime\build
  echo   cmake --build runtime\build --config Release
  pause
  exit /b 1
)
echo %RT% projects\demo\config.json
%RT% projects\demo\config.json %*
echo spm_rt ended with exit code %errorlevel%
pause
