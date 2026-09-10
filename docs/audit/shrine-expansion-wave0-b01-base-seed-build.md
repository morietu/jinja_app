# Shrine Expansion Wave0 B01 Base Shrine Seed Build

## Status

- Status: `BUILD_IN_PROGRESS_CANONICAL_INTEGRATION_PENDING`
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

## Safety Contract

1. W0-B01は5社ちょうど
2. name+address identityはBatch内でunique
3. existing Base Seed identityと重複しない
4. `goriyaku`の`・`分割結果とexplicit `goriyaku_tags` listが一致
5. `goriyaku_tags`は重複なし
6. latitude/longitudeとlocation sub-objectが一致
7. 既存Shrine rowを変更しない
8. Production DBへ書き込まない

## Canonical Integration Gate

最終DONE条件は `backend/temples/data/shrines_seed_clean.json` へ5社を追加し、既存row変更0であること。

GitHub connectorはpartial patch writeを持たないため、canonical JSON全置換を直接本branchで行わず、temporary branch上で更新してparentとの差分を確認する。

Accept条件:

```text
existing row deletions = 0
existing row modifications = 0
new shrine rows = 5
added identities = W0-B01 exact 5
JSON parse = PASS
```

Accept後のみData Build branchへcommitを進める。
