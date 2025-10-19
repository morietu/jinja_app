#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-staging}"
echo "[deploy] start: env=${ENV}"

# ここに実デプロイ手順を書く（例）
# ./scripts/build.sh
# ./scripts/migrate.sh
# ./scripts/rsync_or_ssh.sh "${ENV}"

echo "[deploy] done"
