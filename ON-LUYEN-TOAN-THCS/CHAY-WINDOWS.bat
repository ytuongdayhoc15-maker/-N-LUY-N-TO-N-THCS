@echo off
chcp 65001 >nul
title HE THONG ON LUYEN TOAN THCS - Lop 6-9
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ============================================================
  echo   CHUA CAI DAT NODE.JS TREN MAY TINH NAY
  echo ============================================================
  echo Vui long cai dat Node.js phien ban LTS tai: https://nodejs.org/
  echo Sau khi cai dat xong, hay mo lai file CHAY-WINDOWS.bat nay.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if "%NODE_MAJOR%"=="" set NODE_MAJOR=20
if %NODE_MAJOR% LSS 18 (
  echo Phien ban Node.js hien tai qua cu. Vui long cap nhat Node.js LTS (>= 18).
  pause
  exit /b 1
)

echo ============================================================
echo   HE THONG ON LUYEN TOAN THCS (LOP 6 - 9)
echo ============================================================
echo   [1] Chay cuc bo tren may nay (Mac dinh - 127.0.0.1)
echo   [2] Chay mang LAN cho phong hoc (Cac may cung Wi-Fi truy cap)
echo ============================================================
choice /C 12 /T 4 /D 1 /N /M "Chon che do (tu dong chon [1] sau 4 giay): "

if errorlevel 2 (
  echo Dang khoi dong may chu o che do mang LAN noi bo...
  node "%~dp0on-luyen-toan-thcs.mjs" --lan
) else (
  echo Dang khoi dong website cuc bo...
  node "%~dp0on-luyen-toan-thcs.mjs"
)

echo.
echo Website da dung hoac gap su co.
pause
