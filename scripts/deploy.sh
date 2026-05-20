#!/usr/bin/env bash
# Быстрый деплой на VPS (Ubuntu). Запуск: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bigwinzone}"
BRANCH="${BRANCH:-main}"

echo "==> Deploy: ${APP_DIR} (branch ${BRANCH})"
cd "${APP_DIR}"

echo "==> git pull"
git fetch origin
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

if command -v git-lfs >/dev/null 2>&1; then
  echo "==> git lfs pull"
  git lfs pull
fi

echo "==> npm ci"
npm ci

echo "==> prisma migrate"
npx prisma migrate deploy

echo "==> build"
export NODE_ENV=production
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
npm run build

echo "==> pm2 restart"
if pm2 describe books-server >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> Done. Check: pm2 status && curl -I http://127.0.0.1:3000"
