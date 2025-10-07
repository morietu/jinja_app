# ===== 共通（Postgres実行ショートカット） =====

PG := docker compose exec db bash -lc 'export PGPASSWORD="$$POSTGRES_PASSWORD"; psql -v ON_ERROR_STOP=1 -h localhost -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
.PHONY: help shrine-count test-unique-loc test-unique-null test-unique-clean
GH ?= gh
PR_BASE ?= develop
PR_BODY ?= .github/pr/default.md
PR_TITLE ?= feat: update
HEAD_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)


help:
	@echo "make shrine-count       # 神社件数"
	@echo "make test-unique-loc    # 同一(name,address,location)の重複テスト"
	@echo "make test-unique-null   # location NULL時の重複テスト"
	@echo "make test-unique-clean  # テストデータ削除"
	@echo ""
	@echo "make pr-create          # 現在のブランチから develop ベースでPR作成"
	@echo "make pr-status          # 現在のブランチのPR状況を表示"
	@echo "make pr-open            # 現在のブランチのPRをブラウザで開く"
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


# ===== GitHub PR ユーティリティ =====
.PHONY: pr-create pr-status pr-open pr-edit-base

# 現在のブランチ → PR作成（ベースは develop が既定）
pr-create:
	@command -v $(GH) >/dev/null 2>&1 || { echo "ERROR: gh (GitHub CLI) が必要です"; exit 1; }
	@echo "Creating PR: head=$(HEAD_BRANCH) base=$(PR_BASE)"
	@$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) \
		--title "$(PR_TITLE)" \
		$$(test -f "$(PR_BODY)" && echo --body-file "$(PR_BODY)" || echo --body "$(PR_TITLE)")

# 現在のブランチに紐づくオープンPRの概要
pr-status:
	@$(GH) pr list --head $(HEAD_BRANCH) --state open --json number,url,baseRefName \
		| jq -r '.[] | "PR #\(.number)  base=\(.baseRefName)  \(.url)"'

# 現在のブランチのPRをブラウザで開く（なければ作成ウィザード）
pr-open:
	@$(GH) pr view --web || $(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH)

# 既存 PR のベースを差し替え（例: make pr-edit-base PR=166 PR_BASE=develop）
pr-edit-base:
	@if [ -z "$(PR)" ]; then echo "Usage: make pr-edit-base PR=<number> [PR_BASE=develop]"; exit 1; fi
	@$(GH) pr edit $(PR) --base $(PR_BASE)
	@$(GH) pr view $(PR) --json url,baseRefName | jq


# ===== GitHub PR ユーティリティ（TAB不要の1行レシピ版） =====
GH ?= gh
PR_BASE ?= develop
PR_BODY ?= .github/pr/default.md
PR_TITLE ?= feat: update
HEAD_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)

.PHONY: pr-create pr-status pr-open pr-edit-base

# 現在ブランチ -> PR作成（デフォルト base=develop）
pr-create: ; @command -v $(GH) >/dev/null 2>&1 || { echo "ERROR: gh (GitHub CLI) が必要です"; exit 1; } ; \
	echo "Creating PR: head=$(HEAD_BRANCH) base=$(PR_BASE)"; \
	if [ -f "$(PR_BODY)" ]; then \
		$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) --title "$(PR_TITLE)" --body-file "$(PR_BODY)"; \
	else \
		$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) --title "$(PR_TITLE)" --body "$(PR_TITLE)"; \
	fi

# 現在ブランチのオープンPRを表示
pr-status: ; @$(GH) pr list --head $(HEAD_BRANCH) --state open --json number,url,baseRefName \
	| jq -r '.[] | "PR #\(.number)  base=\(.baseRefName)  \(.url)"' || $(GH) pr list --head $(HEAD_BRANCH)

# 現在ブランチのPRをブラウザで開く（無ければ作成ウィザード）
pr-open: ; @$(GH) pr view --web || $(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH)

# 既存PRのベース変更（例: make pr-edit-base PR=166 PR_BASE=develop）
pr-edit-base: ; @if [ -z "$(PR)" ]; then echo "Usage: make pr-edit-base PR=<number> [PR_BASE=develop]"; exit 1; fi ; \
	$(GH) pr edit $(PR) --base $(PR_BASE) ; \
	$(GH) pr view $(PR) --json url,baseRefName | jq || true
