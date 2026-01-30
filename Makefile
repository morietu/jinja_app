SHELL := /usr/bin/env bash

# ===== Python / Django =====
PY ?= python
PYTHONPATH ?= backend
export PYTHONPATH := $(PYTHONPATH)

export DJANGO_SETTINGS_MODULE := shrine_project.settings

# ===== DB (local) =====
DB_NAME ?= jinja_db
DB_USER ?= admin
DB_HOST ?= 127.0.0.1
DB_PORT ?= 5432

# ===== Postgres shortcut =====
# PG_MODE=docker (default) or PG_MODE=local
PG_MODE ?= docker

PG_DOCKER := docker compose exec -T db bash -lc 'export PGPASSWORD="$$POSTGRES_PASSWORD"; psql -v ON_ERROR_STOP=1 -h localhost -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
PG_LOCAL  := psql -v ON_ERROR_STOP=1 -h $(DB_HOST) -U $(DB_USER) -d $(DB_NAME)

ifeq ($(PG_MODE),local)
  PG := $(PG_LOCAL)
else
  PG := $(PG_DOCKER)
endif

# ===== PyTest shortcuts =====
PYTEST := PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
	pytest -q -s \
	  -p pytest_django.plugin \
	  -p requests_mock.contrib._pytest_plugin \
	  --ds=shrine_project.settings \
	  --reuse-db

# ===== Representative seed =====
SEED_YAML    := backend/temples/seed/representative_shrines.yaml
SEED_FIXTURE := backend/temples/fixtures/shrines_representative.json
SEED_PK_MIN  := 100001
SEED_PK_MAX  := 200000

.PHONY: help \
	shrine-count test-unique-loc test-unique-null test-unique-clean \
	test test-k unit spectacular lint fmt \
	db-create migrate migrate-only env-nogis db-drop-test test-nogis \
	seed-representative seed-representative-gen seed-representative-clean seed-representative-load seed-representative-backfill \
	seed-representative-check seed-representative-list \
	pr-create pr-status pr-open pr-edit-base

help:
	@echo "make shrine-count              # 神社件数"
	@echo "make test-unique-loc           # 同一(name,address,location)の重複テスト"
	@echo "make test-unique-null          # location NULL時の重複テスト"
	@echo "make test-unique-clean         # テストデータ削除"
	@echo ""
	@echo "make migrate                   # DB作成(必要なら) -> migrate"
	@echo "make migrate-only              # migrateのみ（DB作成しない）"
	@echo ""
	@echo "make seed-representative       # seed生成→clean→loaddata→backfill"
	@echo "  PG_MODE=docker|local         # DBの実行先切替（既定 docker）"
	@echo "make seed-representative-check # 代表枠の件数+サンプル確認"
	@echo "make seed-representative-list  # 代表枠一覧"
	@echo ""
	@echo "make test                      # pytest"
	@echo "make test-k PATTERN=...         # pytest -k フィルタ実行"
	@echo ""
	@echo "make pr-create                 # 現在ブランチからPR作成（base=develop既定）"
	@echo "make pr-status                 # 現在ブランチのPR状況を表示"
	@echo "make pr-open                   # PRをブラウザで開く"
	@echo "make pr-edit-base PR=123 [PR_BASE=develop]  # 既存PRのベースを変更"

shrine-count:
	@$(PG) -c "SELECT COUNT(*) FROM temples_shrine;"

test-unique-loc:
	@$(PG) <<'SQL'
	INSERT INTO temples_shrine (name_jp,address,latitude,longitude,location,created_at,updated_at,views_30d,favorites_30d,popular_score)
	VALUES ($$重複テスト神社-LOC$$,$$テスト住所$$,35.0001,135.0001,ST_SetSRID(ST_MakePoint(135.0001,35.0001),4326),now(),now(),0,0,0);
	INSERT INTO temples_shrine (name_jp,address,latitude,longitude,location,created_at,updated_at,views_30d,favorites_30d,popular_score)
	VALUES ($$重複テスト神社-LOC$$,$$テスト住所$$,35.0001,135.0001,ST_SetSRID(ST_MakePoint(135.0001,35.0001),4326),now(),now(),0,0,0);
	SQL

test-unique-null:
	@$(PG) <<'SQL'
	INSERT INTO temples_shrine (name_jp,address,created_at,updated_at,views_30d,favorites_30d,popular_score)
	VALUES ($$重複テスト神社-NULL$$,$$テスト住所$$,now(),now(),0,0,0);
	INSERT INTO temples_shrine (name_jp,address,created_at,updated_at,views_30d,favorites_30d,popular_score)
	VALUES ($$重複テスト神社-NULL$$,$$テスト住所$$,now(),now(),0,0,0);
	SQL

test-unique-clean:
	@$(PG) -c "DELETE FROM temples_shrine WHERE name_jp LIKE '重複テスト神社%';"

test:
	$(PY) -m pytest -q

PATTERN ?=
test-k:
	@$(PYTEST) -k '$(PATTERN)'

unit:
	GOOGLE_PLACES_API_KEY=$${GOOGLE_PLACES_API_KEY:-dummy} \
	GOOGLE_MAPS_API_KEY=$${GOOGLE_MAPS_API_KEY:-dummy} \
	$(PY) -m pytest -q

spectacular:
	GOOGLE_PLACES_API_KEY=$${GOOGLE_PLACES_API_KEY:-dummy} \
	GOOGLE_MAPS_API_KEY=$${GOOGLE_MAPS_API_KEY:-dummy} \
	PYTHONPATH=$(PYTHONPATH) $(PY) backend/manage.py spectacular --file api_schema.yaml

lint:
	ruff check .

fmt:
	ruff check --fix .
	black .

# ===== DB tasks =====
db-create:
	psql -h $(DB_HOST) -U $(DB_USER) -tc "SELECT 1 FROM pg_database WHERE datname='$(DB_NAME)'" | grep -q 1 || \
	psql -h $(DB_HOST) -U $(DB_USER) -c "CREATE DATABASE $(DB_NAME)"

migrate: db-create
	$(PY) -m django migrate

migrate-only:
	$(PY) -m django migrate

env-nogis:
	@unset DATABASE_URL; \
	export USE_GIS=0 DISABLE_GIS_FOR_TESTS=1 PYTHONPATH=backend DJANGO_SETTINGS_MODULE=shrine_project.settings; \
	$(PY) -m django check

db-drop-test:
	psql -h 127.0.0.1 -U admin -d postgres -c "DROP DATABASE IF EXISTS test_jinja_db;"

test-nogis: db-drop-test
	USE_GIS=0 DISABLE_GIS_FOR_TESTS=1 PYTHONPATH=backend DJANGO_SETTINGS_MODULE=shrine_project.settings \
	pytest -q

# ===== Representative seed =====
seed-representative: seed-representative-gen seed-representative-clean seed-representative-load seed-representative-backfill

seed-representative-gen:
	@set -euo pipefail; \
	$(PY) backend/scripts/generate_shrines_fixture.py --seed $(SEED_YAML) --out $(SEED_FIXTURE)

seed-representative-clean:
	@set -euo pipefail; \
	$(PG) -c "DELETE FROM temples_shrine_goriyaku_tags WHERE shrine_id IN (SELECT id FROM temples_shrine WHERE id >= $(SEED_PK_MIN) AND id < $(SEED_PK_MAX));"; \
	$(PG) -c "DELETE FROM temples_shrine WHERE id >= $(SEED_PK_MIN) AND id < $(SEED_PK_MAX);"

seed-representative-load:
	@set -euo pipefail; \
	$(PY) -m django loaddata $(SEED_FIXTURE)

seed-representative-backfill:
	@set -euo pipefail; \
	$(PY) -m django backfill_goriyaku_tags

seed-representative-check:
	@set -euo pipefail; \
	$(PY) -m django shell -c "from temples.models import Shrine; \
qs=Shrine.objects.filter(id__gte=$(SEED_PK_MIN), id__lt=$(SEED_PK_MAX)).order_by('id'); \
print('representative shrines=', qs.count()); \
s=qs.first(); \
print('sample=', s.id, s.name_jp, s.goriyaku, [t.name for t in s.goriyaku_tags.all()])"

seed-representative-list:
	@set -euo pipefail; \
	$(PY) -m django shell -c "from temples.models import Shrine; \
qs=Shrine.objects.filter(id__gte=$(SEED_PK_MIN), id__lt=$(SEED_PK_MAX)).order_by('id'); \
[print(s.id, s.name_jp, s.goriyaku, [t.name for t in s.goriyaku_tags.all()]) for s in qs]"

# ===== GitHub PR utilities =====
GH ?= gh
PR_BASE ?= develop
PR_BODY ?= .github/pr/default.md
PR_TITLE ?= feat: update
HEAD_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)

pr-create:
	@command -v $(GH) >/dev/null 2>&1 || { echo "ERROR: gh (GitHub CLI) が必要です"; exit 1; }
	@echo "Creating PR: head=$(HEAD_BRANCH) base=$(PR_BASE)"
	@if [ -f "$(PR_BODY)" ]; then \
		$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) --title "$(PR_TITLE)" --body-file "$(PR_BODY)"; \
	else \
		$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) --title "$(PR_TITLE)" --body "$(PR_TITLE)"; \
	fi

pr-status:
	@$(GH) pr list --head $(HEAD_BRANCH) --state open --json number,url,baseRefName \
		| jq -r '.[] | "PR #\(.number)  base=\(.baseRefName)  \(.url)"' || $(GH) pr list --head $(HEAD_BRANCH)

pr-open:
	@$(GH) pr view --web || $(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH)

pr-edit-base:
	@if [ -z "$(PR)" ]; then echo "Usage: make pr-edit-base PR=<number> [PR_BASE=develop]"; exit 1; fi
	@$(GH) pr edit $(PR) --base $(PR_BASE)
	@$(GH) pr view $(PR) --json url,baseRefName | jq || true


# ===== Auth / Users =====
.PHONY: auth-users auth-reset-pass

AUTH_USER ?=
AUTH_PASS ?=

# 例: make auth-users
auth-users:
	@set -euo pipefail; \
	$(PY) -m django shell -c "from django.contrib.auth import get_user_model; \
U=get_user_model(); \
print([(u.id, u.username, u.is_active, u.is_staff, u.is_superuser) for u in U.objects.order_by('id')]);"

# 例: make auth-reset-pass AUTH_USER=etsuko AUTH_PASS=testpass
auth-reset-pass:
	@set -euo pipefail; \
	test -n "$(AUTH_USER)" || (echo "ERROR: AUTH_USER is required (e.g. make auth-reset-pass AUTH_USER=etsuko AUTH_PASS=testpass)"; exit 1); \
	test -n "$(AUTH_PASS)" || (echo "ERROR: AUTH_PASS is required (e.g. make auth-reset-pass AUTH_USER=etsuko AUTH_PASS=testpass)"; exit 1); \
	$(PY) -m django shell -c "from django.contrib.auth import get_user_model; \
U=get_user_model(); \
u=U.objects.get(username='$(AUTH_USER)'); \
u.set_password('$(AUTH_PASS)'); \
u.is_active=True; \
u.save(); \
print('reset ok', u.id, u.username, 'active=', u.is_active);"
