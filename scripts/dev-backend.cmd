@echo off
setlocal enabledelayedexpansion
if exist "%~dp0..\.env" (
  for /f "usebackq eol=# tokens=1* delims==" %%A in ("%~dp0..\.env") do (
    if not "%%A"=="" (
      set "key=%%A"
      set "val=%%B"
      for /f "delims=" %%C in ("!val!") do set "!key!=%%C"
    )
  )
)
cd /d "%~dp0..\backend"
go run .\cmd\api
