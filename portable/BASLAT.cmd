@echo off
cd /d "%~dp0"
if not exist runtime\node.exe (
  echo ZIP dosyasini tamamen bir klasore cikarin. ZIP icinden calistirmayin.
  pause
  exit /b 1
)
echo Atolye aciliyor. Bu pencereyi uygulamayi kullanirken acik birakin.
runtime\node.exe launcher.js
if errorlevel 1 (
  echo Uygulama acilamadi. Yukaridaki hata mesajini paylasin.
  pause
)
