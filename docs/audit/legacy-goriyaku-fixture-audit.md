# Legacy Goriyaku Fixture Audit

> **Status: AUDIT COMPLETE / DELETE CANDIDATE IDENTIFIED**
>
> 本監査は `backend/temples/fixtures/goriyaku_tags.json` の現在の利用状況と、
> canonical Production-compatible GoriyakuTag master との整合性を確認する
> Audit-only taskである。
>
> fixtureの削除・変更、DB更新、Migration追加、Recommendation変更、
> Production変更は行わない。
>
> 実際の削除判断・実装は別PRへ分離する。

## 0. Scope

監査対象:

* `backend/temples/fixtures/goriyaku_tags.json`

関連確認対象:

* `backend/temples/fixtures/shrines.json`
* `backend/temples/fixtures/shrines_representative.json`
* `backend/temples/fixtures/temples.json`
* `backend/scripts/generate_shrines_fixture.py`
* `backend/temples/tests/test_bootstrap_goriyaku_master_exact39_contract.py`
* test / migration / CI / script のfixture参照経路
* 過去Audit文書上のfixture分類

Out of scope:

* fixture削除
* fixture再生成
* `GoriyakuTag` DB更新
* `Shrine.goriyaku_tags` M2M更新
* Migration追加
* Production mutation
* Recommendation / Ranking / Concierge / Compass変更

## 1. Base State

| Item                        | Value                           |
| --------------------------- | ------------------------------- |
| Branch                      | `audit/legacy-goriyaku-fixture` |
| Base HEAD                   | `949c7b6e`                      |
| Base                        | `origin/develop`                |
| Working tree at audit start | clean                           |
| Production mutation         | none                            |
| DB mutation                 | none                            |

PR-A5開始前に存在していたunrelated working-tree changesは、

`pre-PR-A5 unrelated working tree`

というstashへ退避し、監査branchをcleanな状態にした。

本PRでは当該stashを変更・削除しない。

## 2. Legacy Goriyaku Fixture Contents

`backend/temples/fixtures/goriyaku_tags.json` は15行を持つ。

| PK | Legacy name |
| -: | ----------- |
|  1 | 縁結び         |
|  2 | 子宝・安産       |
|  3 | 学業成就        |
|  4 | 合格祈願        |
|  5 | 金運・商売繁盛     |
|  6 | 仕事運・出世      |
|  7 | 健康長寿        |
|  8 | 病気平癒        |
|  9 | 家内安全        |
| 10 | 交通安全        |
| 11 | 厄除け・方除け     |
| 12 | 勝運・必勝祈願     |
| 13 | 五穀豊穣        |
| 14 | 地域安泰        |
| 15 | 開運招福        |

このtaxonomyには、

* `子宝・安産`
* `金運・商売繁盛`
* `仕事運・出世`
* `厄除け・方除け`
* `勝運・必勝祈願`
* `開運招福`

のような複合labelが存在する。

current canonical masterではこれらの概念は別labelとして扱われるものが多く、
legacy fixtureとはtaxonomy構造そのものが異なる。

## 3. Canonical Exact-39 Contract

current repositoryでは、

`backend/temples/tests/test_bootstrap_goriyaku_master_exact39_contract.py`

がFresh Production bootstrapによるcanonical `GoriyakuTag` masterを固定している。

Production-compatible bootstrap path:

1. `import_shrines_seed`
2. `backfill_goriyaku_tags --with-visit-style --force`

Fresh bootstrap結果のcontract:

* exactly 39 rows
* ids exactly `1..39`
* full `id -> name` mapping fixed
* repeated bootstrap must preserve the identical master

canonical ids 1–15:

| PK | Canonical name |
| -: | -------------- |
|  1 | 縁結び            |
|  2 | 厄除け            |
|  3 | 交通安全           |
|  4 | 商売繁盛           |
|  5 | 五穀豊穣           |
|  6 | 開運             |
|  7 | 家内安全           |
|  8 | 福徳             |
|  9 | 学業成就           |
| 10 | 合格祈願           |
| 11 | 勝運             |
| 12 | 仕事運            |
| 13 | 航海安全           |
| 14 | 海上安全           |
| 15 | 武運長久           |

## 4. Physical ID Conflict

legacy fixtureとcanonical exact-39を同じPKで比較すると、
15件中14件でnameの意味が衝突する。

| PK | Legacy  | Canonical | Result   |
| -: | ------- | --------- | -------- |
|  1 | 縁結び     | 縁結び       | MATCH    |
|  2 | 子宝・安産   | 厄除け       | CONFLICT |
|  3 | 学業成就    | 交通安全      | CONFLICT |
|  4 | 合格祈願    | 商売繁盛      | CONFLICT |
|  5 | 金運・商売繁盛 | 五穀豊穣      | CONFLICT |
|  6 | 仕事運・出世  | 開運        | CONFLICT |
|  7 | 健康長寿    | 家内安全      | CONFLICT |
|  8 | 病気平癒    | 福徳        | CONFLICT |
|  9 | 家内安全    | 学業成就      | CONFLICT |
| 10 | 交通安全    | 合格祈願      | CONFLICT |
| 11 | 厄除け・方除け | 勝運        | CONFLICT |
| 12 | 勝運・必勝祈願 | 仕事運       | CONFLICT |
| 13 | 五穀豊穣    | 航海安全      | CONFLICT |
| 14 | 地域安泰    | 海上安全      | CONFLICT |
| 15 | 開運招福    | 武運長久      | CONFLICT |

`GoriyakuTag.id` はRecommendation mappingからnumeric IDとして参照されるため、
この差異は表示上のlabel driftではなくsemantic contract conflictである。

したがって、このlegacy fixtureをcurrent canonical masterの代替として利用してはならない。

## 5. Runtime / Loader Reference Audit

current repository上で以下を個別確認した。

### 5.1 Direct fixture reference

検索対象:

* `goriyaku_tags.json`
* `temples/fixtures/goriyaku_tags`

Code / test / migration / script / CIからの直接caller:

**0件**

### 5.2 Explicit `loaddata`

Repository内の `loaddata` 検索結果は、

`backend/scripts/generate_shrines_fixture.py`

内のコメント:

`loaddata は auto_now を信用できないので明示`

のみだった。

実際の `loaddata` caller:

**0件**

### 5.3 Django automatic fixture configuration

以下を検索した。

* `fixtures =`
* `FIXTURE_DIRS`
* `fixture_dirs`
* related fixture configuration

該当:

**0件**

### 5.4 Test / Migration / CI / Script dependency

以下の範囲でlegacy fixture filename参照を確認した。

* backend tests
* backend migrations
* migrations_nogis
* backend scripts
* repository scripts
* `.github`

`goriyaku_tags.json` / legacy `shrines.json` のfilename依存:

**0件**

現行Repository上では、
legacy Goriyaku fixtureをRuntime / Test / Migration / CIからロードする経路は確認できなかった。

## 6. Companion `shrines.json`

`backend/temples/fixtures/shrines.json` は2 Shrine rowsを持ち、
`goriyaku_tags` M2Mをphysical PKで保持する。

使用PK:

`[1, 5, 10, 11, 13]`

例:

### 明治神宮

Stored text:

`縁結び・厄除け・交通安全`

Stored tag IDs:

`[1, 10, 11]`

legacy 15-row taxonomyでは:

* 1 = 縁結び
* 10 = 交通安全
* 11 = 厄除け・方除け

となり、stored textと概ね意味整合する。

### 伏見稲荷大社

Stored text:

`商売繁盛・五穀豊穣`

Stored tag IDs:

`[5, 13]`

legacy taxonomyでは:

* 5 = 金運・商売繁盛
* 13 = 五穀豊穣

となり、こちらも意味整合する。

このため、

* `goriyaku_tags.json`
* `shrines.json`

は同じlegacy ID spaceを前提としたcompanion fixtureだった可能性が高い。

一方、current canonical exact-39では同じPKが異なる意味を持つ。

したがって `shrines.json` をcurrent exact-39環境で誤って利用した場合、
fixture load自体が成功してもsemantic relationが誤る可能性がある。

## 7. Other Fixture Files

fixture directoryには以下が存在する。

| File                          | Rows | GoriyakuTag PK dependency |
| ----------------------------- | ---: | ------------------------- |
| `goriyaku_tags.json`          |   15 | master itself             |
| `shrines.json`                |    2 | `[1,5,10,11,13]`          |
| `shrines_representative.json` |   20 | none                      |
| `temples.json`                |    2 | none                      |

`backend/scripts/generate_shrines_fixture.py` のcurrent default outputは、

`backend/temples/fixtures/shrines_representative.json`

であり、legacy `shrines.json` ではない。

またgeneratorは`goriyaku_tags` PKを生成していない。

したがって `shrines_representative.json` は今回確認したlegacy GoriyakuTag ID-space問題とは別系統である。

## 8. Historical Documentation

既存Audit文書では `goriyaku_tags.json` について既に以下が記録されている。

* stale 15-row fixture
* older/different ID scheme
* dead code
* DOC_CODE_DRIFT
* onboarding hazard
* separate cleanup PRでの削除候補

今回のPR-A5ではこれらの過去判断をそのまま採用したのではなく、
current `develop` 上でreference / loader / test / migration / CI経路を再検証した。

### Historical `shrines.json` classification

`docs/audit/shrine-data-pipeline-phase0-audit.md` は、

* `shrines_seed_clean.json`
* `shrines_initial.json`
* `fixtures/shrines.json`
* `fixtures/shrines_representative.json`
* `representative_shrines.yaml`

を一括して「存在・稼働中」と分類している。

しかしこれはseed asset bundle全体のcoarse-grained classificationであり、
`fixtures/shrines.json` 個別のloader/callerを証明する記録ではない。

今回のfresh auditでは `fixtures/shrines.json` のcurrent execution/reference pathは確認されなかった。

したがって、

`存在・稼働中`

というhistorical bundle classificationは、
legacy `shrines.json` 個別のcurrent runtime status判定には使用しない。

## 9. Classification

| Asset                                                  | Classification                          | Reason                                                                           |
| ------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| `backend/temples/fixtures/goriyaku_tags.json`          | **DELETE_CANDIDATE**                    | legacy 15-row taxonomy、canonical exact-39と非互換、14/15 PK conflict、current callerなし |
| `backend/temples/fixtures/shrines.json`                | **LEGACY_COMPANION / DELETE_CANDIDATE** | legacy tag PKを直接参照、current callerなし                                              |
| `backend/temples/fixtures/shrines_representative.json` | **OUT_OF_SCOPE / KEEP**                 | current generator default output、legacy tag PK依存なし                               |
| `backend/temples/fixtures/temples.json`                | **OUT_OF_SCOPE**                        | legacy GoriyakuTag PK依存なし                                                        |

## 10. Risk

### Risk if left in repository

`LOW–MEDIUM`

理由:

* runtime callerは確認されないため、現在の通常動作を直接壊してはいない
* しかしcurrent fixtureらしいpathに存在するため、新規開発・AI・manual operationで正本と誤認する可能性がある
* numeric PK conflictにより、誤利用した場合はsilent semantic corruptionが起こり得る

特に `shrines.json` はcurrent canonical masterに対してもJSONとしては成立し得るため、
hard failureではなくwrong relationshipとして読み込まれる可能性がある。

### Risk of cleanup

現行Repository evidenceではruntime / test / migration / CI dependencyは確認されていないため、
behavioral riskは低いと見込まれる。

ただし実削除時には `goriyaku_tags.json` 単独ではなく、
legacy companion `shrines.json` を同時に評価する必要がある。

## 11. Mother Ship Boundary

本監査では削除を実行しない。

別cleanup taskで判断すべき事項:

1. `goriyaku_tags.json` を削除するか
2. companion `shrines.json` も同時削除するか
3. historical fixtureが必要ならarchiveへ移動するか
4. current fixtureが必要ならexact-39 contractに合わせて再設計するか

PR-A5はこれらを選択しない。

## 12. Final Result

`backend/temples/fixtures/goriyaku_tags.json` は、

**ACTIVE runtime fixtureではなく、canonical exact-39と互換性を持たないlegacy static fixtureであり、DELETE_CANDIDATE**

と分類する。

さらに、

`backend/temples/fixtures/shrines.json`

はlegacy GoriyakuTag physical IDsを直接参照するcompanion fixtureである可能性が高く、
cleanup時には両者を同一legacy fixture groupとして評価する。

No fixture modified.
No fixture deleted.
No DB changed.
No Migration added.
No Production changed.
No Recommendation behavior changed.

**PR-A5 Audit complete.**
