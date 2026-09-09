#!/usr/bin/env bash
set -e

export PORT="${PORT:-10000}"
export WEB_CONCURRENCY="${WEB_CONCURRENCY:-1}"

echo "=== Render startup ==="
echo "PWD=$(pwd)"
echo "PORT=${PORT}"
echo "WEB_CONCURRENCY=${WEB_CONCURRENCY}"
echo "DATABASE_URL_SET=$([ -n "${DATABASE_URL:-}" ] && echo 1 || echo 0)"
echo "ALLOWED_HOSTS=${ALLOWED_HOSTS:-unset}"
echo "RENDER_EXTERNAL_HOSTNAME=${RENDER_EXTERNAL_HOSTNAME:-unset}"
echo "USE_GIS=${USE_GIS:-unset}"
echo "USE_SQLITE=${USE_SQLITE:-unset}"

# --- Diagnostics: Production migration divergence investigation (temples
# 0079-0089) -----------------------------------------------------------------
# Read-only, best-effort logging only: no DB write, no migration execution,
# no repair/bootstrap action. Runs unconditionally, before the migration
# execution decision and before gunicorn starts, on every startup regardless
# of RUN_MIGRATIONS_ON_START. The whole block is grouped as the left side of
# `||` so a failure of any single command inside it (missing directory,
# manage.py error, etc.) cannot trigger `set -e` and cannot abort startup.
echo "=== migration divergence diagnostics (temples 0079-0089) ==="
{
  echo "RENDER_GIT_COMMIT=${RENDER_GIT_COMMIT:-unset}"
  echo "--- temples/migrations file listing (0079-0089) ---"
  ls -1 temples/migrations 2>&1 | grep -E '^00(79|8[0-9])_' || true
  echo "--- python/django migration module resolution diagnostics ---"
  if resolution_output=$(python manage.py shell -c "import os, sys; from pprint import pformat; from django.apps import apps; from django.conf import settings; import temples; import temples.migrations; from django.db.migrations.loader import MigrationLoader; print('DJANGO_SETTINGS_MODULE=' + os.environ.get('DJANGO_SETTINGS_MODULE', 'unset')); print('settings.MIGRATION_MODULES=' + repr(getattr(settings, 'MIGRATION_MODULES', None))); print('temples.__file__=' + str(getattr(temples, '__file__', None))); app_config = apps.get_app_config('temples'); print('temples AppConfig path=' + str(getattr(app_config, 'path', None))); print('temples.migrations.__file__=' + str(getattr(temples.migrations, '__file__', None))); print('temples.migrations.__path__=' + str(getattr(temples.migrations, '__path__', None))); print('sys.path=' + pformat(sys.path)); loader = MigrationLoader(None, ignore_no_migrations=True); disk = loader.disk_migrations.get('temples', {}); names = sorted(disk.keys()) if isinstance(disk, dict) else sorted(str(item) for item in disk); print('MigrationLoader.disk_migrations[temples]=' + repr(names));" 2>&1); then
    echo "${resolution_output}"
  else
    resolution_exit=$?
    echo "Django migration module resolution diagnostics FAILED (exit=${resolution_exit}); full stdout/stderr below:"
    echo "${resolution_output}"
  fi
  echo "--- showmigrations temples (0079-0089) ---"
  if showmigrations_output=$(python manage.py showmigrations temples 2>&1); then
    echo "${showmigrations_output}"
  else
    showmigrations_exit=$?
    echo "showmigrations temples FAILED (exit=${showmigrations_exit}); full stdout/stderr below:"
    echo "${showmigrations_output}"
  fi
} || echo "migration divergence diagnostics failed; continuing startup"
echo "=== end migration divergence diagnostics ==="

# --- Visit Style Production audit (read-only, opt-in, fail closed) ---------
# Runs the Visit-Style-only sync command in its DEFAULT DRY RUN mode: no
# --apply, no --expected-* locks, so it cannot write. It reports PRESERVE
# before/after, planned_updates, source_seed_sha256 and snapshot_sha256 to the
# Render logs, which is exactly the input the Mother Ship Apply Gate needs.
# Deliberately NOT import_shrines_seed: that dry-run reports full-payload drift
# (goriyaku / latitude / longitude) and so does not answer "how far is
# Production's visit_style_tags from the canonical Base Seed?".
# The same gate doubles as the post-sync check: planned_updates=0 is success.
if [ "${RUN_VISIT_STYLE_AUDIT_ON_START:-0}" = "1" ]; then
  if [ "${RUN_MIGRATIONS_ON_START:-0}" = "1" ] || [ "${RUN_SHRINE_REFLECTION_REPAIR:-0}" = "1" ] || [ "${RUN_FAVORITE_REPAIR_ON_START:-0}" = "1" ] || [ "${RUN_FEATUREUSAGE_REPAIR_ON_START:-0}" = "1" ] || [ "${RUN_BOOTSTRAP_ON_START:-0}" = "1" ] || [ "${RUN_VISIT_STYLE_SYNC_ON_START:-0}" = "1" ] || [ "${RUN_VISIT_STYLE_ROLLBACK_ON_START:-0}" = "1" ]; then
    echo "ERROR: RUN_VISIT_STYLE_AUDIT_ON_START requires all write-capable startup flags to be disabled."
    exit 1
  fi
  echo "Auditing Production visit_style_tags against canonical Base Seed because RUN_VISIT_STYLE_AUDIT_ON_START=1 (dry-run only)..."
  # A read-only audit must never take the service down. `set -e` is suspended
  # inside an `if` condition, so a non-zero exit here is reported and startup
  # continues to gunicorn. The completed message is emitted only on success, so
  # a green log line always means the audit really ran.
  if python manage.py sync_visit_style_tags_from_seed; then
    echo "Visit style Production dry-run audit completed."
  else
    visit_style_audit_exit=$?
    echo "ERROR: Visit style Production dry-run audit failed (exit=${visit_style_audit_exit}); no row was written and startup continues."
  fi
else
  echo "Skipping Visit Style Production audit. Set RUN_VISIT_STYLE_AUDIT_ON_START=1 to run it explicitly."
fi

# --- Visit Style Production sync (write, opt-in, fail closed) ---------------
# Writes ONLY Shrine.visit_style_tags. Deliberately NOT import_shrines_seed:
# Production carries non-Visit-Style drift (goriyaku / latitude / longitude)
# that the importer would rewrite in the same transaction.
# Mutually exclusive with the audit, the rollback, and every write-capable
# startup flag, and placed before migrations / repairs / bootstrap so a
# misconfiguration fails closed before anything else can write.
if [ "${RUN_VISIT_STYLE_SYNC_ON_START:-0}" = "1" ]; then
  if [ "${RUN_VISIT_STYLE_AUDIT_ON_START:-0}" = "1" ] || [ "${RUN_VISIT_STYLE_ROLLBACK_ON_START:-0}" = "1" ] || [ "${RUN_MIGRATIONS_ON_START:-0}" = "1" ] || [ "${RUN_SHRINE_REFLECTION_REPAIR:-0}" = "1" ] || [ "${RUN_FAVORITE_REPAIR_ON_START:-0}" = "1" ] || [ "${RUN_FEATUREUSAGE_REPAIR_ON_START:-0}" = "1" ] || [ "${RUN_BOOTSTRAP_ON_START:-0}" = "1" ]; then
    echo "ERROR: RUN_VISIT_STYLE_SYNC_ON_START requires the audit, the rollback and all write-capable startup flags to be disabled."
    exit 1
  fi
  if [ -z "${VISIT_STYLE_SYNC_EXPECTED_UPDATES:-}" ] || [ -z "${VISIT_STYLE_SYNC_EXPECTED_SEED_SHA256:-}" ] || [ -z "${VISIT_STYLE_SYNC_EXPECTED_SNAPSHOT_SHA256:-}" ]; then
    echo "ERROR: RUN_VISIT_STYLE_SYNC_ON_START requires VISIT_STYLE_SYNC_EXPECTED_UPDATES, VISIT_STYLE_SYNC_EXPECTED_SEED_SHA256 and VISIT_STYLE_SYNC_EXPECTED_SNAPSHOT_SHA256."
    exit 1
  fi
  echo "Syncing Shrine.visit_style_tags from the canonical Base Seed because RUN_VISIT_STYLE_SYNC_ON_START=1..."
  python manage.py sync_visit_style_tags_from_seed --apply --expected-updates "${VISIT_STYLE_SYNC_EXPECTED_UPDATES}" --expected-seed-sha256 "${VISIT_STYLE_SYNC_EXPECTED_SEED_SHA256}" --expected-snapshot-sha256 "${VISIT_STYLE_SYNC_EXPECTED_SNAPSHOT_SHA256}"
  echo "Visit style Production sync completed."
else
  echo "Skipping Visit Style Production sync. Set RUN_VISIT_STYLE_SYNC_ON_START=1 to run it explicitly."
fi

# --- Visit Style Production rollback (write, opt-in, fail closed) -----------
# Restores Shrine.visit_style_tags to a preservation snapshot's `before`
# values. The command itself refuses to run unless every row still carries the
# snapshot's `after`, so a stale snapshot cannot clobber a later edit.
if [ "${RUN_VISIT_STYLE_ROLLBACK_ON_START:-0}" = "1" ]; then
  if [ "${RUN_VISIT_STYLE_AUDIT_ON_START:-0}" = "1" ] || [ "${RUN_VISIT_STYLE_SYNC_ON_START:-0}" = "1" ] || [ "${RUN_MIGRATIONS_ON_START:-0}" = "1" ] || [ "${RUN_SHRINE_REFLECTION_REPAIR:-0}" = "1" ] || [ "${RUN_FAVORITE_REPAIR_ON_START:-0}" = "1" ] || [ "${RUN_FEATUREUSAGE_REPAIR_ON_START:-0}" = "1" ] || [ "${RUN_BOOTSTRAP_ON_START:-0}" = "1" ]; then
    echo "ERROR: RUN_VISIT_STYLE_ROLLBACK_ON_START requires the audit, the sync and all write-capable startup flags to be disabled."
    exit 1
  fi
  if [ -z "${VISIT_STYLE_ROLLBACK_SNAPSHOT:-}" ] || [ -z "${VISIT_STYLE_ROLLBACK_EXPECTED_SNAPSHOT_SHA256:-}" ]; then
    echo "ERROR: RUN_VISIT_STYLE_ROLLBACK_ON_START requires VISIT_STYLE_ROLLBACK_SNAPSHOT and VISIT_STYLE_ROLLBACK_EXPECTED_SNAPSHOT_SHA256."
    exit 1
  fi
  echo "Restoring Shrine.visit_style_tags from snapshot because RUN_VISIT_STYLE_ROLLBACK_ON_START=1..."
  python manage.py restore_visit_style_tags_snapshot --snapshot "${VISIT_STYLE_ROLLBACK_SNAPSHOT}" --apply --expected-snapshot-sha256 "${VISIT_STYLE_ROLLBACK_EXPECTED_SNAPSHOT_SHA256}"
  echo "Visit style Production rollback completed."
else
  echo "Skipping Visit Style Production rollback. Set RUN_VISIT_STYLE_ROLLBACK_ON_START=1 to run it explicitly."
fi

if [ "${RUN_STARTUP_CHECK:-0}" = "1" ]; then
  echo "Running startup system check because RUN_STARTUP_CHECK=1..."
  python manage.py check
fi

if [ "${RUN_MIGRATIONS_ON_START:-0}" = "1" ]; then
  echo "Running migrations because RUN_MIGRATIONS_ON_START=1..."
  python manage.py migrate --noinput
else
  echo "Skipping migrations. Set RUN_MIGRATIONS_ON_START=1 to run them on startup."
fi

if [ "${RUN_SHRINE_REFLECTION_REPAIR:-0}" = "1" ]; then
  echo "Ensuring ShrineReflection table exists because RUN_SHRINE_REFLECTION_REPAIR=1..."
  python manage.py shell <<'PY'
from django.db import connection
from temples.models import ShrineReflection

table_name = ShrineReflection._meta.db_table
exists = table_name in connection.introspection.table_names()
print("HAS ShrineReflection table after migrate=", exists, "table=", table_name)

if not exists:
    print("Creating missing ShrineReflection table via schema_editor because migration state and DB schema are inconsistent")
    with connection.schema_editor() as schema_editor:
        schema_editor.create_model(ShrineReflection)
    print("Created ShrineReflection table")

print("HAS ShrineReflection table final=", table_name in connection.introspection.table_names())
PY
else
  echo "Skipping ShrineReflection repair. Set RUN_SHRINE_REFLECTION_REPAIR=1 to run it explicitly."
fi

if [ "${RUN_FAVORITE_REPAIR_ON_START:-0}" = "1" ]; then
  echo "Repairing Favorite table because RUN_FAVORITE_REPAIR_ON_START=1..."
  python manage.py repair_favorite_table || echo "repair_favorite_table failed; continue startup"
else
  echo "Skipping Favorite table repair. Set RUN_FAVORITE_REPAIR_ON_START=1 to run it explicitly."
fi

if [ "${RUN_FEATUREUSAGE_REPAIR_ON_START:-0}" = "1" ]; then
  echo "Repairing FeatureUsage table because RUN_FEATUREUSAGE_REPAIR_ON_START=1..."
  python manage.py repair_featureusage_table
  echo "FeatureUsage repair completed."
else
  echo "Skipping FeatureUsage repair. Set RUN_FEATUREUSAGE_REPAIR_ON_START=1 to run it explicitly."
fi

if [ "${RUN_BOOTSTRAP_ON_START:-0}" = "1" ]; then
  if python manage.py showmigrations temples | grep -q "\[X\] 0083"; then
    echo "Bootstrapping production data because RUN_BOOTSTRAP_ON_START=1..."
    python manage.py bootstrap_production_data
  else
    echo "Bootstrap migration is not applied. Falling back to direct seed/backfill because RUN_BOOTSTRAP_ON_START=1..."
    python manage.py import_shrines_seed
    python manage.py backfill_goriyaku_tags --force
  fi
else
  echo "Skipping production data bootstrap. Set RUN_BOOTSTRAP_ON_START=1 to run it explicitly."
fi

echo "Starting gunicorn on 0.0.0.0:${PORT}..."
exec gunicorn shrine_project.wsgi:application --bind "0.0.0.0:${PORT}" --workers "${WEB_CONCURRENCY}" --timeout 120 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - --capture-output
