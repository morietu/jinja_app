#!/usr/bin/env bash
# End-to-end local verification of the backup/restore drill.
#
# This test does NOT touch Production. It builds a local "source" database
# that reproduces Production's known shape (users=0005, temples=0089),
# dumps it with dump_readonly.sh, restores the dump into a second isolated
# database with restore_isolated.sh (going through the same guard.py check
# a real drill would), compares the two, then applies users 0006 and
# temples 0090-0093 to the restored copy and verifies the result — exactly
# mirroring docs/audit/production-all-app-migration-state-audit.md and
# docs/audit/production-migration-0090-0093-safety.md, but chained through
# the actual dump/restore tooling instead of just `migrate`.
#
# Requires: local PostgreSQL with postgis available, backend/.venv set up.
# Safe to run repeatedly; all databases it creates are dropped at the end
# (including on failure, via the trap below).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGSAFE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MIGSAFE_DIR}/../.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
PY="${BACKEND_DIR}/.venv/bin/python"

STAMP="$(date +%Y%m%d%H%M%S)"
SOURCE_DB="jinja_migration_safety_source_${STAMP}"
RESTORE_DB="jinja_migration_safety_restore_test_${STAMP}"
DUMP_DIR="$(mktemp -d /tmp/migration_safety_dump.XXXXXX)"
DUMP_LOG="$(mktemp /tmp/migration_safety_dump_log.XXXXXX)"
RESTORE_LOG="$(mktemp /tmp/migration_safety_restore_log.XXXXXX)"

SOURCE_URL="postgres://$(whoami)@localhost:5432/${SOURCE_DB}"
RESTORE_URL="postgres://$(whoami)@localhost:5432/${RESTORE_DB}"

cleanup() {
  echo "[e2e] cleanup: dropping ${SOURCE_DB}, ${RESTORE_DB}, removing temporary files"
  dropdb --if-exists "${SOURCE_DB}" || true
  dropdb --if-exists "${RESTORE_DB}" || true
  rm -rf "${DUMP_DIR}"
  rm -f "${DUMP_LOG}" "${RESTORE_LOG}"
}
trap cleanup EXIT

export USE_GIS=1
export DEBUG=0
export SECRET_KEY="migration-safety-e2e-key-not-used-in-prod"

# The local Postgres *server* here may be newer than the default `pg_dump`/
# `psql` on PATH (this happened during development: server 18, PATH client
# 16.10). Auto-detect a version-matched Homebrew client if the default one
# would refuse to talk to the server, so this test is reproducible across
# machines without hardcoding a version.
SERVER_MAJOR="$(psql -d postgres -tAc "SHOW server_version_num" | cut -c1-2)"
if command -v brew >/dev/null 2>&1 && [ -d "/opt/homebrew/opt/postgresql@${SERVER_MAJOR}/bin" ]; then
  export PG_DUMP_BIN="/opt/homebrew/opt/postgresql@${SERVER_MAJOR}/bin/pg_dump"
  export PG_DUMPALL_BIN="/opt/homebrew/opt/postgresql@${SERVER_MAJOR}/bin/pg_dumpall"
  export PSQL_BIN="/opt/homebrew/opt/postgresql@${SERVER_MAJOR}/bin/psql"
  echo "[e2e] using version-matched client binaries from postgresql@${SERVER_MAJOR}"
fi

echo "[e2e] === guard.py negative-test sanity check (must fail) ==="
if python3 "${MIGSAFE_DIR}/guard.py" check-restore-target "postgres://user:pw@db.example.supabase.co:5432/postgres"; then
  echo "[e2e] FAIL: guard allowed a non-local host as a restore target" >&2
  exit 1
fi
echo "[e2e] guard correctly blocked a non-local restore target"

if python3 "${MIGSAFE_DIR}/guard.py" check-restore-target "postgres://$(whoami)@localhost:5432/jinja_db"; then
  echo "[e2e] FAIL: guard allowed restoring into the protected jinja_db" >&2
  exit 1
fi
echo "[e2e] guard correctly blocked the protected local dev database"

if ! python3 "${MIGSAFE_DIR}/guard.py" check-restore-target "${RESTORE_URL}"; then
  echo "[e2e] FAIL: guard blocked our own isolated restore target ${RESTORE_DB}" >&2
  exit 1
fi
echo "[e2e] guard correctly allowed the isolated restore target"

if python3 "${MIGSAFE_DIR}/guard.py" check-dump-path "${REPO_ROOT}/docs/audit/dump.sql" "${REPO_ROOT}"; then
  echo "[e2e] FAIL: guard allowed a dump path inside the repo" >&2
  exit 1
fi
echo "[e2e] guard correctly blocked an in-repo dump path"

echo "[e2e] === building source DB (${SOURCE_DB}), simulating Production shape ==="
createdb "${SOURCE_DB}"

cd "${BACKEND_DIR}"
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate contenttypes 0002 --noinput
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate auth 0012 --noinput
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate admin 0003 --noinput
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate sessions 0001 --noinput
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate token_blacklist 0013 --noinput
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate users 0005 --noinput
DATABASE_URL="${SOURCE_URL}" "${PY}" manage.py migrate temples 0089 --noinput

echo "[e2e] seeding realistic baseline data via raw SQL (bypasses the known users/apps.py signal mismatch — see docs/audit/production-all-app-migration-state-audit.md)"
psql -d "${SOURCE_DB}" <<'SQL'
INSERT INTO auth_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
VALUES ('x', NULL, false, 'e2e_user_1', '', '', 'e2e1@example.com', false, true, now());

INSERT INTO users_userprofile (nickname, is_public, bio, icon, created_at, user_id, current_period_end, stripe_customer_id, stripe_price_id, stripe_subscription_id, subscription_status, updated_at)
SELECT 'E2Eユーザー', true, 'end-to-end test bio', '', now(), id, NULL, '', '', '', 'inactive', now()
FROM auth_user WHERE username = 'e2e_user_1';
SQL

SOURCE_SNAPSHOT="$(psql -d "${SOURCE_DB}" -tAc "
SELECT (SELECT COUNT(*) FROM auth_user) || ',' || (SELECT COUNT(*) FROM users_userprofile) || ',' || (SELECT COUNT(*) FROM temples_shrine)
")"
echo "[e2e] source aggregate snapshot (auth_user,userprofile,shrine): ${SOURCE_SNAPSHOT}"

echo "[e2e] === dumping source via dump_readonly.sh ==="
"${MIGSAFE_DIR}/dump_readonly.sh" "${SOURCE_URL}" "${DUMP_DIR}" 2>&1 | tee "${DUMP_LOG}"
for token in localhost 5432 "${SOURCE_DB}"; do
  if grep -Fq "${token}" "${DUMP_LOG}"; then
    echo "[e2e] FAIL: dump tooling leaked a connection-target component" >&2
    exit 1
  fi
done
echo "[e2e] PASS: successful local dump logged no connection-target component"

echo "[e2e] === creating isolated restore target (${RESTORE_DB}) ==="
createdb "${RESTORE_DB}"

echo "[e2e] === restoring via restore_isolated.sh (guarded) ==="
"${MIGSAFE_DIR}/restore_isolated.sh" "${DUMP_DIR}" "${RESTORE_URL}" 2>&1 | tee "${RESTORE_LOG}"
for token in localhost 5432 "${RESTORE_DB}"; do
  if grep -Fq "${token}" "${RESTORE_LOG}"; then
    echo "[e2e] FAIL: restore tooling leaked a connection-target component" >&2
    exit 1
  fi
done
echo "[e2e] PASS: successful local restore logged no connection-target component"

echo "[e2e] === comparing restored DB against source snapshot ==="
RESTORE_SNAPSHOT="$(psql -d "${RESTORE_DB}" -tAc "
SELECT (SELECT COUNT(*) FROM auth_user) || ',' || (SELECT COUNT(*) FROM users_userprofile) || ',' || (SELECT COUNT(*) FROM temples_shrine)
")"
echo "[e2e] restored aggregate snapshot (auth_user,userprofile,shrine): ${RESTORE_SNAPSHOT}"

if [ "${SOURCE_SNAPSHOT}" != "${RESTORE_SNAPSHOT}" ]; then
  echo "[e2e] FAIL: source/restore aggregate mismatch (${SOURCE_SNAPSHOT} != ${RESTORE_SNAPSHOT})" >&2
  exit 1
fi
echo "[e2e] PASS: aggregate counts match"

RESTORE_MIGRATION_STATE="$(psql -d "${RESTORE_DB}" -tAc "
SELECT string_agg(app || '=' || name, ';' ORDER BY app)
FROM (SELECT DISTINCT ON (app) app, name FROM django_migrations ORDER BY app, applied DESC) t
WHERE app IN ('users','temples')
")"
echo "[e2e] restored latest migration state (users,temples): ${RESTORE_MIGRATION_STATE}"
case "${RESTORE_MIGRATION_STATE}" in
  *"temples=0089_actionevent"*"users=0005_userprofile_current_period_end_and_more"*) : ;;
  *) echo "[e2e] FAIL: restored migration state does not match expected users=0005/temples=0089" >&2; exit 1 ;;
esac
echo "[e2e] PASS: restored migration state matches users=0005/temples=0089"

echo "[e2e] === applying users 0006 + temples 0090-0093 to the RESTORED copy (never to source, never to Production) ==="
DATABASE_URL="${RESTORE_URL}" "${PY}" manage.py migrate users 0006 --noinput
DATABASE_URL="${RESTORE_URL}" "${PY}" manage.py migrate temples 0093 --noinput

POST_COLUMNS="$(psql -d "${RESTORE_DB}" -tAc "
SELECT count(*) FROM information_schema.columns
WHERE table_name='users_userprofile' AND column_name IN ('birthday','birth_time','birth_place','worship_style')
")"
POST_TABLES="$(psql -d "${RESTORE_DB}" -tAc "
SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN
('temples_shrineknowledgesource','temples_shrinedeity','temples_shrinehistory','temples_shrinedeity_sources','temples_shrinehistory_sources')
")"
POST_SNAPSHOT="$(psql -d "${RESTORE_DB}" -tAc "
SELECT (SELECT COUNT(*) FROM auth_user) || ',' || (SELECT COUNT(*) FROM users_userprofile) || ',' || (SELECT COUNT(*) FROM temples_shrine)
")"

echo "[e2e] post-migration: new UserProfile columns=${POST_COLUMNS} (expect 4), new Knowledge tables=${POST_TABLES} (expect 5), aggregate=${POST_SNAPSHOT}"

if [ "${POST_COLUMNS// /}" != "4" ] || [ "${POST_TABLES// /}" != "5" ] || [ "${POST_SNAPSHOT}" != "${SOURCE_SNAPSHOT}" ]; then
  echo "[e2e] FAIL: post-migration verification did not match expected values" >&2
  exit 1
fi
echo "[e2e] PASS: post-migration schema and data verification succeeded on the restored (never-Production) copy"

echo "[e2e] === rollback check on the restored copy ==="
DATABASE_URL="${RESTORE_URL}" "${PY}" manage.py migrate temples 0089 --noinput
DATABASE_URL="${RESTORE_URL}" "${PY}" manage.py migrate users 0005 --noinput
echo "[e2e] PASS: rollback to 0089/0005 succeeded on the restored copy"

echo ""
echo "[e2e] ==================================================="
echo "[e2e] ALL CHECKS PASSED. Production was never touched."
echo "[e2e] ==================================================="
