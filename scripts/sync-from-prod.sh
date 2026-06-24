#!/usr/bin/env bash
# Скачать код + SQLite с прод-сервера на локальную машину.
# Использование:
#   SSH_ASKPASS=/path/to/askpass.sh SSH_ASKPASS_REQUIRE=force DISPLAY=:0 bash scripts/sync-from-prod.sh
set -euo pipefail

HOST="${PROD_HOST:-root@159.194.212.11}"
REMOTE_DIR="${PROD_DIR:-/var/www/bigwinzone}"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Sync from ${HOST}:${REMOTE_DIR} -> ${LOCAL_DIR}"

ssh -o StrictHostKeyChecking=no "${HOST}" "cd ${REMOTE_DIR} && git rev-parse HEAD && git branch --show-current"

echo "==> Rsync app code (excluding node_modules, .next, books binaries)"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude 'games/xboot/books-v2/*.bin' \
  --exclude '.git' \
  "${HOST}:${REMOTE_DIR}/" "${LOCAL_DIR}/"

echo "==> Download production SQLite database"
rsync -avz "${HOST}:${REMOTE_DIR}/prisma/dev.db" "${LOCAL_DIR}/prisma/prod-dev.db" || \
rsync -avz "${HOST}:${REMOTE_DIR}/prisma/*.db" "${LOCAL_DIR}/prisma/" || true

if [[ -f "${LOCAL_DIR}/prisma/prod-dev.db" ]]; then
  cp "${LOCAL_DIR}/prisma/prod-dev.db" "${LOCAL_DIR}/prisma/dev.db"
  echo "==> Replaced prisma/dev.db with production copy"
fi

echo "==> Local .env (keep localhost URLs)"
cat > "${LOCAL_DIR}/.env" <<'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="local-dev-jwt-secret-change-me-8bc8"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SITE_URL="http://localhost:3000"
YOOMONEY_WALLET=""
YOOMONEY_SECRET=""
EOF

echo "==> npm install + prisma generate"
cd "${LOCAL_DIR}"
npm install
npx prisma generate

echo "==> Done. Restart: npm run dev, npm run books-server, npm run xboot-books-server"
