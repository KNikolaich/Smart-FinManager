@echo off
rem Smart-FinManager: local dev run from Windows (double-click or run from cmd).
rem Starts scripts/fin_dev.sh inside WSL, in the WSL clone ~/Smart-FinManager.
rem
rem   fin_dev.bat                   branch main, dev mode
rem   fin_dev.bat try/feature       another branch of the Windows clone
rem   fin_dev.bat --prod [branch]   production build (branch main by default)
rem
rem The app opens at http://localhost:5000. Stop it with Ctrl+C
rem (answer N to "Terminate batch job?" to keep the window open).
rem Only committed changes of the Windows clone are run.

setlocal
rem WSL folder of the clone; change it here if the clone moves.
set "WSL_APP_DIR=~/Smart-FinManager"

set "ARGS=%*"
if "%~1"=="" set "ARGS=main"
if /i "%~1"=="--prod" if "%~2"=="" set "ARGS=--prod main"

title Smart-FinManager: %ARGS%
rem -i -l: load ~/.profile and ~/.bashrc so node/npm (e.g. from nvm) are on PATH.
wsl.exe -e bash -ilc "cd %WSL_APP_DIR% && exec scripts/fin_dev.sh %ARGS%"

echo.
echo fin_dev.sh finished with exit code %ERRORLEVEL%.
pause
