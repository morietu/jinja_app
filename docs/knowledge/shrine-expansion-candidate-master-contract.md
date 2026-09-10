# Shrine Expansion Candidate Master Contract

## Status

- Status: `ACTIVE`
- Effective from: `2026-09-10`
- Scope: KAMI MUSUBI 神社500社拡充の pre-import Candidate 管理
- Schema version: `1.1`
- Runtime / DB schema change: なし

## 目的

神社500社拡充で、候補発見・重複確認・公式Source確認・Knowledge確認・Data Build・Production Import・CORE READY確認を分離する。

Candidate Masterは本番Shrine DBではない。
Candidate Masterへ登録しただけでは、Concierge / Compassで利用可能とはみなさない。

## 正本ファイル

`backend/temples/data/shrine_expansion_candidate_master.json`

## Candidate Identity

Candidateは `candidate_id` で一意に管理する。

`candidate_name + prefecture` はDiscovery時点の識別補助であり、正式なreal-world identity確定キーとして扱わない。

同名神社は別Candidateになり得るため、name-only dedupeは禁止する。

`wave_id` はCandidateが属するExpansion Waveを表す。Wave0では `W0` を使用する。

## Candidate Defaults

Candidate Masterは、Wave単位で共通する値を `candidate_defaults` に保持できる。

P0-A Wave0では以下を共通値として持つ。

```text
wave_id = W0
identity_status = UNREVIEWED
official_source_status = AVAILABLE
knowledge_status = ACQUISITION_PATH_CONFIRMED
candidate_reason = historical_recovered_popularity_candidate
```

Candidate objectに同名fieldが存在する場合は、Candidate側の値をoverrideとして優先する。

例として `諏訪大社 下社秋宮` は43 NEW scope外のため、`official_source_status` と `knowledge_status` を `UNREVIEWED` でoverrideする。

`candidate_defaults` は値の省略を可能にするためのJSON正規化であり、監査結果を変更する仕組みではない。

## Discovery Provenance

同一Candidateが複数Sourceに現れることを前提に、Discovery情報は `discovery_sources[]` として複数保持する。

各Discovery Sourceには最低限以下を必須とする。

```text
discovery_source
discovery_source_url
discovery_rank
captured_at
```

### discovery_source

候補を見つけたSource名。

例:

```text
Omairi 全国神社人気ランキング2026
巡縁 全国初詣参拝者数ランキング
じゃらん 都道府県別神社ランキング
```

### discovery_source_url

候補を見つけたページのURL。

神社の祭神・由緒・所在地・ご利益を確定するFact Sourceとしては使わない。

### discovery_rank

ランキング順位が存在する場合の順位。

順位が存在しないDiscovery Sourceでは `null` を許可する。

### captured_at

そのDiscovery Sourceを確認した日付。`YYYY-MM-DD` とする。

ランキングは変動するため、URLだけ保存して日時を省略してはならない。

## Source Boundary

Discovery SourceとOfficial Fact Sourceを混在させない。

```text
Discovery Source
= 候補を見つけた根拠

Official Fact Source
= 神社について事実を確定する根拠
```

祭神、由緒、所在地、ご利益等は、神社公式サイト、神社庁、自治体、文化財資料等の確認可能なSourceで確定する。

Popularity / RankingはRecommendation Scoreの根拠にしない。

## Candidate Lifecycle

`candidate_status` はCandidateのData Build / Production lifecycleだけを表す。Evidence分類やduplicate分類をこの1fieldへ押し込まない。

許可値:

```text
DISCOVERED
BUILD_READY
IMPORTED
CORE_READY
HOLD
REVIEW
```

### DISCOVERED

Candidate Poolへ発見・登録された状態。Build readinessはまだ主張しない。

### BUILD_READY

Pre-build Availability / QA Gateを通過し、Data Build Batchへ進める状態。

これは以下を意味しない。

- Production DBへ投入済み
- Candidate Masterのfactual fieldがすべてhydration済み
- Production Import許可済み
- Recommendation eligible
- CORE READY

Wave0 P0-Aでは、PR #2779で抽出した35社だけを `BUILD_READY` とする。

### IMPORTED

Base ShrineおよびそのBatchで必要なKnowledge dataがProductionへwriteされたが、Post-import CORE READY QAがまだ完了していない状態。

Importだけで `CORE_READY` へ進めない。

### CORE_READY

`docs/audit/shrine-expansion-wave0-data-build-plan.md` のCORE READY Completion Contractを満たし、Production post-import QAがcloseした状態。

### HOLD

Candidateは保持するが、明示的なunresolved GateによりData Buildへ進めない状態。

Wave0で使用する理由コード:

```text
HOLD_MAPPING
SOURCE_HOLD
UNKNOWN_EVIDENCE
```

HOLDをCandidate rejectionと同義にしない。

### REVIEW

Mother Ship判断または明示的なhuman review待ち。

Wave0では `ENTITY_GRANULARITY_REVIEW` を使用する。

`諏訪大社 下社秋宮` はこの状態を維持する。

## status_reason_code

`candidate_status` の理由をmachine-readableに保持する。

Wave0 P0-Aで許可する値:

```text
WAVE0_CORE_READY_CANDIDATE
HOLD_MAPPING
SOURCE_HOLD
UNKNOWN_EVIDENCE
ENTITY_GRANULARITY_REVIEW
```

Lifecycle stateとEvidence詳細を分離したまま、後続Batchが「なぜ止まっているか」を追跡できることを目的とする。

## build_batch

Data Buildのoperational grouping。

Wave0では:

```text
W0-B01
W0-B02
W0-B03
W0-B04
W0-B05
W0-B06
W0-B07
```

を使用する。

- `BUILD_READY` 35社だけがP0-A時点でbatch assignmentを持つ。
- 各Batchは5社。
- HOLD / REVIEWは `null`。
- Batch順はProduct priorityではない。
- PR #2780のdeterministic groupingをそのまま使用する。

## Sub-status Contract

Lifecycleと個別Gateを分離するため、以下を別fieldで保持する。

### identity_status

```text
UNREVIEWED
CONFIRMED
```

P0-A Registry Populationではfinal Source Packet Freezeをまだ実施しないため、Wave0候補は `UNREVIEWED` のまま保持する。

### duplicate_status

```text
UNREVIEWED
NEW
DUPLICATE
ALIAS
SAME_NAME_DIFFERENT_SHRINE
REVIEW
```

Wave0 Current DB Duplicate Audit結果をそのまま使用する。

### official_source_status

```text
UNREVIEWED
AVAILABLE
CONFIRMED
HOLD
```

`AVAILABLE` はAccepted Sourceへの取得経路が確認済みという意味であり、per-batch Source Packet Freeze済みという意味ではない。

### knowledge_status

```text
UNREVIEWED
ACQUISITION_PATH_CONFIRMED
FACT_READY
HOLD
```

`ACQUISITION_PATH_CONFIRMED` はusable Deity / History候補を生成できる取得経路が確認済みという意味であり、Fact生成・Source relation・Evidence Gate完了を意味しない。

## Factual Field Hydration Boundary

P0-AはRegistry / Lifecycle Foundationであり、過去AuditのFact候補をCandidate Masterへ一括転記しない。

以下は各Data Build Batchの `Source Packet Freeze -> Candidate Master Update` で確定値を入れる。

```text
official_name
official_address
official_source_type
official_source_url
verified_at
latitude
longitude
goriyaku
goriyaku_tags
```

したがって `BUILD_READY` でも、P0-A直後はこれらがCandidate objectから省略されているか、null / emptyであり得る。

これは欠損ではなく、監査上の「取得可能」とData Build上の「採用済み」を分離するための意図的な境界である。

## Duplicate Rule

重複判定はname-onlyで行わない。

最低限、以下を照合する。

```text
candidate_name
prefecture
official_name
official_address
latitude
longitude
Google Place ID / provider identity（利用可能な場合）
```

Candidate Master内で同一real-world shrineと確定したCandidateは、別レコードのまま放置せずcanonical CandidateへDiscovery Sourceを統合する。

## Fact / Knowledge Fields

DB投入前に最低限以下を確認する。

```text
official_name
official_address
official_source_type
official_source_url
verified_at
latitude
longitude
duplicate_status
goriyaku
goriyaku_tags
```

`goriyaku` と `goriyaku_tags` は推測で埋めない。

## Lifecycle Transition

標準遷移:

```text
DISCOVERED
  -> BUILD_READY
  -> IMPORTED
  -> CORE_READY
```

Gate未解決時:

```text
DISCOVERED / BUILD_READY / IMPORTED
  -> HOLD or REVIEW
```

解決後:

```text
HOLD / REVIEW
  -> BUILD_READY
```

遷移は監査・Production実測を根拠に行う。状態を見た目だけ合わせるための自動昇格は禁止する。

## Concierge / Compass Boundary

Candidate Masterへの登録や `BUILD_READY` はRecommendation eligibilityを意味しない。

DB投入後も、現行の共有Recommendation EligibilityおよびConcierge / Compassのruntime contractを通過する必要がある。

Candidate MasterはRanking / Direction / Distance / Recommendation Scoreを変更しない。

## Historical Wave0 Registry

初期Candidate Registryには、過去のOmairi監査から再確認できた44社を `historical_recovered_popularity_candidate` として登録する。

会計:

```text
BUILD_READY = 35
HOLD = 8
  HOLD_MAPPING = 2
  SOURCE_HOLD = 3
  UNKNOWN_EVIDENCE = 3
REVIEW = 1
  ENTITY_GRANULARITY_REVIEW = 1
TOTAL = 44
```

過去に主張された50社のうち残り6社は、`docs/audit/shrine-expansion-historical-candidate-audit.md` の結論に従い推測で補完しない。

初期44社のOmairi断片は同一日時の単一TOP100ではないため、各Discovery Sourceにページごとの `captured_at` を保持する。

## Non-Goals

- Candidate登録だけでShrine DBへ投入しない
- `BUILD_READY`だけでRecommendation対象にしない
- P0-AでSource本文の再採用判断をしない
- P0-Aでfactual fieldsを監査文書から一括転記しない
- Ranking SourceをFact Sourceにしない
- PopularityをRecommendation Scoreへ追加しない
- name-onlyでduplicate判定しない
- 不明なFactをAI推測で補完しない
- HOLD / REVIEWを自動解除しない
