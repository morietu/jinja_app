# Fresh Bootstrap Goriyaku Tags Two-pass Remediation

## Status

- Status: `IMPLEMENTED_PR_PENDING`
- Recorded at: `2026-09-10`
- Mother Ship decision: `TWO_PASS_BASE_M2M_ACTIVATION`
- Trigger: `docs/audit/shrine-expansion-wave0-b01-source-freeze-bootstrap-gate.md`
- Production DB write: なし
- Shrine Seed data change: なし
- GoriyakuTag master data change: なし

## Problem

P0-Bで `import_shrines_seed` にexplicit `goriyaku_tags`のsafe exact-set同期を追加した。
通常importでは、explicit tagがある場合にProduction-compatible canonical `GoriyakuTag` master ids 1..39が事前に存在することをfail-closedで要求する。

一方、従来fresh Production bootstrapは以下の順序だった。

```text
1. import_shrines_seed
2. backfill_goriyaku_tags --force
```

Wave0 Base Seedへ初めてexplicit `goriyaku_tags`を追加すると、fresh DBではstep 1時点でGoriyakuTag masterが0件のため、P0-Bの安全契約によりstep 1が停止し、step 2へ到達できない。

## Mother Ship Decision

`two-pass Base/M2M activation` を採用する。

```text
1. Base Shrine import
   import_shrines_seed --skip-goriyaku-tags

2. Production-compatible master生成
   backfill_goriyaku_tags --force

3. Explicit M2M activation
   import_shrines_seed
```

### Why this option

- P0-Bの通常実行fail-closed契約を弱めない
- 新規GoriyakuTag master生成commandを作らない
- 既存のhistorical `backfill_goriyaku_tags --force`でfresh DBのcanonical 39 id/name順を維持する
- explicit activationはP0-Bの安全なexact-set同期をそのまま再利用する
- new/unknown tagをM2M activation段階で作らない
- existing Productionではhistorical backfill SUCCESS markerを維持し、不要な再backfillを避ける

## Importer Extension

`import_shrines_seed` に `--skip-goriyaku-tags` を追加する。

このflagはfresh bootstrap第1pass専用である。

- explicit `goriyaku_tags`のlist構造検証は行う
- canonical masterのDB解決は遅延する
- M2M read/writeは行わない
- Base Shrine scalar fieldは通常どおりimportする
- 通常実行では従来どおりcanonical ids 1..39を要求する

したがって、このflagはP0-Bの安全契約を一般用途で緩和するものではない。

## Bootstrap Lifecycle

現在の`BOOTSTRAP_STEPS`は以下へ変更する。

```text
import_shrines_seed_base
  version=2026-09-10-base-v1
  command=import_shrines_seed
  args=--skip-goriyaku-tags

backfill_goriyaku_tags
  version=2026-05-10-with-visit-style-force-v1
  command=backfill_goriyaku_tags
  args=--force

sync_explicit_goriyaku_tags
  version=2026-09-10-explicit-goriyaku-tags-v1
  command=import_shrines_seed
```

Historical `backfill_goriyaku_tags` versionは変更しない。
既存ProductionでSUCCESS済みならそのstepはSKIPされる。

旧 `import_shrines_seed / 2026-05-10-v1` markerは現行step listから外れるが、ProductionDataBootstrapRun historyとしてDBに残っていて問題ない。
新しいBase-only stepは挙動が異なるため新しいstep/versionとして追跡する。

## Safety Contract

1. Fresh DBでBase Shrineをmaster生成前に作成できる
2. malformed explicit `goriyaku_tags`はBase-only passでもSTOPする
3. Base-only passでM2Mは作成しない
4. backfillがcanonical 39 masterをhistorical id順で生成する
5. final passはcanonical ids 1..39が揃わなければSTOPする
6. final passはunknown tagをSTOPする
7. final passは新規GoriyakuTagを作らない
8. final passはrequested setへexact-set同期する
9. repeated bootstrapでid 40+を増やさない
10. Recommendation numeric id mappingを変更しない

## Tests

更新対象:

- `backend/temples/tests/test_import_shrines_seed_goriyaku_tags.py`
  - Base-only passでmaster 0件でもShrine作成可能
  - M2M 0件を維持
  - canonical master生成後の通常passでexact-set同期

- `backend/temples/tests/test_bootstrap_goriyaku_master_exact39_contract.py`
  - Production bootstrap 3-step順序を固定
  - fresh bootstrap後もexact canonical 39 rows / ids 1..39
  - legacy/extra label 0
  - repeated bootstrap byte-identical

## Non-goals

- `backfill_goriyaku_tags`の一般的な安全化
- existing 39 vocabularyのrename/merge
- `NEED_TO_GORIYAKU_IDS`変更
- Candidate Master変更
- Wave0 Base Seed追加
- Knowledge Seed追加
- Production Import
- Recommendation / Concierge / Compass runtime変更

## Exit Gate for W0-B01

このPRのCIで以下がPASSし、developへmergeされた後にW0-B01 Data Buildを再開する。

```text
backend unit tests = PASS
fresh bootstrap exact39 = PASS
migration drift = 0
CodeQL / dependency review = PASS
```

W0-B01 Data Build側でreal Seedへexplicit `goriyaku_tags`を追加した後も、fresh-bootstrap exact39 testを再度実行する。
