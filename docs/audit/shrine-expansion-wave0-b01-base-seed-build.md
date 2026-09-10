# Shrine Expansion Wave0 B01 Base Shrine Seed Build

## Status

- Status: `PASS_BASE_SEED_BUILT`
- Recorded at: `2026-09-10`
- Batch: `W0-B01`
- Scope: 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
- Production DB write: なし

## Input Source

正本入力は `docs/audit/shrine-expansion-wave0-b01-source-packet-freeze.md` の `FROZEN_5_OF_5` とする。

Data BuildではSource Packet Freezeで承認済みのIdentity / Position / Recommendation EvidenceだけをBase Seedへ運ぶ。新しいご利益、祭神、由緒、座標を本工程で推測しない。

## Versioned Batch Packet

`backend/temples/data/base_seed_batches/wave0_batch_01.json`

5社すべてについて以下を固定した。

```text
name_jp
address
latitude
longitude
goriyaku
goriyaku_tags
kyusei = null
astro_elements = []
visit_style_tags = []
location.lat/location.lng
```

`astro_elements` と `visit_style_tags` はSource Packet Freezeで今回承認していないため空配列とし、本工程で推測しない。

## Canonical Base Seed Integration

`backend/temples/data/shrines_seed_clean.json` の既存末尾 `波上宮` の後ろへW0-B01 5社を追加した。

追加順はCandidate Master / Wave0 Batch順を維持する。

```text
三輪神社
大鳥大社
御岩神社
烏森神社
榴岡天満宮
```

各rowの `name_jp / address / latitude / longitude / goriyaku / goriyaku_tags` はSource Packet Freezeの採用値と一致する。

## Safety Contract

1. W0-B01は5社ちょうど
2. name+address identityはBatch内でunique
3. existing Base Seed identityと重複しない
4. `goriyaku`の`・`分割結果とexplicit `goriyaku_tags` listが一致
5. `goriyaku_tags`は重複なし
6. latitude/longitudeとlocation sub-objectが一致
7. 既存Shrine rowを変更しない
8. Production DBへ書き込まない

## Canonical Integration Verification

`develop` merge commit `070be853a0ccac00980a38ae8cbe2e3d604ab716` とData Build branchを比較した。

`shrines_seed_clean.json` の差分:

```text
status = modified
additions = 104
deletions = 0
```

末尾を再取得し、追加内容がW0-B01の5社のみであることを確認した。
既存Base Seed rowの削除は0。

## Contract Test

`backend/temples/tests/test_wave0_b01_base_seed_packet.py`

以下を固定する。

- 5社exact order
- Batch内identity unique
- 必須Base Seed fields
- latitude/longitude = location.lat/location.lng
- `goriyaku.split("・") == goriyaku_tags`
- tag duplicateなし
- canonical Base Seed既存identityとの重複なし
- P0-B canonical id contract = 1..39

## Exit Decision

```text
W0_B01_BASE_SHRINE_SEED_BUILD = PASS
CANONICAL_BASE_SEED_UPDATED = YES
EXISTING_ROW_DELETIONS = 0
PRODUCTION_DB_WRITE = 0
NEXT_GATE = DATA_BUILD_CONTRACT_TESTS
```
