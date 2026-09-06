# Local DB Data Preflight

## Status

```text
AUDIT COMPLETE
FRESH REBUILD PREFLIGHT = PASS
UNKNOWN = 0
DESTRUCTIVE REBUILD = NOT PERFORMED
PRODUCTION MUTATION = NONE
```

対象ブランチ:

```text
audit/local-db-data-preflight
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
```

本監査の目的は、historical local PostgreSQL DB `jinja_db` をFresh rebuildする前に、現在のlocal DBにのみ存在するデータを特定し、破壊前に必要なデータを保全することである。

本監査ではProduction DB、Google Sheet、tracked seed、migration、Recommendation logicへの変更を行っていない。

---

# 1. Scope

## 1.1 本監査で行うこと

* local PostgreSQL DBの全table inventory取得
* table row count取得
* Shrine seedとlocal Shrineの双方向比較
* GoriyakuTag canonical contractとlocal masterの比較
* Shrine ↔ GoriyakuTag relationのsemantic比較
* Knowledge seedとlocal Knowledge dataの双方向比較
* local-only Shrineの依存関係確認
* User生成データの依存関係確認
* Concierge / Analytics dataの保存方針整理
* current developとのmigration差分確認
* Fresh rebuild前に必要なbackupの作成
* backup integrity / SHA256確認
* A / B / C / D分類
* Fresh rebuild gate判定

## 1.2 本監査で行わないこと

* DB drop
* DB flush
* Fresh DB作成
* migration実行
* GoriyakuTagの手動修正
* local-only Shrineの削除
* Knowledge Sourceの削除
* Production DB変更
* Google Sheet変更
* seed変更
* Recommendation / scoring変更
* Evidence FoundationとRecommendation runtimeの接続
* backup dataのrestore

破壊的なFresh rebuildは次PRで扱う。

---

# 2. Classification Contract

本監査ではデータを以下の4分類で扱う。

```text
A. REGENERATABLE
   repository / migration / seed / bootstrapから再生成可能

B. LOCAL_ONLY_PRESERVE
   localにしか存在しない、またはFresh rebuildで自動再生成されないため、
   破壊前に保存必須

C. LOCAL_ONLY_DISPOSABLE
   local限定またはhistorical artifactだが、
   Fresh DBへ引き継ぐ必要がない

D. UNKNOWN
   現時点では判断不能
```

Fresh rebuildへ進む条件:

```text
- Bがすべてbackup済み
- UNKNOWN = 0
- Production接続ではない
- regeneration pathが確認済み
- exact-39 Goriyaku regression testが存在する
```

---

# 3. Local DB Identity

本監査対象DBは以下である。

```text
database = jinja_db
user     = admin
host     = 127.0.0.1
port     = 5432
```

したがって、本監査対象はlocal PostgreSQLでありProduction DBではない。

```text
PRODUCTION_CONNECTION = NO
```

---

# 4. Table Inventory

local `public` schemaには以下のtableが存在した。

```text
auth_group
auth_group_permissions
auth_permission
auth_user
auth_user_groups
auth_user_user_permissions
django_admin_log
django_content_type
django_migrations
django_session
favorites_favorite
place_cache
place_ref
places_seed
places_seed_state
spatial_ref_sys
temples_actionevent
temples_concierge_recommendation_click_log
temples_concierge_recommendation_log
temples_conciergehistory
temples_conciergemessage
temples_conciergethread
temples_conciergeusage
temples_crawltile
temples_deity
temples_favorite
temples_featureusage
temples_goriyakutag
temples_goshuin
temples_goshuinimage
temples_like
temples_productiondatabootstraprun
temples_rankinglog
temples_shrine
temples_shrine_goriyaku_tags
temples_shrinecandidate
temples_shrinedeity
temples_shrinedeity_sources
temples_shrinehistory
temples_shrinehistory_sources
temples_shrineinteractionlog
temples_shrineknowledgesource
temples_shrinereflection
temples_shrinesubmission
temples_visit
token_blacklist_blacklistedtoken
token_blacklist_outstandingtoken
users_userprofile
```

主要row count:

```text
auth_permission                              160
auth_user                                      9
django_admin_log                              37
django_content_type                           40
django_migrations                            137
django_session                                 3

temples_actionevent                            2
temples_concierge_recommendation_log         910
temples_conciergemessage                     870
temples_conciergethread                      801
temples_conciergeusage                         1
temples_favorite                               4
temples_featureusage                          83
temples_goriyakutag                           46
temples_shrine                               105
temples_shrine_goriyaku_tags                284
temples_shrinedeity                          233
temples_shrinedeity_sources                  244
temples_shrinehistory                        182
temples_shrinehistory_sources                190
temples_shrineinteractionlog                  21
temples_shrineknowledgesource                113
temples_shrinereflection                       8
temples_visit                                  8

token_blacklist_outstandingtoken             128
users_userprofile                              9
```

---

# 5. Shrine Master Audit

current repository:

```text
backend/temples/data/shrines_seed_clean.json
```

とlocal `temples_shrine` を `(name_jp, address)` のsemantic identityで比較した。

結果:

```text
SEED rows/semantic = 103 / 103
DB rows/semantic   = 105 / 105
```

## 5.1 Current seedに存在し、localにまだ存在しないShrine

```text
北海道神宮
北海道札幌市中央区宮ヶ丘474

建部大社
滋賀県大津市神領1-16-1

波上宮
沖縄県那覇市若狭1-25-11
```

これら3社はcurrent repository seedに含まれており、local DBがseedより古いことによる差分である。

分類:

```text
A. REGENERATABLE
```

## 5.2 Local-only Shrine

localにのみ存在するShrineは5件。

```text
101 承認テスト神社
    東京都テスト区1-2-3

102 admin承認テスト神社
    東京都admin区1-1-1

103 重複検証神社
    東京都千代田区重複1-1-1

104 重複検証神社
    東京都中央区重複2-2-2

105 重複検証神社（別宮）
    東京都港区重複3-3-3
```

全Shrine FKをschemaから取得した。

```text
temples_actionevent              shrine_id
temples_conciergethread          main_shrine_id
temples_favorite                 shrine_id
temples_goshuin                  shrine_id
temples_like                     shrine_id
temples_rankinglog               shrine_id
temples_shrine_goriyaku_tags     shrine_id
temples_shrinedeity              shrine_id
temples_shrinehistory            shrine_id
temples_shrineinteractionlog     shrine_id
temples_shrinereflection         shrine_id
temples_visit                    shrine_id
```

上記12系統すべてについてShrine 101〜105へのreference countを確認したところ、

```text
ALL REFERENCES = 0
```

だった。

したがって5社は、本監査上Fresh DBへ引き継ぐべきuser / knowledge / analytics dataを持たないlocal test artifactとして扱う。

分類:

```text
C. LOCAL_ONLY_DISPOSABLE
```

## 5.3 Shrine Master Classification

```text
current seedで再生成される103社
→ A. REGENERATABLE

local-only test Shrine 5社
→ C. LOCAL_ONLY_DISPOSABLE

Shrine B
→ none

Shrine D
→ none
```

---

# 6. GoriyakuTag Master Audit

Production-compatible canonical GoriyakuTag contractは39件である。

canonical ID:

```text
1  縁結び
2  厄除け
3  交通安全
4  商売繁盛
5  五穀豊穣
6  開運
7  家内安全
8  福徳
9  学業成就
10 合格祈願
11 勝運
12 仕事運
13 航海安全
14 海上安全
15 武運長久
16 安産
17 八方除
18 夫婦円満
19 八難除
20 恋愛成就
21 導き
22 美容
23 方除け
24 健康長寿
25 芸能
26 家庭円満
27 出世運
28 金運
29 芸能運
30 強運厄除け
31 技芸上達
32 八方除け
33 病気平癒
34 火防
35 子宝
36 心願成就
37 延命長寿
38 足腰健康
39 農業守護
```

local DB:

```text
GoriyakuTag count = 46
```

canonical ID/nameとの比較:

```text
MISSING canonical IDs = 0
canonical ID/name exact match = 1 / 39
```

つまりlocalは単に7行多いだけではなく、ID→name mapping自体がhistorical taxonomyへ大きくdriftしている。

extra ID:

```text
40 八方除け
41 火防
42 子宝
43 心願成就
44 延命長寿
45 足腰健康
46 農業守護
```

current Recommendation runtimeではnumeric GoriyakuTag IDが意味を持つため、この46-row masterを手作業で補正する方式は採用しない。

Mother Ship decision:

```text
Fresh Rebuild + Bootstrap Exact-39 Regression
```

PR #2719:

```text
test/goriyaku-bootstrap-exact39-contract
```

でFresh bootstrap後にcanonical exact 39が再現されることをregression testで固定済み。

分類:

```text
historical local GoriyakuTag 46
→ C. LOCAL_ONLY_DISPOSABLE

Fresh canonical exact39
→ A. REGENERATABLE
```

---

# 7. Shrine ↔ GoriyakuTag Relation Audit

current `shrines_seed_clean.json` の `goriyaku` をcurrent parserで分解し、期待relationを作成した。

結果:

```text
expected = 280
actual   = 284
missing  = 0
extra    = 4
```

つまりcurrent seed由来の280 relationはすべてlocal DBに存在している。

extra relation:

```text
森戸大明神
→ 心願成就

榛名神社
→ 心願成就

武蔵御嶽神社
→ 心願成就

筑波山神社
→ 心願成就
```

4社について`Shrine.goriyaku`本文とcurrent seedを比較した。

### 榛名神社

```text
LOCAL = 開運・五穀豊穣・商売繁盛
SEED  = 開運・五穀豊穣・商売繁盛
```

### 筑波山神社

```text
LOCAL = 縁結び・夫婦円満・開運
SEED  = 縁結び・夫婦円満・開運
```

### 武蔵御嶽神社

```text
LOCAL = 厄除け・開運・勝運
SEED  = 厄除け・開運・勝運
```

### 森戸大明神

```text
LOCAL = 開運・縁結び・海上安全
SEED  = 開運・縁結び・海上安全
```

全4社でlocal本文とseed本文が一致し、`心願成就`はM2M relationにのみ残っている。

したがって、

```text
canonical seed relation 280
→ A. REGENERATABLE

extra 心願成就 relation 4
→ C. LOCAL_ONLY_DISPOSABLE
```

Goriyaku系にBは存在しない。

---

# 8. Knowledge Model Audit

Knowledge Foundation対象:

```text
ShrineDeity
ShrineHistory
ShrineKnowledgeSource
ShrineDeity.sources
ShrineHistory.sources
```

current canonical import path:

```text
backend/temples/services/knowledge_seed.py
backend/temples/management/commands/import_shrine_knowledge.py
backend/temples/data/knowledge_seeds/
```

current seed batches:

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

## 8.1 Fact reverse audit

```text
DEITY
seed identities = 245
local identities = 233
local-only = 0

HISTORY
seed identities = 195
local identities = 182
local-only = 0
```

localにしか存在しないDeity / History Factは存在しない。

不足分はcurrent localにまだ存在しないBatch17の3 Shrineに由来する。

```text
北海道神宮
建部大社
波上宮
```

したがってFactは、

```text
A. REGENERATABLE
```

---

# 9. Knowledge Source Audit

local physical Source rows:

```text
113
```

semantic Source identity:

```text
112
```

physical rowとsemantic identityの差1件は、箱根神社公式URLのhistorical duplicateによる。

## 9.1 Test Source

```text
999002
source_type = shrine_official
URL = https://example.com/

999003
source_type = local_history
title = テスト神社史
```

どちらもDeity / History relationは0。

分類:

```text
C. LOCAL_ONLY_DISPOSABLE
```

## 9.2 箱根 semantic duplicate

同一official URL:

```text
https://hakonejinja.or.jp/hakone/
```

に対してlocalに2 Sourceが存在する。

```text
999036
999074
```

current `batch_9_seed.json` はSource 999036側のmetadataへ合わせてsemantic reuseする設計へremediation済み。

したがって、

```text
999036
→ canonical reusable Source

999074
→ C. LOCAL_ONLY_DISPOSABLE
```

本監査では削除は行わない。

---

# 10. Knowledge Local-only Preserve Data

seedに存在せず、意味のあるHistory provenanceを持つSourceが2件存在した。

## 10.1 Source 999125

```text
id = 999125
source_type = cultural_property
publisher = 文化庁
verification_status = source_confirmed
confidence = high

URL:
https://online.bunka.go.jp/heritages/detail/160978
```

relations:

```text
鶴岡八幡宮
- founding
  由比若宮の勧請

- historical_event
  現在地への遷座
```

## 10.2 Source 999126

```text
id = 999126
source_type = government
publisher = 文化庁
verification_status = source_confirmed
confidence = high

URL:
https://www.dentou-hasshin.bunka.go.jp/search/158.html
```

relation:

```text
給田六所神社
- founding
  武蔵総社六所宮よりの分霊勧請
```

この2 Sourceはmigration `0096_source_backfill_id10_id22.py` がgeneration pathだが、migration execution時点でtarget Shrine / Historyが存在しないFresh/pre-seed lineageではno-opし、その後bootstrapしてもmigrationは再実行されない。

またcurrent Knowledge seed corpusにも含まれていない。

したがってFresh rebuildでの自動再生成は保証されない。

分類:

```text
Source 999125
Source 999126
History↔Source relation 3本

→ B. LOCAL_ONLY_PRESERVE
```

---

# 11. Knowledge Relation Audit

semantic relation比較結果:

```text
DEITY_REL
expected   = 258
actual     = 244
missing    = 14
local-only = 0

HISTORY_REL
expected   = 200
actual     = 190
missing    = 13
local-only = 3
```

missing Deity 14本、History 13本はすべてcurrent localにまだ存在しないBatch17の3 Shrineに由来する。

したがってこれらはcurrent repositoryから再生成可能。

```text
Batch17 missing relations
→ A. REGENERATABLE
```

唯一のlocal-only History relation 3本は、§10の文化庁Source 2件に対応する。

```text
→ B. LOCAL_ONLY_PRESERVE
```

---

# 12. User-generated Data Audit

local:

```text
auth_user                9
users_userprofile        9
temples_favorite         4
temples_visit            8
temples_shrinereflection 8
```

auth_user参照を確認したところ、superuser以外にもFavorite / Visit / Reflectionを持つUserが存在した。

Favorite:

```text
user 1  → 2
user 8  → 1
user 17 → 1
```

Visit:

```text
user 1  → 6
user 8  → 1
user 17 → 1
```

Reflection:

```text
user 1  → 5
user 7  → 1
user 8  → 1
user 17 → 1
```

これらはrepositoryから再生成できない。

分類:

```text
auth_user
users_userprofile
temples_favorite
temples_visit
temples_shrinereflection

→ B. LOCAL_ONLY_PRESERVE
```

ここでBは、

```text
必ずFresh DBへrestoreする
```

という意味ではない。

contractは、

```text
destructive rebuild前に保存
↓
Fresh DB構築
↓
必要なデータだけrestore
```

である。

---

# 13. User Data Shrine Dependencies

Favorite:

```text
user 1  → 鶴岡八幡宮
user 1  → 三峯神社
user 8  → 三峯神社
user 17 → 乃木神社
```

Visit:

```text
鶴岡八幡宮
三峯神社
乃木神社
武蔵御嶽神社
```

Reflection:

```text
鶴岡八幡宮
三峯神社
乃木神社
武蔵御嶽神社
妙義神社
```

いずれもcurrent seedから再生成可能なShrineを参照する。

一方、`owner_id`を持つShrineは、

```text
101 承認テスト神社
102 admin承認テスト神社
```

のみ。

この2 Shrineは§5でC確定済み。

したがってUser状態を保存するためにlocal-only Shrineを残す必要はない。

---

# 14. Visit / Reflection Thread Dependency

Visit / Reflection全件について`thread_id`を確認した。

```text
Visit      8 / 8 = NULL
Reflection 8 / 8 = NULL
```

したがってUser restore候補はConciergeThreadに依存しない。

selective preserve set:

```text
auth_user
users_userprofile
temples_favorite
temples_visit
temples_shrinereflection
```

---

# 15. Authentication / Session State

以下はFresh DBへrestoreする必要のない一時的認証状態として扱う。

```text
django_session
token_blacklist_outstandingtoken
token_blacklist_blacklistedtoken
```

分類:

```text
C. LOCAL_ONLY_DISPOSABLE
```

`django_admin_log`についてはFresh runtimeへrestoreする必要はない。

ただしhistorical full archiveには保存する。

```text
archive-only preserve
```

---

# 16. Concierge / Analytics

主要local counts:

```text
temples_concierge_recommendation_log  910
temples_conciergemessage              870
temples_conciergethread               801
temples_featureusage                   83
temples_shrineinteractionlog           21
temples_actionevent                     2
django_admin_log                       37
```

これらはrepositoryから再生成できない一方、Fresh runtimeへ必須なmaster dataでもない。

またhistorical QA trafficをFresh DBへ戻すと、新しいAnalytics baselineを汚染する可能性がある。

本監査では、

```text
B. ARCHIVE-ONLY PRESERVE
```

として扱う。

方針:

```text
full historical snapshotには保存する
Fresh DBへは原則restoreしない
必要な過去分析時のみhistorical snapshotを参照する
```

0-row log tableはCとして扱う。

---

# 17. System-generated Tables

以下はmigration / PostgreSQL / Djangoによって再生成可能。

```text
auth_permission
django_content_type
django_migrations
spatial_ref_sys
```

分類:

```text
A. REGENERATABLE
```

以下はlocal runtime / bookkeeping stateでありFresh runtimeへのrestore不要。

```text
django_session
temples_productiondatabootstraprun
token blacklist state
```

分類:

```text
C. LOCAL_ONLY_DISPOSABLE
```

---

# 18. Legacy Tables

`favorites_favorite` はmigration上のlegacy Favorite table。

local row count:

```text
0
```

current active Favoriteは:

```text
temples_favorite
```

分類:

```text
favorites_favorite
→ C. LOCAL_ONLY_DISPOSABLE
```

---

# 19. Evidence Foundation Schema State

local migration state:

```text
[X] 0099_fix_shrine_49_coordinates

[ ] 0100_p8a_duplicate_shrine_shadow_cleanup
[ ] 0101_p8b_remove_non_shrine_artifact_id105
[ ] 0102_history_theme_assignment_foundation
[ ] 0103_goriyaku_evidence_foundation
[ ] 0104_evidence_link_foundation
```

local DBはcurrent developより5 migrations遅れている。

Evidence Foundation tables:

```text
HistoryThemeAssignment
ShrineGoriyakuAssignment
EvidenceLink
```

はlocalに存在しない。

`0102〜0104` はCreateModel migrationであり、localに保存すべき既存Evidence Foundation dataは存在しない。

分類:

```text
Evidence Foundation schema
→ A. REGENERATABLE

local Evidence Foundation data
→ none
```

---

# 20. Why migrate-in-place Is Not Used

current historical local DBにそのまま`migrate`を実行する方法は採用しない。

理由:

`0100_p8a_duplicate_shrine_shadow_cleanup` はProductionで確認された特定PK:

```text
101
103
104
```

のspecific shadow Shrine identityをfail-closedで確認して処理する。

しかしcurrent localでは同じPKが、

```text
101 承認テスト神社
103 重複検証神社
104 重複検証神社
```

として使用されている。

同様に`0101`はProductionで確認された:

```text
id 105 = 広島市
```

というnon-shrine artifactを対象とするが、current localの105は:

```text
重複検証神社（別宮）
```

である。

したがってhistorical local DBは0100 / 0101のaudited PRE stateと一致しない。

このDBへmigrationを追加適用してcurrent developへ追従させる方法より、

```text
Fresh DB
↓
all migrations
↓
bootstrap
```

を採用する方が今回のcontractと整合する。

---

# 21. Fresh DB Expected Lineage

PR-A3では概ね以下のlineageを前提とする。

```text
Fresh PostgreSQL DB
↓
current migrations 0001 → 0104+
↓
0100 / 0101 はpre-seed fresh lineageとしてclean no-op
↓
0102 HistoryThemeAssignment schema
↓
0103 ShrineGoriyakuAssignment schema
↓
0104 EvidenceLink schema
↓
import_shrines_seed
↓
backfill_goriyaku_tags --with-visit-style --force
↓
canonical exact-39 GoriyakuTag
↓
Knowledge seed import
↓
validation
↓
必要なBデータのみselective restore
```

PR-A2ではこの操作を実行しない。

---

# 22. Backup Evidence

backupはrepository外に作成した。

directory:

```text
~/Desktop/jinja_app_backups/preflight-20260905/
```

機密情報を含むため、これらのbackup fileをGitへcommitしてはならない。

## 22.1 Historical Full DB Archive

```text
file:
jinja_db_before_fresh_rebuild.dump

size:
1.7M

format:
PostgreSQL custom archive

dumped from:
PostgreSQL 18.0

dumped by:
pg_dump 18.0
```

`pg_restore -l`によるarchive readを確認済み。

SHA256:

```text
fd5c64cfbd2f53fe32790aaa8f1138f1d7fe26877ff9a9dd449f68af07668b2b
```

用途:

```text
事故時のhistorical full recovery
archive-only Concierge / Analytics参照
```

---

# 23. User Selective Backup

file:

```text
user_state_preserve.dump
```

size:

```text
5.4K
```

対象TABLE DATA:

```text
auth_user
temples_favorite
temples_shrinereflection
temples_visit
users_userprofile
```

対応SEQUENCE SETもarchive内に存在することを確認済み。

SHA256:

```text
ca60788b2ee736a6cfd9e5ff688b9b4db62107f39168b0db66753042a439940c
```

用途:

```text
Fresh DB後のselective restore候補
```
## 23.1 User State Shrine Semantic Map

`Favorite` / `Visit` / `ShrineReflection` はhistorical local DBの
`shrine_id` physical PKを保持している。

`import_shrines_seed` のShrine identityは `(name_jp, address)` を基準とするため、
Fresh DBでもhistorical DBと同一のShrine PKが再現されることを前提としてはならない。

そのため、User stateが参照するShrineについてsemantic identity mapをrepository外へ保存した。

file:

```text
user_state_shrine_semantic_map.json
```

size:

```text
794 bytes
```

SHA256:

```text
9d7d245f1e13b2cd8bb534b207d6d0bfa3d98c128aa2936d52409cb37da2eb61
```

validation:

```text
SHRINE_COUNT = 5

10 鶴岡八幡宮
   神奈川県鎌倉市雪ノ下2-1-31

17 三峯神社
   埼玉県秩父市三峰298-1

59 乃木神社
   東京都港区赤坂8-11-27

71 武蔵御嶽神社
   東京都青梅市御岳山176

88 妙義神社
   群馬県富岡市妙義町妙義6
```

restore contract:

```text
historical shrine_idをFresh DBへ盲目的に再利用しない。

restore時は、
1. (name_jp, address) でFresh Shrineを再解決する
または
2. historical PKとFresh PKのsemantic equivalenceを検証する

いずれかを満たしてからFavorite / Visit / Reflectionをrestoreする。
```

したがって `user_state_preserve.dump` は保存済みrestore candidateではあるが、
このsemantic verificationなしのdirect restoreは許可しない。

---

# 24. Knowledge Provenance Backup

file:

```text
knowledge_provenance_preserve.json
```

size:

```text
4421 bytes
```

SHA256:

```text
3a84b12442d50905b44579e9bc8842aa1be3c9b50dfa01e91ac59c1f757a9cd8
```

validation:

```text
SOURCE_IDS = [999125, 999126]

SOURCE_TYPES =
999125 cultural_property
999126 government

HISTORY_REL_COUNT = 3
DEITY_REL_COUNT = 0

SHRINES =
10 鶴岡八幡宮
22 給田六所神社
```

Source concrete fieldsに加え、関連HistoryとShrine semantic identityをJSONへ保存した。

Fresh DBでphysical IDが変化した場合でもsemantic identityで照合可能。



---

# 25. Final A / B / C / D Matrix

## A. REGENERATABLE

```text
current Shrine seed 103社
Batch17 北海道神宮
Batch17 建部大社
Batch17 波上宮

canonical GoriyakuTag exact39
canonical Shrine↔Goriyaku relation 280本

ShrineDeity seed Facts
ShrineHistory seed Facts
Knowledge seed-defined Sources
Knowledge seed-defined relations
Batch17 Knowledge Facts / relations

auth_permission
django_content_type
django_migrations
spatial_ref_sys

HistoryThemeAssignment schema
ShrineGoriyakuAssignment schema
EvidenceLink schema
```

## B. LOCAL_ONLY_PRESERVE

### restore candidate

```text
auth_user 9
users_userprofile 9
temples_favorite 4
temples_visit 8
temples_shrinereflection 8
```

### Knowledge provenance

```text
ShrineKnowledgeSource 999125
ShrineKnowledgeSource 999126
History↔Source relation 3本
```

### archive-only

```text
Concierge history / thread / messages / recommendation logs
FeatureUsage
ShrineInteractionLog
ActionEvent
django_admin_log
その他historical analytics
```

## C. LOCAL_ONLY_DISPOSABLE

```text
local-only test Shrine 101〜105

historical drifted GoriyakuTag 46-row state
extra 心願成就 M2M relation 4本

Knowledge test Source 999002
Knowledge test Source 999003
old duplicate Source 999074

favorites_favorite legacy rows/state
django_session
JWT outstanding / blacklist state
ProductionDataBootstrapRun state

zero-row local caches / candidate / submission / legacy runtime state
```

## D. UNKNOWN

```text
none
```

```text
UNKNOWN = 0
```

---

# 26. Fresh Rebuild Gate

| Gate                                              | Result |
| ------------------------------------------------- | ------ |
| Target DB is local PostgreSQL                     | PASS   |
| Production connection absent                      | PASS   |
| A/B/C/D classification completed                  | PASS   |
| UNKNOWN = 0                                       | PASS   |
| Full historical backup created                    | PASS   |
| Full archive readable by pg_restore               | PASS   |
| User selective backup created                     | PASS   |
| User selective archive readable                   | PASS   |
| User Shrine semantic map created                    | PASS   |
| User Shrine semantic map JSON validated             | PASS   |
| User Shrine semantic map SHA256 recorded            | PASS   |
| Knowledge provenance backup created               | PASS   |
| Knowledge provenance JSON parse validated         | PASS   |
| Backup SHA256 recorded                            | PASS   |
| canonical exact39 regression exists               | PASS   |
| Shrine regeneration path confirmed                | PASS   |
| Goriyaku regeneration path confirmed              | PASS   |
| Knowledge regeneration path confirmed             | PASS   |
| Evidence Foundation schema regeneration confirmed | PASS   |
| migrate-in-place excluded                         | PASS   |

Final preflight status:

```text
FRESH DB REBUILD GATE = PASS
```

ただし、

```text
DESTRUCTIVE ACTION EXECUTED = NO
```

PR-A2ではDB破壊を行わない。

---

# 27. PR-A3 Preconditions

Fresh rebuildを開始する前に以下を再確認する。

```text
[ ] current branch / working tree確認
[ ] backup directory存在確認
[ ] full dump存在確認
[ ] user selective dump存在確認
[ ] user_state_shrine_semantic_map.json存在確認
[ ] user state restore前にShrine semantic identityを再解決
[ ] historical shrine_idとFresh shrine_idを未検証のままrestoreしない
[ ] knowledge provenance JSON存在確認
[ ] SHA256再照合
[ ] target DB = local jinja_db確認
[ ] Production DATABASE_URLが使用されていないことを確認
[ ] exact39 regression testがdevelopに存在することを確認
[ ] current developへ同期
```

上記を満たすまでdrop / recreateを行わない。

---

# 28. Scope-outs / Follow-up

以下は本PRでは扱わない。

```text
PR-A3
Fresh Local DB Rebuild

PR-A4
Desktop-only Development Contract / docs

PR-A5
legacy backend/temples/fixtures/goriyaku_tags.json
15-row taxonomy audit
```

また、Evidence Foundationはcurrent Recommendation runtimeへ接続しない。

今回のFresh rebuildは、

```text
既存runtimeをEvidence Foundationへ移行するPR
```

ではない。

---

# 29. Conclusion

historical local `jinja_db` には、

* current repositoryから再生成可能なdata
* historical test / taxonomy artifact
* Fresh rebuild前に保存が必要なUser state
* Fresh bootstrapでは自動再生成されないKnowledge provenance
* archiveとして保持すべきhistorical analytics

が混在していた。

本監査でこれらをA / B / Cへ分離し、

```text
UNKNOWN = 0
```

まで確認した。

破壊前に必要なB dataについて、

```text
full historical DB archive
User selective archive
User State Shrine semantic map
Knowledge provenance semantic JSON
```

をrepository外へ保存し、integrityとSHA256を確認した。

したがってPR-A2の範囲では、

```text
LOCAL DATA PRESERVATION PREFLIGHT = COMPLETE
FRESH REBUILD GATE = PASS
```

とする。

次工程はPR-A3 `Fresh Local DB Rebuild` とし、本PRではFresh rebuildそのものは開始しない。
