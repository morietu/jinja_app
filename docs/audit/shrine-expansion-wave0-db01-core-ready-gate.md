# W0-DB01 CORE READY Gate 実測

## Status

- Batch: `W0-DB01`
- Recorded at: `2026-09-13`
- CORE READY Evidence Gate: `PASS`
- Production post-import QA: `PASS`
- Candidate lifecycle before transition: `IMPORTED`
- `knowledge_status`: `FACT_READY`
- Candidate lifecycle after transition: `CORE_READY`
- CORE_READY transition: `APPLIED`

```text
W0_DB01_CORE_READY_EVIDENCE_GATE  = PASS
W0_DB01_COMPLETION_CONTRACT       = 12/12 PASS
W0_DB01_POST_IMPORT_QA            = PASS
W0_DB01_PRE_TRANSITION_ALIGNMENT  = PASS
W0_DB01_POST_TRANSITION_ALIGNMENT = PASS
CANDIDATE_STATUS_TRANSITION       = APPLIED
```

PRE_TRANSITION 記録時点では `candidate_status = IMPORTED` であり、本 transition で W0-DB01 5社のみを `CORE_READY` へ同期した。

#1〜#11 の Production / Runtime Evidence は確定済みであり、#12 は Candidate Master の Governance state を同期するための Synchronization Gate として遷移前後を分けて評価する。

---

## 1. Purpose

`docs/audit/shrine-expansion-wave0-data-build-plan.md` の CORE READY Completion Contract 12条件について、W0-DB01 の5社に対する Production 実測と post-import QA を repo 内の永続 Audit として固定する。

PRE_TRANSITION 時点で #1〜#11 は FINAL PASS、#12 は `PRE_TRANSITION PASS / POST_TRANSITION PENDING` だった。本 transition で `IMPORTED -> CORE_READY` の Governance Synchronization と minimal-diff verification が完了したため、Completion Contract を `12/12 PASS` と確定する。

Data Build Plan が定める `CORE READY候補` と `CORE READY` の境界を、Evidence と Governance state の2段階に分けて記録することが本 Audit の目的である。

---

## 2. Scope

### 2.1 対象5社

- 三輪神社
- 大鳥大社
- 御岩神社
- 烏森神社
- 榴岡天満宮

### 2.2 Production identity

| Production `id` | `name_jp` | `address` |
|---:|---|---|
| 109 | 三輪神社 | 愛知県名古屋市中区大須3-9-32 |
| 110 | 大鳥大社 | 大阪府堺市西区鳳北町1-1-2 |
| 111 | 御岩神社 | 茨城県日立市入四間町752 |
| 112 | 烏森神社 | 東京都港区新橋2-15-5 |
| 113 | 榴岡天満宮 | 宮城県仙台市宮城野区榴ケ岡105-3 |

Production `id` は identity contract ではない。canonical identity は `(name_jp, address)` である。`id` は W0-DB01 post-write reconciliation 時点の provenance 値であり、DB restore / migration / environment rebuild 後も不変であることは保証しない。

---

## 3. CORE READY Completion Contract 12条件

### #1 Production Shrine canonical identity

> Production `Shrine` row が canonical `name_jp + address` で一意に存在する。

```text
Production Shrine   = 108
W0-DB01 exact match = 5
missing             = 0
duplicate identity  = 0
```

5社すべて canonical `(name_jp, address)` で一意に解決済み。

出典: `docs/audit/shrine-expansion-wave0-db01-production-import.md` §3.3

**判定: `PASS`**

---

### #2 latitude / longitude

> 採用済み `latitude / longitude` が保存されている。

Production 実測値と Candidate Master の期待値を exact 照合した。

| `id` | Shrine | `latitude` | `longitude` | Candidate Master |
|---:|---|---:|---:|---|
| 109 | 三輪神社 | 35.1608797 | 136.9054313 | exact 一致 |
| 110 | 大鳥大社 | 34.5367778 | 135.4608611 | exact 一致 |
| 111 | 御岩神社 | 36.63604985 | 140.58558306 | exact 一致 |
| 112 | 烏森神社 | 35.666443 | 139.756134 | exact 一致 |
| 113 | 榴岡天満宮 | 38.260624 | 140.893021 | exact 一致 |

```text
W0_DB01_LAT_LNG_PRODUCTION_GATE = PASS
```

Source Packet Freeze で凍結した Position がそのまま Production に入っている。

**判定: `PASS`**

---

### #3 Source-backed ShrineKnowledgeSource

> Source-backed な `ShrineKnowledgeSource` が存在する。

```text
Source Coverage              = 5/5
Verified Source Count        = 5
Total Source Count           = 5
source_type=shrine_official  = 5
```

`Verified Source Count = Total Source Count = 5`。5件すべてが `shrine_official` であり、Source Packet Freeze の公式 Source と整合する。

出典: `docs/audit/shrine-expansion-wave0-db01-production-import.md` §5.3

**判定: `PASS`**

---

### #4 Fact-ready Deity / History

> 少なくとも1件の `ShrineDeity` または `ShrineHistory` が Fact-ready である。

```text
Deity Coverage       = 5/5
History Coverage     = 5/5
Fact-ready Deity     = 5/5
Fact-ready History   = 5/5
Fact-ready Any       = 5/5
```

Contract は「少なくとも1件」を要求するが、実測は Deity / History の両方が5/5で Fact-ready である。

出典: `docs/audit/shrine-expansion-wave0-db01-production-import.md` §5.1 / §5.2

**判定: `PASS`**

---

### #5 Fact-ready Source relation / Evidence Gate

> 上記 Fact に少なくとも1件の Fact-ready Source relation があり、Evidence Gate で `usable=True` となる。

```text
verification_status=source_confirmed = 19
confidence=high                     = 19
deities 12 + histories 7            = 19
```

5社すべてで usable Knowledge を確認済み。Fact 総数19と `source_confirmed` 19、`confidence=high` 19が一致する。

出典: `docs/audit/shrine-expansion-wave0-db01-production-import.md` §5.3

**判定: `PASS`**

---

### #6 Shrine.goriyaku

> `Shrine.goriyaku` は Source-backed Review で承認した意味だけを保持する。

Production 値と Candidate Master を exact 照合した。

| Shrine | `goriyaku` |
|---|---|
| 三輪神社 | 厄除け |
| 大鳥大社 | 家内安全・厄除け・安産・勝運・合格祈願・商売繁盛 |
| 御岩神社 | 安産・家内安全・厄除け・開運・病気平癒・商売繁盛・縁結び |
| 烏森神社 | 商売繁盛・技芸上達・家内安全・勝運 |
| 榴岡天満宮 | 合格祈願・学業成就・厄除け・安産・交通安全・商売繁盛 |

5社すべて exact 一致。

```text
W0_DB01_GORIYAKU_PRODUCTION_GATE = PASS
```

**判定: `PASS`**

---

### #7 goriyaku_tags canonical exact-set

> `Shrine.goriyaku_tags` は既存39 canonical `GoriyakuTag` の安全な subset だけを保持する。

```text
GORIYAKU_TAG_MASTER_TOTAL = 39
```

| Shrine | Production `goriyaku_tags` | 件数 |
|---|---|---:|
| 三輪神社 | 厄除け | 1 |
| 大鳥大社 | 勝運 / 厄除け / 合格祈願 / 商売繁盛 / 安産 / 家内安全 | 6 |
| 御岩神社 | 厄除け / 商売繁盛 / 安産 / 家内安全 / 病気平癒 / 縁結び / 開運 | 7 |
| 烏森神社 | 勝運 / 商売繁盛 / 家内安全 / 技芸上達 | 4 |
| 榴岡天満宮 | 交通安全 / 厄除け / 合格祈願 / 商売繁盛 / 学業成就 / 安産 | 6 |

Production M2M と Candidate Master を set 比較し、5/5 exact 一致。

```text
1 + 6 + 7 + 4 + 6 = 24
Candidate Master goriyaku_tags total = 24
Base Import goriyaku added_links      = 24
W0_DB01_GORIYAKU_TAGS_EXACT_SET_GATE = PASS
```

**判定: `PASS`**

---

### #8 新規 GoriyakuTag 自動生成なし

> 新規 `GoriyakuTag` を自動生成しない。

```text
Production Import 前後 : GoriyakuTag total = 39 -> 39
本 Gate での再確認      : GORIYAKU_TAG_MASTER_TOTAL = 39
```

canonical master 外の tag は生成されていない。

**判定: `PASS`**

---

### #9 Shared Recommendation Eligibility / candidate path

> Concierge の shared eligibility / scoring candidate path で当該 Shrine を読み取れる。

#### 9.1 Shared eligibility

`filter_recommendation_eligible_candidates()` で5社すべて eligible。

| `id` | Shrine | `ELIGIBLE` |
|---:|---|---:|
| 109 | 三輪神社 | 1 |
| 110 | 大鳥大社 | 1 |
| 111 | 御岩神社 | 1 |
| 112 | 烏森神社 | 1 |
| 113 | 榴岡天満宮 | 1 |

```text
W0_DB01_SHARED_RECOMMENDATION_ELIGIBILITY_GATE = PASS
```

#### 9.2 Shared candidate path

`build_chat_candidates_with_eligibility(limit=200)` を Production に対して実行。

```text
SOURCE_COUNT     = 108
ELIGIBLE_COUNT   = 94
INELIGIBLE_COUNT = 14
```

W0-DB01 5社はすべて `CANDIDATE_PATH=1`。

```text
W0_DB01_SHARED_CANDIDATE_PATH_GATE = PASS
```

`94 / 108` という全体件数そのものは W0-DB01 の品質指標として扱わない。本条件の根拠は W0-DB01 5社が shared eligibility と shared candidate path を全件通過したことのみ。

**判定: `PASS`**

---

### #10 Compass distance / direction

> Shared eligibility 通過後、Production 座標から Compass の distance / direction 計算が成立する。

QA 固定 origin:

```text
latitude  = 35.681236
longitude = 139.767125
```

これは calculation availability を確認する固定入力であり、実ユーザー位置でも推薦結果でもない。

Direction profile:

```text
source               = calculated
calculationMethod    = annual_monthly_kyusei_v1
visitDate            = 2026-09-13
reference directions = 8方位すべて
```

| Shrine | `distance_m` | `direction` | `DISTANCE` | `DIRECTION` |
|---|---:|---|---:|---:|
| 三輪神社 | 265,676 | 西 | 1 | 1 |
| 大鳥大社 | 411,823 | 西 | 1 | 1 |
| 御岩神社 | 129,116 | 北東 | 1 | 1 |
| 烏森神社 | 1,921 | 南西 | 1 | 1 |
| 榴岡天満宮 | 303,747 | 北 | 1 | 1 |

```text
W0_DB01_COMPASS_DISTANCE_DIRECTION_GATE = PASS
```

60kmを超える Shrine が存在することは本条件の FAIL ではない。本条件が要求するのは「任意の固定 origin から推薦対象になること」ではなく、「保存座標から distance / direction 計算が成立すること」である。距離による候補除外は別 runtime 責務である。

**判定: `PASS`**

---

### #11 Import idempotency

> Import 再実行時に unexpected CREATE / UPDATE が発生しない。

#### 11.1 Knowledge idempotency

```text
source_REUSE_EXISTING = 5
deity_SKIP_EXISTS      = 12
history_SKIP_EXISTS    = 7
CREATE                 = 0
KNOWLEDGE_IDEMPOTENCY  = PASS
```

#### 11.2 Base idempotency

Candidate Master の W0-DB01 membership と canonical Base Seed から5社だけを mechanical に抽出した ephemeral subset を用いた。

```text
subset file = /tmp/w0_db01_base_seed.json
subset rows = 5
```

Production `--dry-run`:

```text
SKIP id=109 三輪神社   / GORIYAKU_TAGS SKIP already_exact
SKIP id=110 大鳥大社   / GORIYAKU_TAGS SKIP already_exact
SKIP id=111 御岩神社   / GORIYAKU_TAGS SKIP already_exact
SKIP id=112 烏森神社   / GORIYAKU_TAGS SKIP already_exact
SKIP id=113 榴岡天満宮 / GORIYAKU_TAGS SKIP already_exact

goriyaku_tags rows=5 updated=0 added_links=0 removed_links=0
done created=0 updated=0 skipped=5 total_seed=5
```

```text
BASE_IDEMPOTENCY              = PASS
W0_DB01_SUBSET_IDEMPOTENCY    = PASS
FULL_SEED_PRODUCTION_APPLY    = BLOCKED
```

`FULL_SEED_PRODUCTION_APPLY=BLOCKED` は既存66行 drift の別問題であり、W0-DB01 subset idempotency の PASS を否定しない。

**判定: `PASS`**

---

### #12 Candidate Master / Production alignment

> Candidate Master 上でも Production 状態と整合する。

#### 12.1 本条件の役割

#12 は #1〜#11 と独立した Production Evidence を追加する条件ではない。

#1〜#11 によって確認された Production / Runtime readiness を、Candidate Master の Governance state が正しく表現していることを確認する **Synchronization Gate** である。

#### 12.2 PRE_TRANSITION

以下を確認済み。

- W0-DB01 5社が `candidate_status = IMPORTED`
- `knowledge_status = FACT_READY`
- `build_batch = W0-DB01`
- Production Base / Knowledge import 済み状態と整合

```text
W0_DB01_PRE_TRANSITION_ALIGNMENT = PASS
```

#### 12.3 POST_TRANSITION

以下をすべて満たした場合のみ PASS とする。

1. W0-DB01対象5社だけが `candidate_status: IMPORTED -> CORE_READY` へ変更されている
2. 対象5社の `candidate_status` 以外の既存 field が意図せず変更されていない
3. `knowledge_status = FACT_READY` が5社すべて保持されている
4. `build_batch = W0-DB01` が5社すべて保持されている
5. identity / official source / coordinates / goriyaku / goriyaku_tags / duplicate_status / status_reason_code 等の既存 provenance field が保持されている
6. W0-DB01以外の candidate row が変更されていない
7. `candidate_defaults` が変更されていない
8. lifecycle件数の delta が `IMPORTED -5 / CORE_READY +5 / TOTAL ±0` となり、その他 status 件数は不変
9. CORE_READY を `build_batch` 保持対象として扱う test が PASS する
10. #1〜#11 の Production Evidence は再解釈・書き換えされていない

POST_TRANSITION 実測結果:

```text
W0_DB01_POST_TRANSITION_ALIGNMENT = PASS
CANDIDATE_STATUS_TRANSITION       = APPLIED
```

#### 12.4 Completion Contract を閉じる条件

上記 POST_TRANSITION 10条件をすべて満たした場合のみ:

```text
W0_DB01_POST_TRANSITION_ALIGNMENT = PASS
W0_DB01_COMPLETION_CONTRACT       = 12/12 PASS
CANDIDATE_STATUS_TRANSITION       = APPLIED
```

**#12 判定: `PRE_TRANSITION PASS / POST_TRANSITION PASS`**

#### 12.5 POST_TRANSITION 実測

- changed candidate IDs: `wave0-001 / 002 / 003 / 005 / 006` の5社のみ
- changed field: `candidate_status` のみ
- transition: `IMPORTED -> CORE_READY`
- `knowledge_status = FACT_READY` を5社すべて保持
- `build_batch = W0-DB01` を5社すべて保持
- W0-DB01外 candidate row: diff なし
- `candidate_defaults`: diff なし
- lifecycle: `BUILD_READY 30 / CORE_READY 5 / HOLD 8 / REVIEW 1 / TOTAL 44`
- lifecycle delta: `IMPORTED -5 / CORE_READY +5 / TOTAL ±0`
- Candidate Master contract tests: `11 passed`
- Production再接続・再write: なし
- #1〜#11 Production / Runtime Evidence: 判定変更なし

---

## 4. 最終 Gate

```text
W0_DB01_CORE_READY_EVIDENCE_GATE  = PASS
W0_DB01_COMPLETION_CONTRACT       = 12/12 PASS
W0_DB01_POST_IMPORT_QA            = PASS
W0_DB01_PRE_TRANSITION_ALIGNMENT  = PASS
W0_DB01_POST_TRANSITION_ALIGNMENT = PASS
CANDIDATE_STATUS_TRANSITION       = APPLIED
```

| # | 条件 | 判定 |
|---:|---|---|
| 1 | Production Shrine canonical identity | `PASS` |
| 2 | latitude / longitude | `PASS` |
| 3 | Source-backed ShrineKnowledgeSource | `PASS` |
| 4 | Fact-ready Deity / History | `PASS` |
| 5 | Fact-ready Source relation / Evidence Gate | `PASS` |
| 6 | `Shrine.goriyaku` | `PASS` |
| 7 | `goriyaku_tags` canonical exact-set | `PASS` |
| 8 | 新規 GoriyakuTag 自動生成なし | `PASS` |
| 9 | Shared Recommendation Eligibility / candidate path | `PASS` |
| 10 | Compass distance / direction | `PASS` |
| 11 | Import idempotency | `PASS` |
| 12 | Candidate Master / Production alignment | `PASS` |

#1〜#11 は FINAL PASS を維持し、今回の lifecycle transition では判定を再解釈・変更していない。

#12 の Governance Synchronization と minimal-diff verification は完了した。`W0_DB01_POST_TRANSITION_ALIGNMENT = PASS`、Completion Contract は `12/12 PASS`、transition は `APPLIED` とする。

---

## 5. Provenance / 限界

推測で補完しない。

```text
PRODUCTION_RECONNECT = NONE
VALUE_COMPLETION     = NONE
```

Production read-only 確認は Mother Ship がローカル Mac から実行した。Codex 環境から Production へは再接続していない。

### 5.1 NOT_RECORDED

| 項目 | 記録 |
|---|---|
| 本 CORE READY QA の各 command 実行 UTC instant | `NOT_RECORDED` |
| Production DB identifier | `NOT_RECORDED` |

いずれも新たに推測しない。

### 5.2 Production `id`

Production `id` は identity ではない。identity は `(name_jp, address)`。`id` は W0-DB01 post-write reconciliation 時点の provenance 値である。

### 5.3 QA origin

`(35.681236, 139.767125)` は Compass calculation availability を確認する固定入力であり、実ユーザー位置でも推薦結果でもない。

### 5.4 Shared candidate 全体件数

```text
SOURCE_COUNT     = 108
ELIGIBLE_COUNT   = 94
INELIGIBLE_COUNT = 14
```

観測値としてのみ記録する。ineligible 14社の原因分析は本 Audit の scope 外である。W0-DB01 5社はいずれも eligible 側に含まれる。

---

## 6. Known separate issues

以下は CORE READY Evidence Gate を block しない別問題である。

### 6.1 Full canonical Base Seed drift

canonical Base Seed 全体の dry-run では既存 Production 66行が UPDATE 対象になる。

```text
FULL_SEED_PRODUCTION_APPLY = BLOCKED
```

Production Base Seed Drift audit へ分離する。本 Audit の #11 は W0-DB01 subset 5行の idempotency のみを主張しており、この drift を解決したとは主張しない。

### 6.2 Production read-only verifier の自動化が無い

本 Audit の実測は手動実行の結果であり、再利用可能な automated read-only verifier はまだ存在しない。W0-DB02 前の Pipeline Hardening task として分離する。

### 6.3 W0-DB01 の visit_style_tags は未レビュー

W0-DB01 5社の `visit_style_tags` は未レビュー / unmanaged のままである。現行 CORE READY Completion Contract の条件ではなく、推測・補完で付与しない。

---

## 7. 本 Audit が変更していないもの

```text
backend/temples/data/shrine_expansion_candidate_master.json   変更なし
backend/temples/tests/                                        変更なし
docs/knowledge/ の contract                                   変更なし
Base Seed / Knowledge Seed                                    変更なし
Production DB                                                 再接続なし / write なし
Recommendation eligibility logic                              変更なし
Compass logic / Concierge / Ranking / scoring                  変更なし
migrations                                                    追加なし
W0-DB02 以降                                                   変更なし
```

本タスクで追加するのは本 Audit 1ファイルのみ。

---

## 8. 関連 Audit / Contract

| 文書 | 関係 |
|---|---|
| `docs/audit/shrine-expansion-wave0-data-build-plan.md` | CORE READY Completion Contract 12条件の正本 |
| `docs/audit/shrine-expansion-wave0-db01-production-import.md` | #1 / #3 / #4 / #5 / #8 / #11 の Production 実測出典 |
| `docs/audit/shrine-expansion-wave0-db01-source-packet-freeze.md` | #2 / #6 の Position / Source 凍結 |
| `docs/audit/shrine-expansion-wave0-db01-isolated-preflight.md` | Production write 前の isolated 検証 |
| `docs/knowledge/recommendation-eligibility-contract.md` | #9 の shared eligibility 単一責務 |
| `docs/knowledge/shrine-expansion-candidate-master-contract.md` | `IMPORTED` / `FACT_READY` / `CORE_READY` / `build_batch` の定義 |

---

## Non-Goals

- `candidate_status` の `CORE_READY` への変更
- Production DB への再接続・再測定
- Production Base Seed drift 66行の修正
- ineligible 14社の原因分析
- `visit_style_tags` の推測・補完
- Candidate Master / tests / contract / runtime の変更
- W0-DB02 以降の status 変更
