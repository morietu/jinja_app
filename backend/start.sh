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
