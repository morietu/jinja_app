#!/usr/bin/env bash
set -euo pipefail
echo "==> Enabling PostGIS on ${POSTGRES_DB} and template1 ..."
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql --username "$POSTGRES_USER" --dbname template1      -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
echo "==> Done."
