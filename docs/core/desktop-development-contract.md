# Desktop Development Contract

## Status

```text
ACTIVE DEVELOPMENT CONTRACT
MOTHER SHIP DECISION RECORDED
SOLE ACTIVE LOCAL REPOSITORY = ~/Desktop/jinja_app
PRODUCTION MUTATION = OUT OF SCOPE
```

対象Repository:

```text
~/Desktop/jinja_app
```

本契約は、KAMI MUSUBI開発において使用するローカルRepository、branch、database、およびデータ再生成経路を明確にし、複数clone・historical DB・backup・一時branch間のsource-of-truth driftを防止するための開発契約である。

本契約はプロダクト仕様、Recommendation logic、Production infrastructureの仕様を変更するものではない。

---

# 1. Purpose

本契約の目的は以下である。

- 開発に使用する唯一のlocal Repositoryを固定する
- base branchを固定する
- local databaseの役割を明確にする
- Repositoryとlocal DBのsource-of-truth関係を固定する
- backup / archiveをactive development sourceから分離する
- Fresh rebuild可能な開発状態を維持する
- AI tool間で参照する開発環境を統一する
- 古いclone・古いDB・古いbranchからのdriftを防止する

---

# 2. Sole Active Local Repository

KAMI MUSUBIのactive local development Repositoryは以下のみとする。

```text
~/Desktop/jinja_app
```

このRepositoryをlocal developmentの唯一の作業対象とする。

以下はactive development sourceとして扱わない。

- 別directoryに存在する過去clone
- backup用Repository copy
- archive directory
- temporary export
- Desktop以外に残存するhistorical clone
- zip / copied repository
- 過去の検証用working copy

別cloneが存在すること自体は禁止しない。

ただし、別cloneをKAMI MUSUBIのactive development sourceとして使用しない。

---

# 3. Repository Source of Truth

Repositoryの基準branchは以下とする。

```text
origin/develop
```

新しい作業を開始するときは、local `develop` を `origin/develop` と同期した状態を起点とする。

通常の作業フロー:

```text
origin/develop
↓
local develop sync
↓
task branch
↓
implementation / audit / docs
↓
test / review
↓
Pull Request
↓
merge
↓
origin/develop
```

feature / audit / chore / docs branchは作業単位の一時branchであり、merge後の長期的なsource of truthとはしない。

---

# 4. Branch Contract

作業は原則として1 task = 1 branch = 1 PRとする。

branch例:

```text
feature/*
audit/*
chore/*
docs/*
fix/*
```

作業開始前に以下を確認する。

```text
current repository = ~/Desktop/jinja_app
base branch = develop
develop is synced with origin/develop
working tree is clean
```

作業完了の定義はPull Request作成までとする。

merge後は次作業を新しいbranchで開始する。

---

# 5. Local Database Contract

標準local development databaseは以下とする。

```text
database = jinja_db
host = 127.0.0.1
port = 5432
user = admin
PostgreSQL = 18
GIS = PostGIS
Django engine = django.contrib.gis.db.backends.postgis
```

これはlocal development runtimeの標準構成である。

Production databaseをlocal development databaseとして使用しない。

Production `DATABASE_URL` をlocal development操作へ流用しない。

databaseに対する破壊操作を行う場合は、実行前に接続先を明示的に確認する。

---

# 6. Database Is Not the Source of Truth

local `jinja_db` の現在状態そのものをcanonical source of truthとはしない。

canonical dataは原則としてRepository内の以下から再生成できる状態を維持する。

```text
migrations
↓
Shrine seed
↓
bootstrap_production_data
↓
Knowledge seeds
↓
explicitly preserved local-only data
```

local DBへの手動変更だけを正本として残さない。

必要な変更は、責務に応じて以下へ還元する。

```text
schema change
→ migration

Shrine canonical data
→ seed / canonical import path

Goriyaku canonical master
→ bootstrap contract

Knowledge data
→ Knowledge seed

business logic
→ backend code

local-only preserved evidence
→ explicit preservation / migration / seed decision
```

---

# 7. Fresh Rebuild Contract

local DBはFresh rebuild可能であることを開発健全性の条件とする。

PR-A3で確認された再構築経路:

```text
Fresh jinja_db
↓
PostGIS
↓
current migrations
↓
bootstrap_production_data
↓
canonical Goriyaku exact-39
↓
Knowledge seed import
↓
approved local-only provenance restore
↓
approved User state restore
```

Fresh rebuildの実行記録は以下を参照する。

```text
docs/audit/fresh-local-db-rebuild.md
```

Fresh rebuild前の保全監査は以下を参照する。

```text
docs/audit/local-db-data-preflight.md
```

---

# 8. Goriyaku Master Contract

GoriyakuTagについてhistorical local DBをsource of truthにしない。

canonical masterはFresh bootstrapで再生成される39件を基準とする。

```text
count = 39
IDs = 1..39
ID / name mapping = canonical exact-39 contract
```

historical 46-row local masterを復元しない。

Recommendationがnumeric GoriyakuTag IDを使用するため、ID / name contractの変更は通常のlocal data editとして扱わない。

---

# 9. Knowledge Contract

Shrine Knowledgeのcanonical regeneration sourceはRepository内のKnowledge seedsとする。

対象:

```text
ShrineKnowledgeSource
ShrineDeity
ShrineHistory
```

Knowledge seedから再生成できないlocal-only provenanceは、明示的にpreserve対象として判断された場合のみ別管理する。

local DBだけに存在するKnowledge rowを黙ってcanonical扱いしない。

---

# 10. User State Contract

User生成データはcanonical product masterとは分離して扱う。

例:

```text
User
UserProfile
Favorite
Visit
ShrineReflection
```

Fresh rebuild時に保存が必要な場合は、事前にpreserve対象として分類する。

Shrine FKを含むUser stateをrestoreするときは、historical physical `shrine_id` を無条件に再利用しない。

原則:

```text
name_jp + address
```

などのsemantic identityでFresh側Shrineを再解決する。

physical PKが一致した場合も、semantic verificationの結果としてのみ利用する。

---

# 11. Backup Contract

backupはrecovery sourceであり、active development sourceではない。

Repository外backup例:

```text
~/Desktop/jinja_app_backups/
```

backup dump、JSON preservation artifact、old database archiveを直接日常開発の正本として使用しない。

backupからデータをrestoreするときは、対象・目的・identity mappingを確認する。

private / authentication stateを含むbackupはRepositoryへcommitしない。

---

# 12. Historical Data Contract

以下は原則としてFresh development runtimeへ自動restoreしない。

```text
historical Concierge logs
historical Analytics logs
old sessions
JWT restore state
historical test Shrines
historical disposable Goriyaku relations
obsolete local test data
```

分析・監査目的で保存する場合はarchiveとして扱い、runtime masterと分離する。

---

# 13. Environment Drift Prevention

以下の状態が発生した場合、本契約との差分として扱う。

- active Repository pathが変わる
- PostgreSQL major versionが変わる
- local DB name / host / portが変わる
- canonical bootstrap entrypointが変わる
- develop以外をbase branchとする
- second active cloneを使用する
- local DBだけにcanonical dataを追加する
- backupをactive DBとして使用する

この場合、暗黙に新環境へ移行せず、Mother Ship判断へ差し戻す。

必要に応じて本契約を更新する。

---

# 14. AI Tool Contract

AI toolsは同一Repository contractを前提として扱う。

## ChatGPT

```text
設計
仕様整理
監査
タスク分解
レビュー
原因分析
```

## Codex

```text
1 feature / PR単位の実装
multi-file change
tests
```

## Cursor

```text
既存コードの局所修正
UI微調整
軽いrefactor
```

## Copilot

```text
軽微な補完
1行修正
```

どのAI toolを使用する場合も、active Repositoryは以下とする。

```text
~/Desktop/jinja_app
```

別cloneをAIごとに使い分けない。

---

# 15. Standard Start-of-Task Gate

新しい作業開始時は最低限以下を確認する。

```text
[ ] current path = ~/Desktop/jinja_app
[ ] current branchを確認
[ ] developをorigin/developへ同期
[ ] working tree clean
[ ] task branch作成
[ ] task scope確認
[ ] Production mutation不要を確認
```

database操作を伴う場合は追加で確認する。

```text
[ ] database = jinja_db
[ ] host = 127.0.0.1
[ ] Production DATABASE_URL非使用
[ ] destructive operationならbackup / restore contract確認
```

---

# 16. Prohibited Development Patterns

以下を標準開発フローとして採用しない。

```text
old cloneでの継続開発
複数cloneを同時にactive sourceとして使用
historical DBをそのままcanonical DBとして延命
local DBへのmanual fixだけで仕様を確定
Production DBをlocal testingへ使用
backup dumpを通常runtimeとして使用
未merge branchを長期source of truthとして使用
physical IDだけに依存したdata restore
```

---

# 17. Related Documents

```text
docs/audit/local-db-data-preflight.md
docs/audit/fresh-local-db-rebuild.md
docs/audit/shrine-goriyaku-detail-api-contract.md
```

Core README / architectureから本契約を参照できる状態を維持する。

---

# 18. Result

```text
SOLE ACTIVE LOCAL REPOSITORY = ~/Desktop/jinja_app
BASELINE = origin/develop
LOCAL DATABASE = jinja_db @ 127.0.0.1:5432
DATABASE ROLE = REPRODUCIBLE RUNTIME
REPOSITORY / MIGRATION / SEED / BOOTSTRAP = CANONICAL REGENERATION SOURCE
BACKUP = RECOVERY / ARCHIVE ONLY
SECOND ACTIVE CLONE = NOT ALLOWED
PRODUCTION MUTATION = OUT OF SCOPE
```

KAMI MUSUBIのlocal developmentは、本契約を基準として継続する。

環境構成またはsource-of-truth contractを変更する必要が生じた場合は、暗黙に変更せずMother Shipへ差し戻す。
