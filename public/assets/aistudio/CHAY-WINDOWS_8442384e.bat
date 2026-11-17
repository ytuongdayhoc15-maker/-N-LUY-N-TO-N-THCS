@echo off
chcp 65001 >nul
title ON LUYEN TOAN THCS - Lop 6-9
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo CHUA CO NODE.JS - Cai Node.js LTS tai https://nodejs.org/
  echo Sau khi cai, hay mo lai file CHAY-WINDOWS.bat
  pause
  exit /b 1
)
echo Dang khoi dong website...
node "%~dp0on-luyen-toan-thcs.mjs"
echo.
echo Website da dung hoac gap loi.
pause
