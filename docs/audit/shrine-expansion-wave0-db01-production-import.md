# W0-DB01 Production Import 実測

## Status

- Status: `IMPORTED`
- Recorded at: `2026-09-13`
- Batch: `W0-DB01`
- Scope: 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
- Base Production Import: `SUCCESS`
- Knowledge Production Import: `SUCCESS`
- Knowledge idempotency: `PASS`
- Production Coverage: `PASS 5/5`
- Candidate lifecycle: `BUILD_READY -> IMPORTED`
- `knowledge_status`: `FACT_READY`
- CORE_READY: **`NOT YET DETERMINED`**
- Full canonical Base Seed Production apply: **`BLOCKED`**（別Audit）

```text
W0_DB01_BASE_IMPORT        = SUCCESS
W0_DB01_KNOWLEDGE_IMPORT   = SUCCESS
W0_DB01_KNOWLEDGE_IDEMPOTENT = PASS
W0_DB01_COVERAGE           = PASS 5/5
W0_DB01_LIFECYCLE          = IMPORTED
W0_DB01_KNOWLEDGE_STATUS   = FACT_READY
W0_DB01_CORE_READY         = NOT_YET_DETERMINED
```

---

## 1. Purpose

`backend/temples/data/shrine_expansion_candidate_master.json` において W0-DB01 の
5社を `candidate_status = IMPORTED` / `knowledge_status = FACT_READY` へ昇格させた
根拠となる **Production 実測値** を、repo 内の永続 Audit として固定する。

この文書が無い場合、昇格根拠は commit message と PR 本文にしか存在せず、
後から再検証できない。W0-DB02 以降で同じ判断を再現するための基準でもある。

本 Audit は Production 実測の**記録**であり、再実行・再接続の記録ではない。

---

## 2. Provenance / 記録の限界

本 Audit に記載する数値は、Mother Ship が Production に対して実行した結果として
提供されたものである。Codex 環境から Production へ接続して再測定してはいない。

```text
PRODUCTION_RECONNECT   = NONE
VALUE_COMPLETION       = NONE（実測していない値は補完していない）
```

以下は提供されておらず、**推測で補完しない**。

| 項目 | 記録 |
|---|---|
| Import 実行日時（UTC instant） | `NOT_RECORDED` |
| 実行 operator | `NOT_RECORDED` |
| Production DB identifier | `NOT_RECORDED` |
| deploy 時の application commit | `NOT_RECORDED` |

各 Shrine の Production `id` は実測済みである（§3.4 Production identity mapping）。

W0-DB02 以降では、`NOT_RECORDED` の4項目も実行時点で併せて記録することを推奨する。

---

## 3. Base Shrine Production Import

### 3.1 pre-write

```text
Production Shrine        = 103
GoriyakuTag              = 39
W0-DB01 exact match      = 0
W0-DB01 missing          = 5
duplicate identity       = 0
Backup/restore verification = PASS
```

`W0 exact = 0 / missing = 5` は、この時点で5社がいずれも Production に存在せず、
Import が純粋な CREATE であることを意味する。`duplicate = 0` により、
`(name_jp, address)` identity の衝突が無いことも確認されている。

### 3.2 Import 結果

```text
created         = 5
updated         = 0
skipped         = 0
goriyaku added_links   = 24
goriyaku removed_links = 0
```

`updated = 0` が本 Import の安全性の中核である。既存103社の payload を
1行も書き換えずに5社だけを追加した、という意味になる。

`removed_links = 0` により、既存の Shrine-GoriyakuTag 関連も1件も外していない。

### 3.3 post-write

```text
Production Shrine        = 108
GoriyakuTag              = 39
W0-DB01 exact match      = 5
W0-DB01 missing          = 0
duplicate identity       = 0
```

`GoriyakuTag = 39 -> 39` は、canonical master（id 1..39）が Import で
拡張されていないことを示す。5社の `goriyaku_tags` はすべて既存 canonical tag
への link として解決された。

### 3.4 Production identity mapping

Import で CREATE された5行の Production `id` は実測済みである。

| Production `id` | `name_jp` | `address` |
|---|---|---|
| 109 | 三輪神社 | 愛知県名古屋市中区大須3-9-32 |
| 110 | 大鳥大社 | 大阪府堺市西区鳳北町1-1-2 |
| 111 | 御岩神社 | 茨城県日立市入四間町752 |
| 112 | 烏森神社 | 東京都港区新橋2-15-5 |
| 113 | 榴岡天満宮 | 宮城県仙台市宮城野区榴ケ岡105-3 |

```text
W0_DB01_PRODUCTION_IDS = 109, 110, 111, 112, 113
```

この Production `id` mapping は **W0-DB01 post-write reconciliation で観測した
時点の値**であり、将来の DB restore / migration / environment rebuild 後も
不変であることは保証しない。`id` は sequence 由来の provenance 値であって
契約値ではない。identity は引き続き `(name_jp, address)` であり、
`id` を identity として扱わない。

`address` は5件とも Candidate Master の `official_address` と exact 一致する
（`backend/temples/data/shrine_expansion_candidate_master.json`、
`wave0-001 / 002 / 003 / 005 / 006`）。Shrine identity は
`(name_jp, address)` であるため、この一致は Import が Source Packet Freeze で
凍結した identity のまま Production へ入ったことを意味する。

#### `id` と件数は一致しない

```text
post-write Shrine 件数 = 108
割り当てられた id      = 109..113
```

`id` は sequence 由来であり行数ではない。Wave0 では
`temples.0105_w0b02t02_remove_qa_artifact_id102` で監査済み QA artifact
（`Shrine id=102`）を削除しており、sequence は削除で巻き戻らない。
したがって `id` の最大値が件数を上回るのは期待どおりの状態である。

`id` を Shrine identity として扱ってはならない。Base Seed は `id` を field に
持たず（W0-B01 の決定）、`import_shrines_seed` / Knowledge Seed の
`shrine_ref` 解決はいずれも `(name_jp, address)` で行う。本 mapping は
Production 上の行を特定するための **provenance 記録**であって、
identity contract の変更ではない。

### 3.5 repo 内での cross-check

`added_links = 24` は Candidate Master 側の値と一致する。

| Candidate | `goriyaku_tags` 件数 |
|---|---|
| 三輪神社 | 1 |
| 大鳥大社 | 6 |
| 御岩神社 | 7 |
| 烏森神社 | 4 |
| 榴岡天満宮 | 6 |
| **合計** | **24** |

```text
103 + created 5        = 108   ... post-write Shrine と一致
Candidate Master 合計 24 = added_links 24
```

Production 値と repo 内 canonical source が独立に一致しており、
`added_links` が意図した exact-set であることを支持する。

---

## 4. Knowledge Production Import

### 4.1 validate-only

```text
validate-only = PASS
```

### 4.2 dry-run（1回目）

```text
source_CREATE  = 5
deity_CREATE   = 12
history_CREATE = 7
```

### 4.3 Production Import

```text
sources created   = 5
deities created   = 12
histories created = 7
```

dry-run の CREATE 件数と Import の created 件数が完全一致している。
dry-run が実際の write を正しく予測していた、という意味である。

### 4.4 dry-run（2回目 / Import 後）

```text
source_REUSE_EXISTING = 5
deity_SKIP_EXISTS     = 12
history_SKIP_EXISTS   = 7
CREATE                = 0
```

`CREATE = 0` により idempotency が成立している。Knowledge Import を再実行しても
重複 Fact を作らない。

```text
W0_DB01_KNOWLEDGE_IDEMPOTENT = PASS
```

---

## 5. Production Coverage 実測

対象は explicit scope の5社のみ。Production 全体の Coverage ではない。

```text
explicit scope         = 5
```

### 5.1 Coverage

| 指標 | 実測 |
|---|---|
| Knowledge Coverage | 5/5 |
| Zero Knowledge | 0 |
| Deity Coverage | 5/5 |
| History Coverage | 5/5 |
| Source Coverage | 5/5 |
| Both Deity and History | 5/5 |

### 5.2 Fact-ready

| 指標 | 実測 |
|---|---|
| Fact-ready Deity | 5/5 |
| Fact-ready History | 5/5 |
| Fact-ready Any | 5/5 |

### 5.3 Source / Evidence

| 指標 | 実測 |
|---|---|
| Verified Source Count | 5 |
| Total Source Count | 5 |
| `verification_status = source_confirmed` | 19 |
| `confidence = high` | 19 |
| `source_type = shrine_official` | 5 |

```text
Verified Source Count 5 = Total Source Count 5
  -> 未検証 Source = 0

deities 12 + histories 7 = 19
  -> source_confirmed 19 と一致
  -> confidence high 19 と一致
  -> 5社の全 Fact が source-backed かつ high confidence
```

`source_type` は5件すべて `shrine_official` であり、W0-DB01 Source Packet Freeze
（`docs/audit/shrine-expansion-wave0-db01-source-packet-freeze.md`）が
固定した公式 Source と整合する。

---

## 6. Lifecycle 判定

```text
W0-DB01 candidate_status = IMPORTED
W0-DB01 knowledge_status = FACT_READY
W0-DB01 build_batch      = W0-DB01（不変）
CORE_READY               = NOT YET DETERMINED
```

### 6.1 IMPORTED の根拠

Base Shrine と、そのBatchで必要な Knowledge data が Production へ write 済みで
ある（§3 / §4）。`candidate_status = IMPORTED` はここまでしか主張しない。

### 6.2 FACT_READY の根拠

Production 上で usable Knowledge が確認された（§5）。Deity / History / Source の
Coverage と Fact-ready 判定がすべて 5/5 で揃い、19 Fact すべてが
`source_confirmed` / `high` である。

`knowledge_status = FACT_READY` は W0-DB01 の**行レベル override** として
Candidate Master へ書く。`candidate_defaults` は
`ACQUISITION_PATH_CONFIRMED` のまま据え置く（defaults を昇格させると、
未 import の39社まで「Production 上で usable Knowledge が確認済み」と読める）。

### 6.3 CORE_READY を主張しない

本 Audit は CORE_READY を主張しない。

```text
W0_DB01_CORE_READY = NOT_YET_DETERMINED
```

CORE READY の判定は
`docs/audit/shrine-expansion-wave0-data-build-plan.md` の
CORE READY Completion Contract 側が行う。Import 完了と Coverage 5/5 は
その必要条件の一部であって、十分条件ではない。

`IMPORTED` / `FACT_READY` はいずれも Recommendation eligibility を意味しない。

---

## 7. Known separate issue: Production Base Seed drift

本 Import は W0-DB01 の5社だけを対象とした。**canonical Base Seed 全体の
Production apply は別問題として BLOCKED のままである。**

```text
full canonical Base Seed dry-run
  -> 既存 Production 行 66件が updated 対象になる

FULL_SEED_PRODUCTION_APPLY = BLOCKED
```

つまり Production の既存行は canonical Base Seed と一致しておらず、
Seed 全体を apply すると 66行を書き換えることになる。

この drift は本 PR では修正しない。

```text
SCOPE_OF_THIS_AUDIT = W0-DB01 5社の Import 実測の記録のみ
DRIFT_FIX           = NOT IN THIS PR
```

既存の記述との整合:
`backend/temples/management/commands/sync_visit_style_tags_from_seed.py` の
module docstring が、同じ `updated=66` を根拠に「importer を Visit Style 修正に
使うと非 Visit Style の drift まで同一 transaction で書き換えてしまう」と
記録している。本 Audit の 66 はこれと同一の現象を指す。

対応は **Production Base Seed Drift audit** として分離する。そこで扱うべき論点:

1. 66行の drift が field 単位でどこに発生しているか
2. どれが Production 側の正、どれが Seed 側の正か
3. Seed 側へ寄せる場合の write 経路（`sync_visit_style_tags_from_seed` 相当の
   単一 field command か、full importer か）
4. full-seed apply の解禁条件

---

## 8. 本 Audit が変更していないもの

```text
Candidate Master   変更なし（昇格は commit 7f2f094c で実施済み）
Contract           変更なし
tests              変更なし
Production DB      再接続なし / write なし
Base Seed          変更なし
migration          追加なし
Recommendation / Concierge / Compass / Ranking / Score   変更なし
```

---

## 9. 関連 Audit

| 文書 | 関係 |
|---|---|
| `shrine-expansion-wave0-db01-source-packet-freeze.md` | Import 対象5社の Source / Identity / Position の凍結 |
| `shrine-expansion-wave0-db01-prebuild-unblock-gate.md` | Pre-Build Unblock Gate（Position / bootstrap） |
| `shrine-expansion-wave0-db01-isolated-preflight.md` | isolated DB 上での Preflight（Production write 前） |
| `shrine-expansion-wave0-data-build-plan.md` | CORE READY Completion Contract の正本 |
| `docs/knowledge/shrine-expansion-candidate-master-contract.md` | `IMPORTED` / `FACT_READY` / `build_batch` の定義 |

---

## Non-Goals

- CORE_READY の判定
- Production Base Seed drift（66行）の修正
- Production DB への再接続・再測定
- Candidate Master / Contract / tests の追加変更
- W0-DB02 以降の status 変更
- Recommendation eligibility の変更
