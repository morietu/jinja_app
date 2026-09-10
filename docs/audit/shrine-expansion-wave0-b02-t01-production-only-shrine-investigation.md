# W0-B02-T01 Production-only Shrine Investigation (id 102)

## Status

- Recorded at: `2026-09-10`
- Task: `W0-B02-T01`
- Target: `db_id=102` / `name_jp='テスト確認神社 20260611'` / `address='東京テスト'`
- Production DB write: なし
- migration: なし
- Base Seed write: なし
- Recommendation Ranking / Score change: なし
- 自動cleanup: なし
- Production query 実行: **`NOT_EXECUTED`**（credential不在、`VAR_SET=0`）
- Disposition (KEEP / REMOVE / ADD_TO_SEED): **未決定（Mother Ship決定事項）**
- `STATUS`: **`NEED_MORE_EVIDENCE`**

## 目的

W0-B02 Reconciliation Gateが検出した唯一のPROD_ONLY行の由来と依存関係を
read-onlyで特定する。

---

## FACT

repository上で本セッションに実測した事実のみを記載する。

### F1. 当該文字列はdocs/audit以外に一切存在しない

作業ツリー全体（`.git` / `node_modules` 除く）を `テスト確認神社` /
`東京テスト` / `20260611` でgrepした結果、hitは **`docs/audit/*.md` のみ**。

```text
code            : 0 hits
Base Seed       : 0 hits
fixtures        : 0 hits
seed_data       : 0 hits
migrations      : 0 hits
tests           : 0 hits
```

当該Shrineはrepository管理下のいかなるSeed・fixture・migrationからも
生成されない。

### F2. Git履歴に作成由来の痕跡は存在し得ない

```text
総commit数        = 57
root commit       = d734dce (2026-09-07, "data: visit_style_tagsのlegacy driftを整理 (#2736)")
```

`git log --all -S` が当該文字列でhitするcommitは `d734dce` 1件のみであり、
それが **root commit** である。`d734dce` は `.coveragerc` / `.dockerignore` /
`.github/workflows/*` を含むrepository全体のsquashed importであり、その時点で
既に `docs/audit/*` が id 102 を記述している。

したがって、**本repositoryのgit履歴は id 102 の作成時点より後から始まっており、
作成由来をgit履歴から特定することは原理的に不可能**である。

### F3. id 102 はQA fixture除外契約に既に一致している

`backend/temples/services/shrine_qa_fixture_exclusion.py` の
`exclude_qa_fixture_shrines()` は `name_jp__startswith="テスト"` を除外する。
`テスト確認神社 20260611` はこれに一致する。

この除外が適用される経路（本セッションでgrep実測）:

| 経路 | ファイル |
|---|---|
| Recommendation candidate pool | `services/concierge_chat_candidates.py:228` |
| Knowledge Coverage集計 | `services/knowledge_coverage_report.py:54` |
| Recommendation品質測定 | `services/recommendation_quality_measurement.py:180` |
| Knowledge export | `management/commands/export_shrine_knowledge.py:67` |

### F4. 除外が適用されない経路が存在する

`exclude_qa_fixture_shrines` を **呼んでいない** Shrine queryset入口:

| 経路 | ファイル | 備考 |
|---|---|---|
| `ShrineViewSet` (ReadOnlyModelViewSet) | `views.py:190` `Shrine.objects.all()` | 公開list/detail API |
| `/api/popular-shrines` | `views.py:140` `Shrine.objects.all()` | |
| composite score付きqueryset | `views.py:70` `Shrine.objects.all()` | |
| 地理系query群 | `queries.py:31,52,94,118,131,139` | 多くは `location__isnull=False` または `latitude/longitude isnull=False` で座標filter |

`queries.py` の大半は座標filterにより座標nullの行を結果的に落とすが、これは
QA除外契約による除外ではなく副次的効果である。`views.py` の3経路は座標filterも
QA除外も持たない。

**注記**: id 102 の現在の座標がnullかどうかは本セッションで実測していない
（UNKNOWN U2参照）。

### F5. Shrineを参照する関係は15本（Django introspection実測）

| 参照元 | table | field | on_delete |
|---|---|---|---|
| ShrineDeity | `temples_shrinedeity` | shrine | CASCADE |
| ShrineHistory | `temples_shrinehistory` | shrine | CASCADE |
| HistoryThemeAssignment | `temples_historythemeassignment` | shrine | CASCADE |
| ShrineGoriyakuAssignment | `temples_shrinegoriyakuassignment` | shrine | CASCADE |
| Favorite | `temples_favorite` | shrine | CASCADE |
| ConciergeThread | `temples_conciergethread` | main_shrine | SET_NULL |
| Visit | `temples_visit` | shrine | CASCADE |
| ShrineReflection | `temples_shrinereflection` | shrine | CASCADE |
| ShrineInteractionLog | `temples_shrineinteractionlog` | shrine | CASCADE |
| ActionEvent | `temples_actionevent` | shrine | SET_NULL |
| Goshuin | `temples_goshuin` | shrine | CASCADE |
| Like | `temples_like` | shrine | CASCADE |
| RankingLog | `temples_rankinglog` | shrine | CASCADE |
| ConciergeHistory | `temples_conciergehistory` | shrine | SET_NULL |
| GoriyakuTag (M2M) | `temples_shrine_goriyaku_tags` | shrine | — |

forward: `place_ref` → `temples.PlaceRef`、`owner` → `auth.User`。

### F6. 監査fieldは存在する

`Shrine.created_at`（`default=timezone.now`）、`Shrine.updated_at`
（`auto_now=True`）が `backend/temples/models.py` に定義されている。

`updated_at` は `auto_now` のため、過去のいかなる書き込みでも上書きされる。
作成時刻の証跡として使えるのは `created_at` のみである。

### F7. id 102 を対象とするmigrationは存在しない

`backend/temples/migrations/*.py` を `102` でgrepした結果、id 102 を
データとして扱うmigrationは **0件**。

一方、隣接する非canonical行は既に除去済みである。

| migration | 対象 |
|---|---|
| `0100_p8a_duplicate_shrine_shadow_cleanup.py` | shadow 101→22 / 103→21 / 104→49 を削除 |
| `0101_p8b_remove_non_shrine_artifact_id105.py` | 非神社artifact id 105（広島市）を削除 |

`docs/audit/p8-identity-coordinate-remediation.md:434` は id 102 について
**"unchanged — id 102 out of P8 scope"** と明記している。

### F8. id 102 に対するMother Ship決定は存在しない

`docs/` 全体を `P8_102` / `102_ACTION` / `ID_102_ACTION` 等の決定tokenで
grepした結果 **0件**。id 101/103/104/105 には
`P8_101_ACTION=REMOVE_SHADOW_TO_22` 等の明示決定が存在するのに対し、
**id 102 だけが disposition 未決のまま残されている**。

---

## INFERENCE

推論であり、確定事実ではない。

### I1. PROD_ONLY が1件だけになった理由（確度: 高）

過去監査の記録 `RAW_PRODUCTION_SHRINE_ROWS = 108`
（`shrine-evidence-integrity-full-audit.md`）から、P8-A（101/103/104削除）と
P8-B（105削除）を適用すると **104 = canonical 103 + id 102** となる。

W0-B02 Gateが `PROD_ONLY=1`（id 102のみ）を検出した観測と完全に整合する。

根拠: migration code（F7）+ 過去監査doc。現在のProduction件数は未実測。

### I2. 由来は単一の手動テストセッション（確度: 中〜高、ただし間接）

`docs/audit/temples-0091-production-remediation.md` は、id 101〜105 が
Production唯一のユーザー（`id=1`, username=`test`, superuser,
`date_joined=2026-06-11 14:58:42`）によるmap resolve機能の手動テスト
セッションの副産物であると結論している。

名称の接尾辞 `20260611` が `date_joined` の日付 `2026-06-11` と一致する。

**ただしこれは間接証拠である**: 同doc §4.2 のFK参照確認は
`id=21/22/101/103` を対象としており、**id 102 は含まれていない**。
id 102 自身の created_at も参照関係も、当該監査では測定されていない。

### I3. 現状のRecommendation影響は限定的（確度: 中）

F3により、Recommendation candidate pool・Knowledge Coverage・品質測定・
Knowledge exportからは既に除外されている。

ただしF4の公開API経路には除外が効かない。過去監査（`shrine-dataset-integrity.md`,
`production-canonical-set-preflight.md`）は id 102 を座標nullと記録しており、
それが現在も真であれば地理系queryからも落ちる。**現在の座標は未実測**。

---

## UNKNOWN

以下はProduction read-only queryの実行によってのみ確定する。

| id | 未確定事項 | 確認事項 |
|---|---|---|
| U1 | id 102 の全保存field（現在値） | 1 |
| U2 | `created_at` / `updated_at` の実値、座標のnull性、`kind`、`owner_id`、`place_ref_id`、各counter | 2 |
| U3 | 15関係すべてにおける `shrine_id=102` の参照件数 | 3 |
| U4 | favorites / goshuin / visit / like / interaction log からの参照有無 | 4 |
| U5 | id 102 が現在も単独のQA命名行か、群の一部か | 7 |
| U6 | `created_at` が既存投入バッチと同時刻かどうか | 7 |

**U3 / U4 は過去のいかなる監査でも id 102 について測定されていない**
（F8・I2の注記参照）。「参照0件」は現時点で未確認であり、仮定してはならない。

---

## Production references

```text
PRODUCTION_REFERENCE_MEASUREMENT = NOT_EXECUTED
理由: 本実行環境にProduction credentialが存在しない

scripts/migration_safety/check_credential_presence.sh \
  ~/.config/kami-musubi/production-db.env DATABASE_URL
=> VAR_SET=0
```

`scripts/migration_safety/README.md` の契約どおり、この tooling は
Productionへ自動接続しない。実行可否は毎回人間が決める。

### 実行手順（利用者側）

```bash
scripts/migration_safety/readonly_query.sh \
  ~/.config/kami-musubi/production-db.env DATABASE_URL \
  scripts/migration_safety/sql/shrine_id102_investigation.sql
```

### 用意したquery

`scripts/migration_safety/sql/shrine_id102_investigation.sql`

- SELECT のみ。`guard.py check-readonly-sql` = `SAFE: ok`
- 使い捨てローカルDB（migrate済みschema）に対して全6 sectionの実行を検証済み
  （`psql exit=0`、15関係すべてのtable/column名が解決）

| section | 取得内容 | 対応する確認事項 |
|---|---|---|
| 1 | id=102 の全保存field | 1 |
| 2 | identity + 監査field（id取り違え防止のため identity 側からも照合） | 1, 2 |
| 3 | 15関係すべての参照件数 | 3, 4 |
| 4 | id 96〜110 の近傍行 | 7 |
| 5 | QA命名規約に一致する全行 | 7 |
| 6 | `created_at` の分単位分布 | 7 |

---

## Repository evidence

| # | 種別 | 内容 |
|---|---|---|
| R1 | 不在証拠 | code / Seed / fixtures / migrations / tests に0 hit（F1） |
| R2 | 不在証拠 | git履歴はroot commitがsquashed importのため作成痕跡を保持し得ない（F2） |
| R3 | 契約 | `shrine_qa_fixture_exclusion.py` が `name_jp LIKE 'テスト%'` で除外（F3） |
| R4 | gap | 公開API 3経路に除外が適用されない（F4） |
| R5 | schema | Shrine被参照15関係（F5） |
| R6 | schema | `created_at` / `updated_at` 存在。`updated_at` は `auto_now` で証跡にならない（F6） |
| R7 | 履歴 | id 102 対象migrationは0件。101/103/104/105 は削除済み（F7） |
| R8 | 決定不在 | id 102 のMother Ship決定tokenが存在しない（F8） |
| R9 | 二次記録 | `temples-0091-production-remediation.md` が手動テストセッション由来と結論（I2） |
| R10 | 二次記録 | `production-canonical-set-preflight.md` が「0 lat/lng, 0 tags, 0 knowledge, empty goriyaku/sajin」と記録 |
| R11 | 二次記録 | `p6-id1-user-observation-data-review.md` が「no Knowledge Facts」と記録 |

---

## 確認事項7の分類: QA / smoke test由来と断定できるか

```text
CLASSIFICATION = CIRCUMSTANTIAL_STRONG_NOT_CONCLUSIVE
```

**断定を支持する材料**

- 名称 `テスト確認神社` と住所 `東京テスト` が明示的にテスト値である
- 接尾辞 `20260611` がProduction唯一ユーザーの `date_joined` 日付と一致する
- 同一連番帯（101〜105）の他4行が手動テスト由来と既に結論・除去されている
- 既存のQA fixture除外契約が名称規約で当該行を捕捉している

**断定を妨げる材料**

- id 102 自身の `created_at` も参照関係も、過去のどの監査でも測定されていない
- `temples-0091` のFK確認対象に id 102 は含まれていない
- 特定のQA実行・smoke testと当該行を直接結びつける記録（実行ログ、issue、
  test code）がrepository内に存在しない
- 名称規約による一致は「テスト目的である」ことの十分条件ではない
  （`広島市` が名称規約に一致しなかったのと対称の限界）

したがって「QA由来である」は**強い状況証拠に支えられた推論**であり、
**断定ではない**。削除判断の根拠として単独で用いてはならない。

---

## Recommended Mother Ship decision options

いずれも本タスクでは選択しない。決定はMother Shipに委ねる。

### Option A: KEEP_AS_IS + 非canonical registryの明示化

id 102 をProductionに残したまま、Reconciliation Gateが「既知の想定内
PROD_ONLY」として扱えるよう、非canonical行の明示registryを導入する。

- 含意: Gateが恒久的にFAILし続ける状態を解消できる。Production変更を伴わない。
- 必要作業: registry形式の決定、Gateへの例外表の追加、registryの正本管理
- 副作用: 「例外表に載せれば通る」経路を作るため、registryの追加条件を
  厳格に定義しないと将来のdriftを隠す

### Option B: REMOVE（P8-Bと同型の可逆data migration）

`0101_p8b_remove_non_shrine_artifact_id105.py` と同じ設計
（`REVERSIBLE_DATA_MIGRATION`, fail-closed, PRE read必須）で削除する。

- 前提条件: U3 / U4 の実測で全15関係の参照が0件であること
- 参照が1件でも存在する場合、P8-Aの `MOVE_TO_PRIMARY` に相当する移送先が
  存在しない（id 102 には対応するprimaryが無い）ため、別途user data policyの
  決定が必要になる
- 含意: Production件数が103となりGateがPASSする。Base Seedと完全一致する
- 必要作業: Production PRE read、migration実装、reversibility設計、
  fail-closed guard、回帰test

### Option C: ADD_TO_SEED

id 102 をBase Seedへ追加してGateをPASSさせる。

- 含意: テスト値（`東京テスト`）をcanonical Base Seedに永続化することになり、
  W0-B01が確立した「Base Seed = 実在神社の正本」という前提を壊す
- **本監査は、実在神社であることの証拠が皆無である現状において、
  この選択肢を推奨しない**（判断ではなく、証拠状況の報告として記す）

### Option D: 判断保留 + Gate運用の切り分け

id 102 の disposition を保留したまま、Gateの出力を
`PROD_ONLY_KNOWN` と `PROD_ONLY_NEW` に分離し、新規driftの検出能力だけを
先に回復させる。

- 含意: 決定を急がずにGateを運用に載せられる
- 副作用: Option Aと同じく、既知扱いの範囲定義を誤ると新規driftを取り逃す

### 決定に先立って必要な入力

```text
1. U3 / U4 の実測（scripts/migration_safety/sql/shrine_id102_investigation.sql）
2. 参照が存在した場合のuser data policy
3. Gateが非canonical行をどう扱うかの方針（Option A / D の要否）
```

---

## STATUS

```text
STATUS = NEED_MORE_EVIDENCE
```

確認事項 5・6 は完了。1・2・3・4・7 はProduction read-only queryの実行を
待って確定する。query は作成・検証済みで、実行だけが残っている。

## STOP

Productionを変更せずSTOPした。

```text
Production INSERT / UPDATE / DELETE = 0
migration                            = 0
Base Seed write                      = 0
Recommendation Ranking / Score change = 0
自動cleanup                          = 0
disposition決定                      = 0
```
