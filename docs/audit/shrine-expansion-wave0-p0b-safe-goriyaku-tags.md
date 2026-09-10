# Wave0 Foundation P0-B — Safe `goriyaku_tags` Activation

## Status

- Status: `IMPLEMENTED_PR_PENDING_REVIEW`
- Recorded at: `2026-09-10`
- Scope: `import_shrines_seed` の明示 `goriyaku_tags` M2M同期
- Production DB write: なし
- `shrines_seed_clean.json` data change: なし
- GoriyakuTag master change: なし
- Recommendation / Ranking / Concierge / Compass runtime change: なし

## 目的

Wave0 Data Build Planで定義した Foundation P0-B として、既存 `import_shrines_seed` を最小拡張し、seed rowに明示された `goriyaku_tags` を既存Production-compatible canonical 39 `GoriyakuTag` だけへ安全に同期できるようにする。

新しいImporterや並行Pipelineは作らない。

## Existing Risk

既存 `backfill_goriyaku_tags` は `Shrine.goriyaku` を分割し、`GoriyakuTag.objects.get_or_create(name=...)` を使う。

そのためWave0のSource-backedご利益をActivationする入口として直接使うと、typoやnon-canonical wordingから39外のTagを作成できる。

P0-Bではこの挙動を新規Wave0 Activationに利用しない。

## Implemented Contract

`backend/temples/management/commands/import_shrines_seed.py` に以下を追加した。

1. `goriyaku_tags` keyが無いrowはM2Mを一切変更しない。
2. keyがあるrowだけexplicit M2M同期対象にする。
3. 値はlist型、各要素はnon-empty string、duplicateなしを要求する。
4. explicit tagが1件でもある場合、DB上のcanonical master idsがexact `1..39` であることを要求する。
5. seed指定名はそのcanonical 39内に存在する名称だけ許可する。
6. unknown名が1件でもあればBase Shrine writeより前に`CommandError`で全体をblockする。
7. `GoriyakuTag.objects.get_or_create()`は使わない。
8. 新しい`GoriyakuTag` rowは作らない。
9. keyがある場合はrequested setをexact setとして扱い、追加linkと削除linkを計算する。
10. `--dry-run`はadd/remove予定を表示し、M2Mを変更しない。
11. applyではBase Shrine更新とM2M `.set()` を同じ`transaction.atomic()`内で実行する。
12. 同じseedの再実行はM2M `already_exact`となり、Tag rowを増やさない。

## Output Contract

既存のBase Shrine summary:

```text
done created=<n> updated=<n> skipped=<n> total_seed=<n>
```

は維持する。

M2Mは別summaryで記録する。

```text
goriyaku_tags rows=<n> updated=<n> added_links=<n> removed_links=<n>
```

これによりBase Shrine scalar更新とM2M Activationを混同しない。

## Tests

追加:

`backend/temples/tests/test_import_shrines_seed_goriyaku_tags.py`

固定するケース:

- key absent → existing M2M untouched
- key absent → canonical masterが無くても従来import可能
- explicit canonical subset → exact setへ同期
- new Shrine → 同一import内でM2M設定
- unknown tag → scalar / M2M write前にSTOP
- canonical master ids 1..39不完全 → STOP
- dry-run → add/remove表示、DB writeなし
- repeated import → idempotent
- non-list / duplicate entry → STOP

## Existing Seed Boundary

本PRでは `backend/temples/data/shrines_seed_clean.json` に `goriyaku_tags` keyを追加しない。

したがって現在の103社Base SeedとProduction bootstrapの既存挙動は変更しない。

既存 `test_import_shrines_seed_command.py` の `SEED_ALLOWED_KEYS` も、実Seedがまだこのkeyを使用していないため本PRでは変更しない。W0-B01で最初の実データrowへ `goriyaku_tags` を追加するPRが、その時点でcanonical Base Seed key contractを更新する責務を持つ。

## Fresh Bootstrap Boundary

現在の `bootstrap_production_data` はfresh DBで次の順に実行する。

```text
import_shrines_seed
backfill_goriyaku_tags --force
```

fresh DBでは最初の `import_shrines_seed` 実行時点でcanonical 39 masterがまだ存在しない。

本P0-Bは、実Seedへまだ `goriyaku_tags` keyを追加しないため現状のfresh bootstrapを壊さない。一方、W0-B01以降でfull Base Seedにexplicit `goriyaku_tags` を入れる際は、この順序との互換性を再検証する必要がある。

### STOP Gate

W0-B01のData PRでは最低限:

- `test_bootstrap_goriyaku_master_exact39_contract.py`
- `test_import_shrines_seed_command.py`
- `test_import_shrines_seed_goriyaku_tags.py`

を同時に通す。

fresh bootstrapがexplicit key導入で失敗する場合、bootstrap順序やmaster生成責務をP0-Bの憶測で変更せず、その時点でSTOPしてMother Shipへ差し戻す。

## Non-Goals

- `backfill_goriyaku_tags` の改修
- bootstrap step順序の変更
- canonical 39 masterの再設計
- `shrines_seed_clean.json` へのWave0データ投入
- Candidate Master更新
- Knowledge Fact / Source生成
- Production Import
- Recommendation logic変更

## Definition of Done

- existing importerのみを最小拡張している
- explicit key absent時のlegacy挙動を維持している
- existing canonical 39以外をActivationできない
- unknown tagでfail closedする
- new `GoriyakuTag`を生成しない
- dry-runでM2M差分を確認できる
- applyがatomicである
- idempotencyがtestで固定されている
- Production DBへwriteしていない
