@echo off
setlocal
cd /d "%~dp0..\backend"
go run .\cmd\api
