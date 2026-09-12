# Shrine Expansion Wave 0 DB01 Isolated Preflight

## Status

- Status: `PASS`
- Recorded at: `2026-09-12`
- Batch: `W0-DB01`
- Branch: `feature/w0-db01-data-build`
- Integration commit: `4f0e1bf7`
- Isolated DB: `jinja_w0_db01_preflight`
- Production DB write: `NONE`
- Production Import authorization: `NOT GRANTED`
- Production Import Gate: `SEPARATE`

---

## 1. Purpose

本Auditは、Wave 0 Data Build Batch `W0-DB01` の5社について、Productionへ投入する前にisolated PostgreSQL上で以下を確認し、Data PR作成可能な状態まで到達していることを記録する。

確認対象:

1. Base Shrine Seedが決定論的に成立する
2. 既存Shrine dataを意図せず変更しない
3. W0-DB01 5社がcanonical identityで追加される
4. `visit_style_tags` のFoundation Contractを維持する
5. `goriyaku_tags` がcanonical 39 tagのexplicit exact-setとして成立する
6. Knowledge Seedが安全にimport可能である
7. Knowledge importが再実行可能かつidempotentである
8. Source-backed FactがEvidence Gateを通過する
9. backend regressionにW0-DB01起因の新規failureがない
10. schema migration driftがない

本AuditのPASSはProduction Importの許可を意味しない。

Production writeは別のMother Ship Gateで判断する。

---

## 2. Target Shrines

W0-DB01の対象は以下の5社。

| Shrine | Batch |
|---|---|
| 三輪神社 | W0-DB01 |
| 大鳥大社 | W0-DB01 |
| 御岩神社 | W0-DB01 |
| 烏森神社 | W0-DB01 |
| 榴岡天満宮 | W0-DB01 |

Batch membershipはProduct priorityではなく、既存Audit順を保持したdeterministic groupingである。

---

## 3. Environment

PreflightはProduction DBではなく、以下のisolated DBで実施した。

```text
DB_HOST=127.0.0.1
DB_NAME=jinja_w0_db01_preflight
```

Production DBへのwriteは本Auditでは実施していない。

---

## 4. Preflight Gate Summary

| Gate | Result |
|---|---|
| Base Shrine Seed Build | PASS |
| Seed total | 108 |
| Duplicate identity | 0 |
| Duplicate id | 0 |
| Missing required | 0 |
| Identity mutation | 0 |
| Unexpected schema change | 0 |
| Unresolved prefecture | 0 |
| Seed `id` field rows | 0 |
| Visit Style managed | 103 |
| Visit Style unmanaged | 5 |
| Visit Style invalid | 0 |
| Contract test suite | PASS |
| Migration drift | NONE |
| Full backend regression | PASS WITH KNOWN BASELINE FAILURES |
| W0-caused new regression | 0 |
| Knowledge second real import | PASS |
| Knowledge unexpected CREATE | 0 |
| Knowledge idempotency | PASS |
| Explicit W0-DB01 Knowledge Coverage | 5 / 5 |
| Explicit W0-DB01 Source Coverage | 5 / 5 |
| Explicit W0-DB01 Deity Coverage | 5 / 5 |
| Explicit W0-DB01 History Coverage | 5 / 5 |
| Explicit W0-DB01 Fact-ready Coverage | 5 / 5 |
| Evidence Gate | PASS |
| Goriyaku exact-set | 5 / 5 PASS |
| Production write | NONE |

Final isolated preflight result:

```text
W0_DB01_ISOLATED_PREFLIGHT=PASS
```

---

## 5. Base Shrine Seed Build

Builder:

```text
scripts/build_base_shrine_seed.py
```

Canonical Seed:

```text
backend/temples/data/shrines_seed_clean.json
```

実行結果:

```text
TOTAL=108
DUPLICATE_IDENTITY=0
DUPLICATE_ID=0
MISSING_REQUIRED=0
PREFECTURES=31
SHA256=74720a7b897cc4da3567a55d05ae03725333e6244f678a2b776c265429ae558b
IDENTITY_MUTATION=0
SCHEMA_UNEXPECTED_CHANGE=0
PREFECTURE_UNRESOLVED=0
ID_FIELD_ROWS=0
VISIT_STYLE_MANAGED=103
VISIT_STYLE_UNMANAGED=5
VISIT_STYLE_INVALID=0
WRITTEN=0
BASE_SEED_BUILD=OK
```

Canonical W0-DB01 Base Seed SHA256:

```text
74720a7b897cc4da3567a55d05ae03725333e6244f678a2b776c265429ae558b
```

### Interpretation

既存103社はVisit Style managed cohortとして維持されている。

W0-DB01の新規5社は、未review状態を表現するため `visit_style_tags` keyを持たない。

Contract:

```text
visit_style_tags key absent
= unmanaged / unreviewed

visit_style_tags key present with 1..3 canonical tags
= managed

visit_style_tags key present with []
= invalid / fail closed
```

W0-DB01追加による既存103社のidentity mutationおよびunexpected schema changeは検出されなかった。

---

## 6. Contract Test Gate

以下の統合contract test群を実行した。

対象:

```text
test_base_shrine_seed_build_contract.py
test_import_shrines_seed_command.py
test_import_shrines_seed_goriyaku_tags.py
test_sync_visit_style_tags_from_seed.py
test_visit_style_legacy_drift_seed_contract.py
test_shrine_base_batch17_seed.py
test_wave0_db01_knowledge_seed.py
```

Result:

```text
121 passed
```

判定:

```text
W0_DB01_CONTRACT_GATE=PASS
```

このGateで以下を同時に確認した。

- 108-row Base Seed contract
- `goriyaku_tags` optional schema
- `visit_style_tags` optional schema
- managed / unmanaged Visit Style cohort
- explicit goriyaku exact-set importer contract
- unknown goriyaku tag fail-closed
- canonical GoriyakuTag master dependency
- Visit Style sync safety
- legacy drift contract
- Batch17 compatibility
- W0-DB01 Knowledge Seed contract

---

## 7. Migration Gate

実行:

```text
python manage.py makemigrations --check --dry-run
```

Result:

```text
No changes detected
```

判定:

```text
W0_DB01_MIGRATION_GATE=PASS
```

W0-DB01 Data Buildに伴う未生成migrationは存在しない。

---

## 8. Full Backend Regression

Full backend regressionを実行した。

Result:

```text
3172 passed
4 failed
13 skipped
```

### Known baseline failures

以下4件はW0-DB01統合前のdevelopでも確認済みのbaseline failure。

```text
temples/tests/test_concierge_api.py::test_radius_km_bias_passthrough
temples/tests/test_concierge_api.py::test_chat_backfills_short_location
temples/tests/test_concierge_api.py::test_candidate_formatted_address_is_used
temples/tests/test_restore_visit_style_tags_snapshot.py::test_missing_identity_aborts_without_writing
```

分類:

```text
KNOWN_BASELINE
W0_CAUSALITY=NONE
```

`test_restore_visit_style_tags_snapshot.py` のfailureは `temples_conciergehistory.shrine_id` に関するmodel / test DB schema driftであり、W0-DB01のSeed / Knowledge / goriyaku / Visit Style変更によるものではない。

Concierge API 3件についても既存baseline failureであり、本Data Build PRのscope外とする。

新規W0関連failure:

```text
0
```

判定:

```text
W0_DB01_FULL_REGRESSION_GATE=PASS
```

既知baseline issueは別タスクで扱う。

---

## 9. Knowledge Seed

Knowledge Seed:

```text
backend/temples/data/knowledge_seeds/wave0_batch_01_seed.json
```

構成:

```text
Sources   = 5
Deities   = 12
Histories = 7
Facts     = 19
```

対象FactはSource-backedかつhigh confidenceで構築されている。

---

## 10. Knowledge Real Import Idempotency

1回目real import後のisolated DBに対し、同一Knowledge Seedを2回目のreal modeで再importした。

Result:

```text
[source] REUSE_EXISTING = 5
[deity] SKIP_EXISTS = 12
[history] SKIP_EXISTS = 7
```

Summary:

```text
source_REUSE_EXISTING=5
deity_SKIP_EXISTS=12
history_SKIP_EXISTS=7
```

Apply result:

```text
sources created=0
deities created=0
histories created=0
```

Unexpected CREATE:

```text
0
```

Unexpected update:

```text
0
```

判定:

```text
W0_DB01_KNOWLEDGE_IDEMPOTENCY_GATE=PASS
```

同一Knowledge Seedを再実行しても、Source / Deity / Historyの重複生成は発生しなかった。

---

## 11. Knowledge Coverage

isolated DB全体のread-only Coverageを確認した。

Database:

```text
total_db_shrines=108
```

Knowledge:

```text
knowledge_coverage=5
source_coverage=5
deity_coverage=5
history_coverage=5
both_deity_and_history_coverage=5
zero_knowledge=103
```

Fact-ready:

```text
fact_ready_deity_shrines=5
fact_ready_history_shrines=5
fact_ready_any_shrines=5
```

Source:

```text
total_source_count=5
verified_source_count=5
source_type=shrine_official: 5
```

Facts:

```text
verification_status=source_confirmed: 19
confidence=high: 19
```

全体108社CoverageはW0-DB01以外の103社を含むため、最終Evidence判定にはW0-DB01 5社だけのexplicit scopeを使用した。

---

## 12. W0-DB01 Explicit Coverage

Explicit target resolution:

```text
三輪神社
大鳥大社
御岩神社
烏森神社
榴岡天満宮
```

Resolved:

```text
scope.mode=explicit
scope.count=5
resolved_in_db=5
outside_scope_count=103
```

Coverage:

```text
knowledge_coverage=5/5 = 100.0%
zero_knowledge=0/5 = 0.0%

deity_coverage=5/5 = 100.0%
history_coverage=5/5 = 100.0%
source_coverage=5/5 = 100.0%
both_deity_and_history_coverage=5/5 = 100.0%
```

Fact-ready Coverage:

```text
fact_ready_deity_shrines=5/5 = 100.0%
fact_ready_history_shrines=5/5 = 100.0%
fact_ready_any_shrines=5/5 = 100.0%
```

Source:

```text
verified_source_count=5
total_source_count=5
```

Facts:

```text
verification_status_distribution:
  source_confirmed=19

confidence_distribution:
  high=19

source_type_distribution:
  shrine_official=5
```

判定:

```text
W0_DB01_EVIDENCE_GATE=PASS
```

対象5社すべてにSource-backedかつFact-readyなDeity / History Knowledgeが存在する。

---

## 13. Goriyaku Exact-set Gate

Canonical Base Seedの`goriyaku_tags`をexpected setとし、isolated DB上の`Shrine.goriyaku_tags` M2M actual setと比較した。

### 三輪神社

```text
expected=['厄除け']
actual=['厄除け']
status=PASS
```

### 大鳥大社

```text
expected=[
  '勝運',
  '厄除け',
  '合格祈願',
  '商売繁盛',
  '安産',
  '家内安全'
]

actual=[
  '勝運',
  '厄除け',
  '合格祈願',
  '商売繁盛',
  '安産',
  '家内安全'
]

status=PASS
```

### 御岩神社

```text
expected=[
  '厄除け',
  '商売繁盛',
  '安産',
  '家内安全',
  '病気平癒',
  '縁結び',
  '開運'
]

actual=[
  '厄除け',
  '商売繁盛',
  '安産',
  '家内安全',
  '病気平癒',
  '縁結び',
  '開運'
]

status=PASS
```

### 烏森神社

```text
expected=[
  '勝運',
  '商売繁盛',
  '家内安全',
  '技芸上達'
]

actual=[
  '勝運',
  '商売繁盛',
  '家内安全',
  '技芸上達'
]

status=PASS
```

### 榴岡天満宮

```text
expected=[
  '交通安全',
  '厄除け',
  '合格祈願',
  '商売繁盛',
  '学業成就',
  '安産'
]

actual=[
  '交通安全',
  '厄除け',
  '合格祈願',
  '商売繁盛',
  '学業成就',
  '安産'
]

status=PASS
```

Final:

```text
GORIYAKU_EXACT_SET_GATE=PASS
```

5社すべてでBase Seed expected setとDB actual setが完全一致した。

新規GoriyakuTagの自動生成は行っていない。

---

## 14. Existing Data Safety

本Preflightでは以下を確認した。

```text
duplicate identity=0
identity mutation=0
unexpected schema change=0
migration drift=0
W0-caused regression=0
Knowledge duplicate CREATE=0
goriyaku exact-set mismatch=0
```

既存103社のVisit Style managed cohortは維持された。

W0-DB01新規5社については `visit_style_tags`を未review状態のまま保持し、推測による自動付与を行っていない。

---

## 15. Production Safety Boundary

本Auditで実施したDB writeはisolated DBのみ。

```text
jinja_w0_db01_preflight
```

Production DB:

```text
WRITE=NONE
```

本Data PRのmergeはProduction Import authorizationを意味しない。

以下は別Gateとする。

```text
Data PR review
→ Data PR merge
→ Mother Ship Production Import decision
→ Production preflight
→ Production write
→ Production post-write reconciliation
```

Render無料枠にはshellがないため、Production Import方法は既存のProduction write手順に従って別途確定する。

---

## 16. Final Decision

W0-DB01について、isolated DB上で要求されたData Build / Import / Evidence / Idempotency / Regression Gateを満たした。

Final result:

```text
BASE_SEED_BUILD=PASS
CONTRACT_TEST_GATE=PASS
MIGRATION_GATE=PASS
FULL_REGRESSION_GATE=PASS
KNOWLEDGE_IDEMPOTENCY_GATE=PASS
EVIDENCE_GATE=PASS
GORIYAKU_EXACT_SET_GATE=PASS

W0_DB01_NEW_REGRESSION=0
PRODUCTION_WRITE=NONE

W0_DB01_ISOLATED_PREFLIGHT=PASS
```

---

## 17. Known Out-of-Scope Issues

以下は本Data Buildとは分離して扱う。

### Concierge API baseline failures

```text
test_radius_km_bias_passthrough
test_chat_backfills_short_location
test_candidate_formatted_address_is_used
```

### ConciergeHistory schema/model drift

```text
test_restore_visit_style_tags_snapshot.py
::test_missing_identity_aborts_without_writing
```

Error:

```text
column temples_conciergehistory.shrine_id does not exist
```

いずれもW0-DB01 causalityは確認されていないため、本Data PRでは修正しない。

---

## 18. Next Gate

Isolated Preflight PASS後の次工程:

```text
1. 本Auditをcommit
2. feature/w0-db01-data-buildをpush
3. W0-DB01 Data PRを作成
4. PR review
5. merge判断
6. Production Import Gateを別途実施
```

Production Importは本Auditのscope外であり、Mother Shipの明示判断なしに実施しない。
