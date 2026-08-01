@echo off
rem ============================================================================
rem  X4 Forge API — SUPERVISED (2026-07-09 stability fix)
rem  Runs the API dev watcher in a self-healing loop: if the tsx watch process
rem  ever dies (the crash class that forced manual restarts), it relaunches
rem  automatically after 2 seconds. Exits only when you close the window.
rem  Restart history is appended to supervisor.log (ignored by the watcher).
rem ============================================================================
cd /d "%~dp0"
set API_ONLY=true
set PORT=3001
rem Explicit local-dev opt-in for the authenticated host-tool command routes.
rem Bare npm/node launches remain default-closed.
set "FORGE_ALLOW_RUN_COMMAND=true"

:loop
echo [supervisor] starting API watcher (%date% %time%)
call npm run dev:api
echo [supervisor] API watcher exited (%date% %time%) - restarting in 2s >> supervisor.log
echo [supervisor] API watcher exited - restarting in 2 seconds (close this window to stop)
timeout /t 2 /nobreak >nul
goto loop
