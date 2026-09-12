# W0-B02-T02 Remove Production-only QA artifact Shrine id=102

## Status

- Recorded at: `2026-09-11`
- Task: `W0-B02-T02`
- Migration: `backend/temples/migrations/0105_w0b02t02_remove_qa_artifact_id102.py`
- Tests: `backend/temples/tests/test_migration_0105_w0b02t02_remove_qa_artifact_id102.py`（36 test）
- Delivery: `REVERSIBLE_DATA_MIGRATION`, fail-closed
- Production migration 実行: **なし**
- Production 接続: **なし**（本実装環境に credential は存在しない）
- Base Seed write: なし（SHA-256 `88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c` 不変）
- DB schema 変更: なし
- Recommendation / Concierge / UI / Seed 内容変更: なし

## Decision Token

```text
W0_B02_T02_INTERACTION_LOG_POLICY = DELETE_EXACT_AUDITED_QA_LOGS_WITH_ARTIFACT
W0_B02_T02_UPDATED_AT_POLICY      = EXACT_PRECONDITION_AND_REVERSE_VALUE
```

`P8-A` の `MOVE_TO_PRIMARY` は適用できない — pk 102 には対応する primary
Shrine が存在せず、log の移送先が無い。`P8-B` の「全 relation 0 件」も
満たさない — 監査済みの log が 2 行ある。したがって本 migration 限りの
policy として exact に pk 3 / 6 だけを artefact と同時に削除する。
**この方針を他の user data / analytics data / QA data へ一般化しない。**

## Production PRE snapshot（正本）

`scripts/migration_safety/sql/shrine_id102_pre_snapshot.sql` を Mother Ship 側
から Production に対し read-only 実行した実測値。docs / fixtures / seed /
local DB / 既存 migration からの推測値は一切含まない。credential および
`DATABASE_URL` は本文書に記録しない。

### Shrine pk 102（全 24 保存列）

| 列 | 値 | semantics |
|---|---|---|
| `id` | 102 | VALUE |
| `kind` | `shrine` | VALUE |
| `name_jp` | `テスト確認神社 20260611` | VALUE |
| `name_romaji` | — | SQL NULL |
| `address` | `東京テスト` | VALUE |
| `latitude` | — | SQL NULL |
| `longitude` | — | SQL NULL |
| `location` | — | SQL NULL |
| `goriyaku` | `` | EMPTY STRING |
| `sajin` | `` | EMPTY STRING |
| `description` | — | SQL NULL |
| `element` | — | SQL NULL |
| `kyusei` | — | SQL NULL |
| `astro_elements` | `[]` | VALUE |
| `visit_style_tags` | `[]` | VALUE |
| `history_theme` | `` | EMPTY STRING |
| `views_30d` | 0 | VALUE |
| `favorites_30d` | 0 | VALUE |
| `popular_score` | 0 | VALUE |
| `last_popular_calc_at` | — | SQL NULL |
| `place_ref_id` | — | SQL NULL |
| `owner_id` | 1 | VALUE |

```text
created_at = 2026-06-11T07:45:49.473076Z   epoch_us = 1781163949473076
updated_at = 2026-06-11T07:45:49.473590Z   epoch_us = 1781163949473590
```

### ShrineInteractionLog（exact 2 行）

| 列 | pk 3 | pk 6 |
|---|---|---|
| `user_id` | 1 | 1 |
| `shrine_id` | 102 | 102 |
| `action_type` | `detail_view` | `detail_view` |
| `source` | `shrine_detail` | `shrine_detail` |
| `thread_id` | SQL NULL | SQL NULL |
| `metadata` | `{"ctx": null, "event": "shrine_detail_view"}` | 同左 |
| `created_at` | `2026-06-11T07:51:37.018819Z` | `2026-06-11T09:03:38.508071Z` |
| `created_at` epoch_us | 1781164297018819 | 1781168618508071 |

```text
total_rows = 2 / expected_pks = 2 / unexpected_pks = 0
```

### Relation contract

```text
NON_INTERACTION_RELATION_TOTAL = 14
DEPLOYED_ZERO                  = 11
DEPLOYED_NONZERO               = 0
NOT_DEPLOYED                   = 3
    temples_conciergehistory / shrine_id
    temples_like             / shrine_id
    temples_rankinglog       / shrine_id

LEGACY_M2M_RELATION       = temples_shrine_deities
LEGACY_M2M_COLUMN         = shrine_id
LEGACY_M2M_REFERENCING_ROWS = 0
```

### Production physical type（A2 実測）

```text
temples_shrine.location                = text
temples_shrine.astro_elements          = jsonb
temples_shrine.visit_style_tags        = jsonb
temples_shrineinteractionlog.metadata  = jsonb
```

## 実装

### forward

1. `Shrine` pk 102 を `.only(...)` で取得（`location` は常に除外）
2. 23 列を exact 比較。`is None` と `""` を別々に比較し SQL NULL と空文字を混同しない
3. `location IS NULL` を raw SQL で確認（物理型が環境依存のため NULL 判定のみ）
4. `created_at` / `updated_at` を **epoch microseconds** で exact 比較
5. `shrine_id=102` の `ShrineInteractionLog` が exactly 2 行であることを確認
6. pk が exactly `{3, 6}` であることを確認
7. 2 行の 8 列すべてを exact 比較（`created_at` も epoch microseconds）
8. 14 non-interaction relation を fail-closed 確認
9. legacy M2M を独立 Gate として fail-closed 確認
10. 1 つでも不一致なら何も削除せず `PreconditionViolation`
11. `ShrineInteractionLog` pk 3 / 6 を pk 指定で明示削除（blind CASCADE に依存しない）
12. `Shrine` pk 102 を raw `DELETE ... WHERE id = 102` で削除

### reverse

1. pk 102 / log pk 3,6 のいずれかが存在すれば `PreconditionViolation`（上書きしない）
2. PRE snapshot の静的値だけで復元。推測値を使わない
3. SQL NULL / 空文字をそのまま復元
4. `created_at` / `updated_at` を PRE の exact instant へ復元
5. sequence は巻き戻さない

### reverse の fresh lineage 対称性（2026-09-12 修正）

**問題**: forward は artefact 不在の lineage で clean no-op になるが、
初版の reverse は**無条件に** Production PRE を復元していた。このため

* Production にしか存在しない QA artefact を fresh DB へ新規作成してしまう
* fresh DB には `owner_id=1` が指す operator user が無く FK violation
  （`IntegrityError: Key (owner_id)=(1) is not present in table "auth_user"`）で
  rollback 自体が失敗する

`test_gis_migration_0094...::test_b_forward_corrects_only_the_target_shrine` と
`test_gis_migration_0091...::test_f_fresh_db_migration_chain_0090_to_0091_succeeds`
が、head から 0093 / 0090 へ rollback する過程で実際にこれで落ちていた。

**修正**: reverse を forward と対称にし、fresh lineage では clean no-op に
する。判定は `_is_fresh_lineage_for_reverse` が以下を**すべて**満たす場合のみ。

1. artefact pk 102 が不在
2. 監査済み log pk `{3, 6}` が不在
3. `shrine_id=102` を参照する log が 0 行
4. operator user（PRE の `owner_id`）が不在
5. `ShrineInteractionLog` が 0 行
6. pk >= 102 の Shrine が 0 行

operator user の不在 **だけ** では fresh と判定しない。Production-like な DB
から operator user が消えた状態を「fresh」と誤認して黙って復元を飛ばすのを
防ぐため、5 / 6 を併せて要求する。その状態では復元直前の guard が
`PreconditionViolation` を送出し fail closed で止まる（FK violation ではなく
明示エラーになる）。

Production-like state の exact restore / fail-closed 契約、PRE 定数、artefact
値、log 値、timestamp、relation gate、sequence policy はいずれも**変更していない**。

### fresh lineage の扱い

pk 102 は Production にのみ存在する。fresh / 非 Production の lineage では
最初から不在であり、そこで forward が例外を送出すると **Production 以外の
すべての環境で `migrate` が不可能**になる（fresh bootstrap 契約が壊れる）。

したがって `0101 P8-B` と同じく、artefact が不在で監査済み log も残って
いない状態は **clean no-op** とする。artefact だけ外部で消され log が残る
途中状態は fail closed で STOP する（`temples_shrineinteractionlog.shrine_id`
の FK により通常は成立しないが、FK を失った環境向けの防御として残す）。

## 実装中に検出した実バグ（修正済み）

`temples.signals.fill_latlng_if_missing` / `auto_geocode_on_save` は
`pre_save` に接続されており、`latitude` / `longitude` が NULL の Shrine を
`save()` / `create()` すると **35.0 / 135.0 という推測値を書き込む**。

PRE snapshot の実測値は両方 SQL NULL である。reverse を
`Shrine.objects.create()` で実装した初版は、この signal により
latitude / longitude が推測値へ書き換わり、**exact 復元が成立しなかった**
（local test で実測検出）。

`bulk_create()` は model signal を送出しないため、PRE の NULL がそのまま
保たれる。field レベルの `auto_now` は適用されるので、timestamp は直後の
`QuerySet.update()` で PRE 値へ戻す（`update()` は `save()` を経由しない）。

## 検証

### 1. Migration contract tests

```text
backend/temples/tests/test_migration_0105_w0b02t02_remove_qa_artifact_id102.py
36 passed
```

カバレッジ:

| 要求 | test |
|---|---|
| exact PRE 一致 → forward 成功 | `test_forward_deletes_artifact_and_audited_logs_on_exact_pre` |
| shrine field 1 項目違い → STOP / no deletion | `test_forward_stops_on_any_single_shrine_field_drift`（5 ケース） |
| NULL vs empty string 違い → STOP | `test_forward_stops_on_null_versus_empty_string_drift`（6 ケース） |
| `updated_at` 違い → STOP | `test_forward_stops_when_updated_at_drifts_by_one_microsecond` |
| `created_at` 違い → STOP | `test_forward_stops_when_created_at_drifts_by_one_microsecond` |
| unexpected InteractionLog 追加 → STOP | `test_forward_stops_when_an_unexpected_interaction_log_is_added` |
| log id 違い → STOP | `test_forward_stops_when_log_pk_set_differs` |
| log field 違い → STOP | `test_forward_stops_on_interaction_log_field_drift`（3 ケース）/ `..._thread_id_is_no_longer_null` / `..._created_at_drift` |
| deployed relation に 1 件参照 → STOP | `test_forward_stops_when_a_deployed_relation_references_the_artifact` |
| formerly NOT_DEPLOYED table 存在 + 0 件 → PASS | `test_forward_passes_when_a_formerly_not_deployed_table_exists_with_zero_rows` |
| formerly NOT_DEPLOYED table 存在 + 1 件 → STOP | `test_forward_stops_when_a_formerly_not_deployed_table_has_a_reference` |
| legacy M2M 0 件 → PASS | `test_forward_passes_when_legacy_m2m_table_is_absent_or_empty` |
| legacy M2M 1 件 → STOP | `test_forward_stops_when_legacy_m2m_references_the_artifact` |
| inventory を 11 へ縮小しない | `test_relation_inventory_stays_at_fourteen` |
| reverse exact Shrine 復元 | `test_reverse_restores_the_shrine_with_every_field_exact` |
| reverse exact InteractionLog 2 件復元 | `test_reverse_restores_both_interaction_logs_with_every_field_exact` |
| reverse timestamp microsecond 一致 | `test_reverse_restores_timestamps_to_the_exact_microsecond` |
| reverse 時 PK 再利用 → STOP | `test_reverse_stops_when_the_shrine_pk_is_reused` / `..._an_interaction_log_pk_is_reused` |
| sequence rewind なし | `test_reverse_does_not_rewind_the_sequence` |

### 2. 使い捨て local DB での実 `migrate` 往復

GIS lineage（PostGIS + GDAL 導入）の使い捨て DB で `manage.py migrate` を
実際に往復させた。Production ではない。

#### 2-1. `0104 → forward → reverse → forward`（artefact を PRE 状態で投入）

使い捨て DB を `0104` まで migrate し、Production PRE を raw SQL で exact に
再現（signal を一切経由しない）してから 4 段階を実行した。

```text
STEP 1  migrate temples 0104        -> ledger head = 0104_evidence_link_foundation
        PRE 投入後の実測
          shrine created_us = 1781163949473076
          shrine updated_us = 1781163949473590
          log 3 created_us  = 1781164297018819
          log 6 created_us  = 1781168618508071

STEP 2  migrate temples 0105        -> Applying 0105 ... OK   （real forward delete）
          shrine_102=0  logs_for_102=0  logs_pk_3_6=0
          ledger head = 0105_w0b02t02_remove_qa_artifact_id102

STEP 3  migrate temples 0104        -> Unapplying 0105 ... OK （reverse restore）
          created_us = 1781163949473076   PRE と一致
          updated_us = 1781163949473590   PRE と一致（auto_now に上書きされていない）
          lat_null=true lng_null=true loc_null=true
          owner_id=1 kind=shrine name=テスト確認神社 20260611 addr=東京テスト
          SQL_NULL     : name_romaji / description / element / kyusei / place_ref_id
          EMPTY_STRING : goriyaku / sajin / history_theme
          log 3 user=1 detail_view shrine_detail thread_null=true
                meta={"ctx": null, "event": "shrine_detail_view"} us=1781164297018819
          log 6 同上 us=1781168618508071

STEP 4  migrate temples 0105        -> Applying 0105 ... OK   （forward delete 再）
          shrine_102=0  logs_for_102=0
          shrine_seq=1  log_seq=1   （sequence は巻き戻しも前進もしていない）
          ledger head = 0105_w0b02t02_remove_qa_artifact_id102
```

#### 2-2. precondition と delete が同一 transaction であることの実証

`updated_at` を **1 microsecond だけ** 進めた状態で `migrate temples 0105`
を実行した。

```text
PreconditionViolation: [temples.0105 W0-B02-T02] PRESTATE_MISMATCH:
  Shrine pk 102 の updated_at は epoch_us=1781163949473591
  (期待値 1781163949473590 = 2026-06-11T07:45:49.473590+00:00)

ロールバック後の実測:
  ledger head  = 0104_evidence_link_foundation   （0105 は適用済みにならない）
  shrine_102   = 1                                （削除されていない）
  logs_for_102 = 2                                （削除されていない）
```

`RunPython` は `Migration.atomic`（既定 `True`）の下で実行されるため、
precondition 検証と delete は同一 transaction 内にあり、不一致時は
ledger も行も一切変化しない。

#### 2-3. fresh lineage

別の使い捨て DB（artefact 不在）では `0105` が clean no-op として適用され、
その後の `0104` reverse → `0105` forward も同様に成立した。

この DB の `temples_shrine.location` は `USER-DEFINED`（geometry）であり、
Production の `text`、NoGIS test lineage の `jsonb` と異なる。3 通りの物理型で
同一実装が成立することを示している。

### 3. Seed / 回帰

```text
python scripts/build_base_shrine_seed.py --check
  SHA256=88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c
  BASE_SEED_BUILD=OK

関連 migration / seed tests（0100 / 0101 / 0105 / seed build / import / exact39 / scripts）
  123 passed

backend/temples/tests + scripts/tests
  FAILED 一覧は本作業着手前の baseline と同一の 7 件のみ:
    test_concierge_api.py::test_chat_backfills_short_location
    test_concierge_api.py::test_radius_km_bias_passthrough
    test_concierge_api.py::test_candidate_formatted_address_is_used
    test_favorites_api.py::test_favorites_crud_happy_path
    test_favorites_api.py::test_favorites_are_user_scoped
    test_favorites_api_idempotency.py::test_post_is_idempotent
    test_pkg_import_sweep.py::test_import_everything_lightweight
  いずれも本実行環境固有（pyo3 panic / geocoding）であり、
  clean tree でも同一に失敗する。本変更による新規 failure はゼロ。
```

## Production 適用手順（未実行）

1. Mother Ship 側で `scripts/migration_safety/sql/shrine_id102_pre_snapshot.sql`
   を read-only 再実行し、本文書の PRE 値と一致することを確認する
2. 一致した場合のみ `migrate temples 0105` を実行する
3. 適用後に W0-B02 Reconciliation Gate を再実行し、以下を確認する

```text
BASE_SEED_TOTAL=103
PRODUCTION_TOTAL=103
MATCH=103
PROD_ONLY=0
SEED_ONLY=0
PRODUCTION_DUPLICATE_IDENTITY=0
STATUS=PASS
```

これを満たすまで W0-B03 へ進まない。

## Non-Goals

- Production migration の実行
- Production への接続
- DB schema の変更
- Base Seed の変更
- Recommendation / Concierge / UI の変更
- 本 policy の他 QA データ / user data / analytics data への一般化
