@echo off
setlocal
cd /d "%~dp0..\frontend"
"C:\Program Files\nodejs\node.exe" "%CD%\node_modules\next\dist\bin\next" dev
