# Fresh Local DB Rebuild

## Status

```text
REBUILD COMPLETE
FRESH LOCAL DB = PASS
CANONICAL GORIYAKU EXACT-39 = PASS
KNOWLEDGE IMPORT = PASS
LOCAL-ONLY PROVENANCE RESTORE = PASS
USER STATE RESTORE = PASS
FINAL QA = PASS
PRODUCTION MUTATION = NONE
```

対象ブランチ:

```text
chore/fresh-local-db-rebuild
```

対象ローカルRepository:

```text
~/Desktop/jinja_app
```

対象Database:

```text
database: jinja_db
host: 127.0.0.1
port: 5432
user: admin
PostgreSQL server: 18.0 (Homebrew)
Django engine: django.contrib.gis.db.backends.postgis
```

本作業は `docs/audit/local-db-data-preflight.md` でPASSとなったFresh rebuild gateに基づき、historical local DBを破棄し、current migrations / Production bootstrap / Knowledge seedから再構築した実行記録である。

Production DB、Google Sheet、Recommendation logic、seed、migrationへの変更は行っていない。

---

# 1. Preconditions

Fresh rebuild前に以下を確認した。

```text
backup integrity = PASS
backup SHA256 = PASS
target database = jinja_db
target host = 127.0.0.1
target port = 5432
DATABASE_URL_SET = False
PGHOST = None
PGDATABASE = None
branch = chore/fresh-local-db-rebuild
live database = jinja_db / 127.0.0.1 / 5432
```

Repository外backup:

```text
~/Desktop/jinja_app_backups/preflight-20260905/
```

保全済みartifact:

* `jinja_db_before_fresh_rebuild.dump`
* `user_state_preserve.dump`
* `knowledge_provenance_preserve.json`
* `user_state_shrine_semantic_map.json`

---

# 2. Fresh DB Rebuild

historical local `jinja_db` をdropし、同名Fresh databaseを再作成した。

再作成後の接続確認:

```text
jinja_db|127.0.0.1|5432
```

Fresh databaseではPostGIS extensionが未作成だったため、migration前にPostGISを有効化した。

```text
plpgsql
postgis
```

---

# 3. Migrations

Fresh databaseへcurrent migrationsを全件適用した。

```text
temples.0001 ... temples.0104 = OK
users.0001 ... users.0006 = OK
python manage.py migrate --check = PASS
```

historical DBへ0100 / 0101をin-place適用する方式は採用していない。

---

# 4. Shrine Bootstrap

Production bootstrap entrypointをFresh databaseへ実行した。

```text
python manage.py bootstrap_production_data
```

結果:

```text
Shrine total = 103
Shrine kind=shrine total = 103
Shrine with latitude/longitude = 103
Shrine with visit_style_tags = 103
Shrine with goriyaku_tags = 98
created_tags = 39
added_links = 280
```

Bootstrap order:

```text
import_shrines_seed
backfill_goriyaku_tags --with-visit-style --force
```

---

# 5. Canonical Goriyaku exact-39 Gate

Fresh bootstrap後の `GoriyakuTag` をID / nameの完全一致で検証した。

```text
SHRINE_COUNT = 103
TAG_COUNT = 39
EXACT39 = True
EXTRA = []
MISSING = []
```

canonical ID 1..39 contractとの完全一致を確認した。

historical local DBに存在した46-row GoriyakuTag masterはrestoreしていない。

---

# 6. Knowledge Import

対象seed:

```text
batch_1_7_seed.json
batch_8_seed.json
batch_9_seed.json
batch_10_seed.json
batch_11_seed.json
batch_12_seed.json
batch_13_seed.json
batch_14_seed.json
batch_15_seed.json
batch_16_seed.json
batch_17_seed.json
```

全batchについて以下を順に実行した。

```text
--validate-only = PASS
--dry-run = PASS
import = PASS
```

Batch17の北海道神宮 / 建部大社 / 波上宮を含め、Shrine identity resolution errorは発生しなかった。

Batch9の箱根神社Sourceは既存Sourceを正常に再利用した。

Canonical Knowledge import後:

```text
ShrineKnowledgeSource = 113
ShrineDeity = 245
ShrineHistory = 195
Deity -> Source relations = 258
History -> Source relations = 200
```

---

# 7. Local-only Knowledge Provenance Restore

Fresh importだけでは再生成されないlocal-only provenanceとして、preflightでB分類された2 Source / 3 History relationsをselective restoreした。

対象Source:

* 鶴岡八幡宮境内（史跡） / 文化遺産オンライン（文化庁）
* 給田六所神社例大祭 / 文化庁

対象History relation:

* 鶴岡八幡宮 / founding / 由比若宮の勧請
* 鶴岡八幡宮 / historical_event / 現在地への遷座
* 給田六所神社 / founding / 武蔵総社六所宮よりの分霊勧請

旧physical History IDは使用せず、Shrine `name_jp + address` と `history_type + title` でFresh側をsemantic resolutionした。

Fresh History IDはhistorical DBと異なっていたため、physical ID blind restoreを行わなかった判断が有効だった。

restore後:

```text
ShrineKnowledgeSource = 115
History -> Source relations = 203
```

---

# 8. User State Semantic Remap

User stateが参照していたShrine 5社を `name_jp + address` でFresh側へ再解決した。

```text
鶴岡八幡宮 old=10 fresh=10
三峯神社 old=17 fresh=17
乃木神社 old=59 fresh=59
武蔵御嶽神社 old=71 fresh=71
妙義神社 old=88 fresh=88
```

5社すべてsemantic identityが一意に一致し、結果としてFresh PKもhistorical PKと一致した。

PK一致は事前仮定ではなくsemantic verificationの結果として扱った。

---

# 9. User State Restore

Fresh側restore対象tableが空であることを確認した。

```text
auth_user = 0
users_userprofile = 0
temples_favorite = 0
temples_visit = 0
temples_shrinereflection = 0
```

`user_state_preserve.dump` はPostgreSQL 18 custom archiveであるため、PATH上のPostgreSQL 16 `pg_restore` は使用せず、PostgreSQL 18をabsolute path指定した。

```text
/opt/homebrew/opt/postgresql@18/bin/pg_restore
```

restore対象:

```text
auth_user
users_userprofile
temples_favorite
temples_visit
temples_shrinereflection
```

restore後:

```text
auth_user = 9
users_userprofile = 9
temples_favorite = 4
temples_visit = 8
temples_shrinereflection = 8
```

Shrine FKはsemantic確認済み5社の範囲内であることを確認した。

Visit / ShrineReflectionの `thread_id` は全件NULLのまま維持された。

---

# 10. Sequence Integrity

restore後、User state対象5tableのsequenceを確認した。

```text
auth_user MAX_ID=17 SEQ_LAST=17 SAFE=True
users_userprofile MAX_ID=17 SEQ_LAST=17 SAFE=True
temples_favorite MAX_ID=21 SEQ_LAST=21 SAFE=True
temples_visit MAX_ID=11 SEQ_LAST=11 SAFE=True
temples_shrinereflection MAX_ID=10 SEQ_LAST=10 SAFE=True
```

新規INSERT時のprimary key collision riskがないことを確認した。

---

# 11. Final QA

最終QA:

```text
python manage.py check = PASS
python manage.py migrate --check = PASS
```

Final database state:

```text
DB = jinja_db
SHRINE = 103
GORIYAKU = 39
SOURCE = 115
DEITY = 245
HISTORY = 195
DEITY_REL = 258
HISTORY_REL = 203
USER = 9
PROFILE = 9
FAVORITE = 4
VISIT = 8
REFLECTION = 8
```

すべて期待値と一致した。

---

# 12. Safety Boundaries

本作業で行っていないこと:

* Production database mutation
* Google Sheet mutation
* current seed変更
* migration変更
* Recommendation / scoring変更
* Evidence FoundationとRecommendation runtimeの接続
* historical Concierge / Analytics logsのFresh runtimeへのrestore
* historical 46-row GoriyakuTag masterのrestore
* local test Shrine 5社のrestore
* historical physical History IDのblind restore

Repository外backupは本PRへcommitしない。

---

# 13. Result

```text
FRESH LOCAL DB REBUILD = COMPLETE
CANONICAL DATA REGENERATION = PASS
SELECTIVE LOCAL DATA PRESERVATION = PASS
FINAL QA = PASS
PRODUCTION MUTATION = NONE
```

PR-A3のFresh local DB rebuildは完了した。

次工程はPR-A4 Desktop-only Development Contract / docsとし、本PRでは追加のDB taxonomy変更やRecommendation変更を行わない。
