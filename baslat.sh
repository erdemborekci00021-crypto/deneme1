#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node -e 'if(Number(process.versions.node.split(".")[0])<24)throw new Error("Node.js 24 veya daha yeni surumu gerekli")'
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
if [ ! -f dist/index.html ]; then npm run build; fi
export NODE_ENV=production
printf '%s\n' 'Hazır olduğunda tarayıcıda http://localhost:3000 adresini açın.'
exec node server/index.js
