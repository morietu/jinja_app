GH ?= gh
PR_BASE ?= develop
PR_BODY ?= .github/pr/default.md
PR_TITLE ?= feat: update
HEAD_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)

.PHONY: pr-create pr-status pr-open pr-edit-base

pr-create: ; @command -v $(GH) >/dev/null 2>&1 || { echo "ERROR: gh が必要です"; exit 1; } ; \
	echo "Creating PR: head=$(HEAD_BRANCH) base=$(PR_BASE)"; \
	if [ -f "$(PR_BODY)" ]; then \
		$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) --title "$(PR_TITLE)" --body-file "$(PR_BODY)"; \
	else \
		$(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH) --title "$(PR_TITLE)" --body "$(PR_TITLE)"; \
	fi

pr-status: ; @$(GH) pr list --head $(HEAD_BRANCH) --state open --json number,url,baseRefName \
	| jq -r '.[] | "PR #\(.number)  base=\(.baseRefName)  \(.url)"' || $(GH) pr list --head $(HEAD_BRANCH)

pr-open: ; @$(GH) pr view --web || $(GH) pr create --base $(PR_BASE) --head $(HEAD_BRANCH)

# 既存PRのベース変更（例: make -f mk/pr.mk pr-edit-base PR=166 PR_BASE=develop）
pr-edit-base: ; @if [ -z "$(PR)" ]; then echo "Usage: make pr-edit-base PR=<number> [PR_BASE=develop]"; exit 1; fi ; \
	$(GH) pr edit $(PR) --base $(PR_BASE) ; \
	$(GH) pr view $(PR) --json url,baseRefName | jq || true
