# W0-B03 Wave0 Data Batch Namespace Reconciliation / First Batch Freeze

## Status

- Recorded at: `2026-09-11`
- 工程: `W0-B03`
- Candidate Master schema version: `1.1` → `1.2`
- Runtime dependency: **なし（監査で確認）**
- Production DB write: なし
- `shrines_seed_clean.json` write: なし（SHA-256 `88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c` 不変）
- Knowledge Seed 作成: なし
- factual hydration: なし
- Recommendation / Concierge / Compass / goriyaku / goriyaku_tags 変更: なし

## 問題

Wave0 の**工程ID**と、Data Build **Batch ID** が同一文字列空間を共有していた。

```text
工程ID       W0-B01 = Base Shrine Seed Build
工程ID       W0-B02 = Production Shrine Reconciliation
Batch ID     W0-B01 = 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
Batch ID     W0-B02 = 射水神社 / 別小江神社 / 戸隠神社 中社 / 札幌諏訪神社 / 少彦名神社
```

同じ `W0-B01` が「工程」と「データバッチ」の両方を指すため、監査文書・
commit message・task 指示のいずれにおいても、どちらを指しているかが
文脈依存になっていた。

## 確定事項

```text
既存工程 W0-B01 = Base Shrine Seed Build          変更しない
既存工程 W0-B02 = Production Reconciliation        変更しない
W0-B03 = 本 Namespace Reconciliation 工程
Data Build Batch canonical namespace = W0-DB01〜W0-DB07
```

### Legacy mapping

| legacy `build_batch` | canonical `build_batch` |
|---|---|
| `W0-B01` | `W0-DB01` |
| `W0-B02` | `W0-DB02` |
| `W0-B03` | `W0-DB03` |
| `W0-B04` | `W0-DB04` |
| `W0-B05` | `W0-DB05` |
| `W0-B06` | `W0-DB06` |
| `W0-B07` | `W0-DB07` |

## Reference audit（変更前に実施）

旧 `W0-B01`〜`W0-B07` の `build_batch` 値が runtime logic から参照されて
いないかを repo 全体で監査した。

### `build_batch` の出現箇所（`docs/` 以外）

```text
backend/temples/data/shrine_expansion_candidate_master.json   ... データ本体
backend/temples/tests/test_shrine_expansion_candidate_master.py ... 契約 test
```

**これ以外に一切存在しない。**

### runtime dependency の不在（4 点で確認）

| 確認 | 結果 |
|---|---|
| `ShrineCandidate` model に `build_batch` field | **なし**（`place_id` / `name_jp` / `address` / `lat` / `lng` / `goriyaku` / `source` / `raw` / `status` / `created_at` / `updated_at` / `synced_at` のみ） |
| `backend/temples/migrations/` `migrations_nogis/` に `build_batch` 列 | **0 件** |
| Candidate Master JSON を読むコード | 契約 test のみ。service / view / management command / TS いずれからも読まれていない |
| `import_approved_candidates` の入力 | `ShrineCandidate.objects.filter(status=APPROVED)`（DB 行）であり、Candidate Master JSON でも `build_batch` でもない |

`W0-B0[1-7]` リテラルが `docs/` 以外に現れる残りの箇所は、いずれも
**工程ID としての言及**であり `build_batch` 値ではない。

```text
backend/temples/migrations/0105_w0b02t02_remove_qa_artifact_id102.py  ... 工程ID W0-B02-T02
backend/temples/tests/test_base_shrine_seed_build_contract.py         ... 工程ID W0-B01（コメント）
```

```text
RUNTIME_DEPENDENCY = NONE
```

runtime dependency が無いため、STOP せず改名を実施した。

## 変更内容

### 1. `backend/temples/data/shrine_expansion_candidate_master.json`

- `schema_version` `1.1` → `1.2`
- `BUILD_READY` 35 社の `build_batch` を canonical namespace へ改名

JSON を再 serialize せず、`"build_batch":"W0-B0N"` → `"build_batch":"W0-DB0N"`
の**値位置だけ**をテキスト置換した。書式・key 順・行構成は不変。

置換前に各 legacy 値がちょうど 5 件であることを assert し、合計 35 件を
確認している。

#### 差分の機械的検証

```text
top-level（schema_version / candidates 除く） 同一 : True
candidate 件数                                     : 44 -> 44
candidate order（candidate_id 列）                 : 不変
差分のある field 名                                : ['build_batch'] のみ
差分件数                                           : 35

candidate_id           不変
candidate_name         不変
prefecture             不変
candidate_status       不変
status_reason_code     不変
duplicate_status       不変
discovery_sources      不変（source provenance 不変）

HOLD / REVIEW = 9 件、すべて build_batch = null 維持
```

#### 改名後の分布

```text
W0-DB01 = 5   W0-DB02 = 5   W0-DB03 = 5   W0-DB04 = 5
W0-DB05 = 5   W0-DB06 = 5   W0-DB07 = 5
null    = 9
legacy 残存 = 0
```

### 2. `docs/knowledge/shrine-expansion-candidate-master-contract.md`

- Schema version `1.1` → `1.2`
- `build_batch` 章を canonical namespace / legacy mapping / 次の target の
  3 節へ再構成
- 許可値を `W0-DB01`〜`W0-DB07` と `null` に限定することを明記
- 工程ID との衝突が改名理由であることを明記

### 3. `backend/temples/tests/test_shrine_expansion_candidate_master.py`

- `schema_version == "1.2"`
- `CANONICAL_BUILD_BATCHES` / `LEGACY_BUILD_BATCHES` / `EXPECTED_W0_DB01_MEMBERS` を追加
- 既存 batch membership test を canonical 定数ベースへ更新し、
  `BUILD_READY` 合計 35 を明示 assert
- `test_wave0_build_batch_uses_the_canonical_db_namespace_only` を追加
  （legacy `W0-B01`〜`W0-B07` が `build_batch` として 0 件であることを固定）
- `test_wave0_db01_member_set_is_frozen` を追加
  （`W0-DB01` の member set を exact に固定し、全員 `BUILD_READY` であることも確認）

### 4. `docs/audit/shrine-expansion-wave0-data-build-plan.md`

- Batch 表へ canonical / legacy の 2 列を持たせ、namespace 注記を追加
- Per-Batch Flow の `各W0-B01〜B07` を `各 W0-DB01〜W0-DB07` へ更新

## 次の Data Build target

```text
W0-DB01
  三輪神社
  大鳥大社
  御岩神社
  烏森神社
  榴岡天満宮
```

この member set は `test_wave0_db01_member_set_is_frozen` が exact に固定する。

**注記**: `docs/audit/shrine-expansion-wave0-b01-source-freeze-bootstrap-gate.md`
は、この 5 社のうち **御岩神社** を `HOLD_POSITION_REVIEW`
（`SOURCE_PACKET_FREEZE = HOLD`）として記録している。本工程は namespace の
分離のみを扱い、Source Packet の状態・factual hydration・Position 判断には
一切触れていない。W0-DB01 の Data Build 着手時には、その HOLD が解消済みか
を別途確認する必要がある。

## 検証

```text
backend/temples/tests/test_shrine_expansion_candidate_master.py
  7 passed

python scripts/build_base_shrine_seed.py --check
  SHA256=88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c
  BASE_SEED_BUILD=OK
```

## Non-Goals

- `shrines_seed_clean.json` の変更
- Knowledge Seed の作成
- Source Packet の factual hydration
- Production DB write
- `goriyaku` / `goriyaku_tags` の変更
- Recommendation / Concierge / Compass の変更
- candidate identity / order / status / provenance の変更
- 工程ID（`W0-B01` / `W0-B02` / `W0-B03`）の変更
