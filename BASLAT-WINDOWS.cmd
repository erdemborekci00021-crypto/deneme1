@echo off
cd /d "%~dp0"
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Node.js 24 veya daha yeni surumu kurun: nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
set NODE_ENV=production
echo Hazir oldugunda tarayicida http://localhost:3000 adresini acin.
node server/index.js
pause
