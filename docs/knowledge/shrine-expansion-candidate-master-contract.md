# Shrine Expansion Candidate Master Contract

## Status

- Status: `ACTIVE`
- Effective from: `2026-09-09`
- Scope: KAMI MUSUBI 神社500社拡充の pre-import Candidate 管理
- Runtime / DB schema change: なし

## 目的

神社500社拡充で、候補発見・重複確認・公式Source確認・Knowledge確認・DB投入を分離する。

Candidate Masterは本番Shrine DBではない。
候補を登録しただけでは、Concierge / Compassで利用可能とはみなさない。

## 正本ファイル

`backend/temples/data/shrine_expansion_candidate_master.json`

## Candidate Identity

Candidateは `candidate_id` で一意に管理する。

`candidate_name + prefecture` はDiscovery時点の識別補助であり、
正式なreal-world identity確定キーとして扱わない。

同名神社は別Candidateになり得るため、name-only dedupeは禁止する。

## Discovery Provenance

同一Candidateが複数Sourceに現れることを前提に、
Discovery情報は `discovery_sources[]` として複数保持する。

各Discovery Sourceには最低限以下を必須とする。

```text
discovery_source
discovery_source_url
discovery_rank
captured_at
```

### discovery_source

候補を発見したSource名。

例:

```text
Omairi 全国神社人気ランキング2026
巡縁 全国初詣参拝者数ランキング
じゃらん 都道府県別神社ランキング
```

### discovery_source_url

候補を発見したページのURL。

神社の祭神・由緒・所在地・ご利益を確定するFact Sourceとしては使わない。

### discovery_rank

ランキング順位が存在する場合の順位。

順位が存在しないDiscovery Sourceでは `null` を許可する。

### captured_at

そのDiscovery Sourceを確認した日付。
`YYYY-MM-DD` とする。

ランキングは変動するため、URLだけ保存して日時を省略してはならない。

## Source Boundary

Discovery SourceとOfficial Fact Sourceを混在させない。

```text
Discovery Source
= 候補を見つけた根拠

Official Fact Source
= 神社について事実を確定する根拠
```

祭神、由緒、所在地、ご利益等は、
神社公式サイト、神社庁、自治体、文化財資料等の確認可能なSourceで確定する。

Popularity / RankingはRecommendation Scoreの根拠にしない。

## Candidate Status

初期状態:

```text
candidate_status = DISCOVERED
identity_status = UNREVIEWED
duplicate_status = UNREVIEWED
official_source_status = UNREVIEWED
knowledge_status = UNREVIEWED
```

将来の状態追加は別PRで契約を更新する。

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

Candidate Master内で同一real-world shrineと確定したCandidateは、
別レコードのまま放置せずcanonical CandidateへDiscovery Sourceを統合する。

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

## Concierge / Compass Boundary

Candidate Masterへの登録はRecommendation eligibilityを意味しない。

DB投入後も、現行の共有Recommendation Eligibilityおよび
Concierge / Compassのruntime contractを通過する必要がある。

Candidate MasterはRanking / Direction / Distance / Recommendation Scoreを変更しない。

## Historical Recovery

初期Candidate Poolには、
過去のOmairi監査から再確認できた44社を `historical_recovered_popularity_candidate`
として登録する。

過去に主張された50社のうち残り6社は、
`docs/audit/shrine-expansion-historical-candidate-audit.md` の結論に従い
推測で補完しない。

初期44社のOmairi断片は同一日時の単一TOP100ではないため、
各Discovery Sourceにページごとの `captured_at` を保持する。

## Non-Goals

- Candidate登録だけでShrine DBへ投入しない
- Candidate登録だけでRecommendation対象にしない
- Ranking SourceをFact Sourceにしない
- PopularityをRecommendation Scoreへ追加しない
- name-onlyでduplicate判定しない
- 不明なFactをAI推測で補完しない
