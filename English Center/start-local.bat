@echo off
setlocal

set "ROOT=%~dp0"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "MYSQLD_EXE=C:\xampp\mysql\bin\mysqld.exe"
set "MYSQL_INI=C:\xampp\mysql\bin\my.ini"

if not exist "%NODE_EXE%" (
  echo Node.js not found at "%NODE_EXE%".
  echo Please install Node.js LTS or update NODE_EXE in this file.
  pause
  exit /b 1
)

if not exist "%MYSQLD_EXE%" (
  echo XAMPP MySQL not found at "%MYSQLD_EXE%".
  echo Please install XAMPP or update MYSQLD_EXE in this file.
  pause
  exit /b 1
)

tasklist /FI "IMAGENAME eq mysqld.exe" | find /I "mysqld.exe" >nul
if errorlevel 1 (
  echo Starting XAMPP MySQL...
  start "English Center MySQL" /MIN "%MYSQLD_EXE%" --defaults-file="%MYSQL_INI%" --standalone
) else (
  echo MySQL is already running.
)

echo Starting English Center at http://localhost:3000/
cd /D "%ROOT%backend"
"%NODE_EXE%" server.js
