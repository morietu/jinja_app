# Shrine Expansion Wave 0 Data Build Plan

## Status

- Status: `DESIGN_COMPLETE_EXECUTION_NOT_STARTED`
- Recorded at: `2026-09-10`
- Scope: `docs/audit/shrine-expansion-wave0-core-ready-candidates.md` で抽出済みの CORE READY候補35社
- Production DB write: なし
- Shrine seed write: なし
- Candidate Master data write: なし
- Knowledge Fact write: なし
- `goriyaku_tags` M2M write: なし
- Recommendation / Ranking / Concierge / Compass runtime変更: なし

## 目的

Wave0のCORE READY候補35社を、監査上の「取得可能」状態から、ProductionでConcierge / Compassが実際に利用できる `CORE READY` 状態へ安全に移すためのData Build / Import工程を定義する。

本書は実データ投入そのものではない。

既存Pipelineを捨てて新しい並行実装を作らず、現行の `import_shrines_seed`、`import_shrine_knowledge`、Evidence Gate、Coverage toolingを再利用する。

## CORE READY Completion Contract

各Shrineは、以下をすべて満たした時のみ実 `CORE READY` と扱う。

1. Production `Shrine` rowがcanonical `name_jp + address`で一意に存在する
2. 採用済み `latitude / longitude` が保存されている
3. Source-backedな `ShrineKnowledgeSource` が存在する
4. 少なくとも1件の `ShrineDeity` または `ShrineHistory` がFact-readyである
5. 上記Factに少なくとも1件のFact-ready Source relationがあり、Evidence Gateで `usable=True` となる
6. `Shrine.goriyaku` はSource-backed Reviewで承認した意味だけを保持する
7. `Shrine.goriyaku_tags` は既存39 canonical `GoriyakuTag` の安全なsubsetだけを保持する
8. 新規GoriyakuTagを自動生成しない
9. Conciergeのshared eligibility / scoring candidate pathで当該Shrineを読み取れる
10. Compassのshared eligibility通過後、座標からdistance / direction計算が可能
11. Import再実行時にunexpected CREATE / UPDATEが発生しない
12. Candidate Master上でもProduction状態と整合する

`CORE READY候補` と `CORE READY` は同義ではない。

## 現行資産の再利用判定

### Base Shrine

`backend/temples/management/commands/import_shrines_seed.py`

- canonical sourceは `backend/temples/data/shrines_seed_clean.json`
- `name_jp + address`完全一致で既存rowを解決
- `--dry-run`あり
- `transaction.atomic()`あり
- 新規35社のbase row投入には再利用可能

### Knowledge

`backend/temples/management/commands/import_shrine_knowledge.py`

- `--validate-only`
- `--dry-run`
- apply mode
- Source identity conflict / ambiguousをblocking errorにする
- Shrine NOT_FOUND / AMBIGUOUSをblocking errorにする
- Deity / Historyは既存一致時 `SKIP_EXISTS`
- applyはsingle atomic transaction

Batch 1〜17で実運用済みのため `REUSE_AS_IS` とする。

### Evidence Gate / Coverage

- `backend/temples/services/evidence_gate.py`
- `backend/temples/management/commands/knowledge_coverage_report.py`

既存を `REUSE_AS_IS` とする。

## 発見した2つのPrecondition Gap

### Gap A: Candidate Masterが空

現行正本:

`backend/temples/data/shrine_expansion_candidate_master.json`

はContractだけ存在し、現在 `candidates: []` である。

Candidate Master Contractは、Candidateをpre-import registryとして保持し、official name / address / source / verified_at / latitude / longitude / duplicate / goriyaku / goriyaku_tagsをDB投入前に確認する契約である。

したがって35社のProduction seedを先に追加せず、Candidate Masterを先に実体化する。

また現行Contractはstatus追加を別PRと定めているため、Production lifecycleをCandidate Masterへ記録する場合は、status contract extensionを独立PRにする。

### Gap B: 現行 `backfill_goriyaku_tags` はWave0 Activationにそのまま使わない

`backend/temples/management/commands/backfill_goriyaku_tags.py` は:

- 対象Shrineを広く走査する
- `Shrine.goriyaku`をdelimiter splitする
- `GoriyakuTag.objects.get_or_create(name=name)` を実行する

ため、Wave0 35社だけを限定して安全にActivationする用途ではblast radiusが大きい。

特にtypo / non-canonical wordingが `goriyaku` に混入した場合、既存39外のGoriyakuTagを新設できる。

Wave0 Data Buildではこの挙動を利用して新タグを作らない。

## Required Minimal Extension

新規parallel commandは作らない。

既存 `import_shrines_seed.py` を最小拡張し、seed rowに明示された `goriyaku_tags` を安全にM2Mへ反映できるようにする方針を採用する。

### Required contract

1. `goriyaku_tags` keyがrowに無い場合、既存M2Mを変更しない
2. keyがある場合のみM2M planを評価する
3. 値は既存canonical tag nameのlistのみ許可する
4. `GoriyakuTag.objects.get_or_create()` は使用しない
5. unknown tagが1件でもあればimportをblockする
6. existing 39 master以外を作らない
7. `--dry-run`でM2M CREATE/REMOVE予定を表示する
8. dry-runではDB状態を残さない
9. applyはShrine base rowと同一transaction内で行う
10. 既存seed rowに `goriyaku_tags` が無い場合の従来挙動を壊さない
11. `--with-visit-style`相当の自動推測は本Data Buildでは使わない

この変更は `EXTEND_EXISTING` であり、新しいImporterを追加しない。

## Batch Size

35社を一度にProductionへ投入しない。

Data Buildの標準単位を **5社 / Batch、最大5社** とする。

理由:

- Source / FactのHuman Review量を制限できる
- 1社のidentity conflictで35社全体を止めない
- Production差分を5社単位で検証できる
- rollback / incident isolationがしやすい
- 現行Batch運用の思想を維持できる

Batch membershipはProduct priorityで決めず、既存CORE READY候補表の順番をそのまま機械的に5社ずつ切る。

### Wave0 Build Batch

**Namespace 注記（W0-B03 Namespace Reconciliation, schema 1.2）**

Data Build Batch の canonical namespace は `W0-DB01`〜`W0-DB07` である。
旧表記 `W0-B01`〜`W0-B07` は Wave0 の**工程ID**（`W0-B01` = Base Shrine Seed
Build / `W0-B02` = Production Shrine Reconciliation / `W0-B03` = 本 Namespace
Reconciliation）と衝突していたため、Data Build Batch 側だけを改名した。
member set は不変である。

| Batch | legacy | Shrines |
|---|---|---|
| W0-DB01 | `W0-B01` | 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮 |
| W0-DB02 | `W0-B02` | 射水神社 / 別小江神社 / 戸隠神社 中社 / 札幌諏訪神社 / 少彦名神社 |
| W0-DB03 | `W0-B03` | 大神神社 / 北野天満宮 / 宮城縣護國神社 / 平安神宮 / 岡田宮 |
| W0-DB04 | `W0-B04` | 建勲神社 / 水堂須佐男神社 / 大阪天満宮 / 毛谷黒龍神社 / 大崎八幡宮 |
| W0-DB05 | `W0-B05` | 鎌数伊勢大神宮 / 廣田神社 / 石浦神社 / 洲崎神社 / 來宮神社 |
| W0-DB06 | `W0-B06` | 蛇窪神社 / 櫻岡大神宮 / 三嶋大社 / 柏神社 / 櫛田神社 |
| W0-DB07 | `W0-B07` | 坪沼八幡神社 / 菊田神社 / 伊奈波神社 / 青島神社 / 西宮神社 |

この順番は優先順位ではない。既存Audit順を保持するためのdeterministic groupingである。

次の Data Build target は **`W0-DB01`**。

## One-time Foundation PRs

### Foundation PR A: Candidate Master Lifecycle / Population

目的:

- Candidate Master ContractへData Build / Import lifecycleで必要なstateを追加する
- Historical Wave0 44候補をCandidate Masterへ実体化する
- 35 CORE READY候補、8 hold、1 entity granularity reviewを混在させず記録する

候補state名はContract PR内で確定する。少なくとも以下の意味を表現できる必要がある。

```text
DISCOVERED
BUILD_READY
IMPORTED
CORE_READY
HOLD
REVIEW
```

identity / duplicate / official source / knowledgeのsub-statusも、現行Audit結果を表現できるContractにする。

本PRではProduction DBへ書き込まない。

### Foundation PR B: Safe goriyaku_tags Seed Activation

目的:

- `import_shrines_seed` を最小拡張
- explicit `goriyaku_tags` listを既存39 tagに限定して安全にset可能にする
- unknown tag時block
- existing rowsにkeyが無い時はM2M untouched
- unit / command testsを追加

担当: Codex

## Per-Batch Data Build Flow

各 `W0-DB01`〜`W0-DB07` は同じ工程を反復する（旧表記 `W0-B01`〜`W0-B07`）。

### Phase 1: Source Packet Freeze

各5社について既存Auditで採用したSourceを再確認し、以下を確定する。

```text
official_name
official_address
official_source_type
official_source_url
verified_at
latitude
longitude
approved goriyaku wording
safe canonical goriyaku_tags
Deity source-backed facts
History source-backed facts
```

新しいFactを神社名・祭神名・歴史イメージから推測しない。

Source本文が変わっており過去Auditと整合しない場合は、そのShrineだけHOLDへ戻す。

### Phase 2: Candidate Master Update

対象5社をCandidate Master上でBuild対象として固定する。

少なくとも:

- canonical identity
- official Source
- verified_at
- adopted coordinate
- duplicate result
- approved goriyaku
- safe goriyaku_tags
- batch id

を追跡可能にする。

### Phase 3: Base Shrine Seed Build

`backend/temples/data/shrines_seed_clean.json` へ対象5社を追加する。

必須:

```text
name_jp
address
latitude
longitude
goriyaku
goriyaku_tags
```

既存Shrine rowは変更しない。

`goriyaku`にはSource-backed Reviewで採用した内容だけを入れる。
`goriyaku_tags`にはNormalization AuditでPASSしたexisting canonical labelsだけを入れる。

### Phase 4: Knowledge Seed Build

Batchごとにversioned Knowledge seedを作る。

例:

`backend/temples/data/knowledge_seeds/wave0_batch_01_seed.json`

既存 `batch_17_seed.json` schemaをそのまま利用する。

- `sources[]`
- shrine `name_jp + address` ref
- `deities[]`
- `histories[]`
- source_keys relation
- verification_status
- confidence
- verified_at

Source / Deity / Historyは既存Knowledge Contractに従う。

### Phase 5: Test Build

Batch seedごとにtestを追加する。

最低限:

1. JSON parse / schema
2. Shrine identity 5社が重複しない
3. Knowledge seed shrine_refがBase Seed identityと一致
4. Fact source_keysが存在する
5. Fact-ready Factにsource relationがある
6. goriyaku_tagsがexisting canonical 39だけである
7. HOLD 8社が誤混入していない
8. 同一Batchの再importがidempotent

### Phase 6: Isolated DB Preflight

Productionへ触れる前にscratch / isolated PostgreSQLで:

1. current developを再構築
2. Base Shrine seed import
3. Knowledge `--validate-only`
4. Knowledge `--dry-run`
5. apply
6. Evidence Gate
7. goriyaku_tags exact set確認
8. second dry-run / second import idempotency
9. backend regression tests
10. `makemigrations --check`

を完了する。

### Phase 7: Data PR

1 Batch = 1 Data PRとする。

変更範囲:

- Candidate Master対象5社
- `shrines_seed_clean.json`対象5社
- `wave0_batch_N_seed.json`
- batch seed test
- preflight audit doc

変更しない:

- Recommendation score
- NEED_TO_GORIYAKU_IDS
- GoriyakuTag master 39
- Compass algorithm
- Concierge UI
- unrelated existing Shrine data

PR mergeがProduction Import許可を自動的に意味しない。

## Production Import Gate

Render無料枠のため、既存実績どおりProduction writeはMother ShipのローカルMacから実行する。

Production credentialは:

- chatへ貼らない
- repoへcommitしない
- AIへ渡さない
- repo外の既存credential bridge運用を継続する

### Production execution order

1. fresh `develop`
2. Production backup / current counts確認
3. Base Shrine full seed `--dry-run`
4. expected delta確認
5. Base Shrine apply
6. Knowledge `--validate-only`
7. Knowledge `--dry-run`
8. expected Source / Deity / History delta確認
9. Knowledge apply
10. post-import QA

Base Shrine apply後にKnowledge importが停止しても、Shared Recommendation Eligibilityはusable Deity / History Factを要求するため、Knowledge未投入の新規Shrineを推薦対象へ自動昇格させない。このfail-safeを維持する。

## STOP Conditions

1件でも該当したらそのBatchをSTOPする。

- Base dry-runでexpected 5 CREATE以外のunexpected UPDATEがある
- duplicate / ambiguous identityが出る
- unknown canonical goriyaku tagがある
- importerがnew GoriyakuTagを作ろうとする
- Knowledge validate-only error
- Knowledge dry-run error
- SOURCE_REUSE_CONFLICT / AMBIGUOUS
- Shrine NOT_FOUND / IMPORT_IDENTITY_AMBIGUOUS
- source-less Fact
- Fact / Source verificationがfact-readyでない
- Evidence Gate `usable=False` しか存在しないShrineがある
- adopted coordinateが監査値と一致しない
- HOLD 8社がBatchへ混入する
- Production current stateがpreflight前提と説明不能にdriftしている

## Post-Import CORE READY QA

各5社で以下を確認する。

### Identity

- Production row exactly 1
- canonical name / address一致
- duplicate row 0

### Position

- latitude / longitude一致
- Compass distance calculation成功
- Compass direction calculation成功

### Knowledge

- expected Source count
- expected Deity / History count
- source-less Fact 0
- at least one usable Deity or History Fact per Shrine

### Goriyaku

- approved `goriyaku`一致
- expected `goriyaku_tags` set完全一致
- unexpected tag 0
- GoriyakuTag master count 39不変

### Concierge

- shared eligibility通過
- candidate setへ参加可能
- safe tagに対応するNeedでscore pathが存在する
- 必ずTop1になることはAcceptance Criteriaにしない

### Compass

- shared eligibility通過後に対象候補として読める
- coordinate calculation error 0
- 必ず選択結果Top1になることはAcceptance Criteriaにしない

### Idempotency

- Base再dry-runでCREATE 0 / UPDATE 0
- Knowledge再dry-runでCREATE 0

## Closure PR

Production ImportとQAが成功した後、BatchごとにClosure PRを作る。

記録:

- Production before / after counts
- created Shrine ids
- Source / Deity / History delta
- goriyaku / tag set
- Evidence Gate result
- Concierge QA
- Compass QA
- idempotency
- unresolved item
- Candidate Master final state update

Batch 5社すべてがCompletion Contractを満たした場合のみCandidate Masterを `CORE_READY` 相当stateへ更新する。

1社だけ失敗した場合、成功4社を巻き戻すか失敗1社をHOLDへ分離するかは、その時点のProduction実測とtransaction境界を基にMother Shipへ判断を返す。推測で状態を合わせない。

## PR Structure

```text
P0-A  Candidate Master lifecycle + Wave0 registry population
P0-B  import_shrines_seed safe goriyaku_tags extension

B01-A Wave0 Batch01 Data Build
B01-B Wave0 Batch01 Production Closure
B02-A Wave0 Batch02 Data Build
B02-B Wave0 Batch02 Production Closure
...
B07-A Wave0 Batch07 Data Build
B07-B Wave0 Batch07 Production Closure
```

合計:

- Foundation: 2 PR
- Data Build: 7 PR
- Production Closure: 7 PR
- Total planned: 16 PR

Production executionそのものはGit PRではなく、既存安全手順に従うMother Shipローカル操作である。

## AI Responsibility

### ChatGPT

- Batch仕様整理
- Source / Evidence境界レビュー
- STOP条件判定
- PRレビュー
- Production結果の整合性レビュー

### Codex

- P0-B importer最小拡張 + tests
- BatchごとのCandidate Master / base seed / Knowledge seed / tests生成
- Data PR作成

### Cursor

- seed / testの局所修正
- review指摘に対する限定修正

### Mother Ship

- Source ambiguity / taxonomy / entity granularityなど最終判断
- Production credential保持
- Production write実行
- 優先順位変更が必要な場合の最終決定

## Definition of Done for this Design Task

- Data Buildのstage / gate / STOP条件が明文化されている
- 35社が7 Batchへdeterministicに分割されている
- Candidate Master未実体化問題がPreconditionとして分離されている
- goriyaku_tagsのunsafe backfillを避ける方針が定義されている
- 新規parallel importerを作らない
- Production credentialをAIが扱わない
- Production writeを実行していない

## Next

実装開始前の最初の工程は Foundation PR A / B である。

P0-AとP0-Bのどちらを先に着手するかという優先順位は本書では最終決定しない。両方がB01 Data Buildの前提であるため、Mother Shipの実行順判断へ差し戻す。