@echo off
setlocal
if exist "%~dp0..\.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~dp0..\.env") do (
    if not "%%A"=="" call :set_env %%A "%%B"
  )
)
if not defined DATABASE_URL if defined POSTGRES_USER if defined POSTGRES_PASSWORD if defined POSTGRES_DB (
  if not defined POSTGRES_PORT set "POSTGRES_PORT=5432"
  set "DATABASE_URL=host=127.0.0.1 port=%POSTGRES_PORT% user=%POSTGRES_USER% password=%POSTGRES_PASSWORD% dbname=%POSTGRES_DB% sslmode=disable"
)
cd /d "%~dp0..\backend"
go run .\cmd\api
exit /b

:set_env
set "%~1=%~2"
exit /b
