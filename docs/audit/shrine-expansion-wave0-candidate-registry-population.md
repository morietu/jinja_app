# Shrine Expansion Wave 0 Candidate Registry Population

## Status

- Status: `P0_A_COMPLETE_PRODUCTION_UNCHANGED`
- Recorded at: `2026-09-10`
- Scope: Historical Wave0 44 candidates
- Production DB write: なし
- Shrine seed write: なし
- Knowledge Fact write: なし
- Recommendation / Concierge / Compass runtime変更: なし

## 目的

PR #2780で定義したFoundation P0-Aとして、空だったCandidate Masterを実体化し、Wave0 44候補をData Build lifecycleで追跡可能にする。

本工程はFactの一括hydrationやProduction importではない。

## Registry Accounting

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

`BUILD_READY` 35社はPR #2779のCORE READY候補と一致する。

`HOLD` 8社は既存の3 queueを保持する。

- HOLD_MAPPING: 姫嶋神社 / 行田八幡神社
- SOURCE_HOLD: 若宮八幡社 / 富知六所浅間神社 / 若宮神明社
- UNKNOWN_EVIDENCE: 居多神社 / 唐澤山神社 / 一之宮貫前神社

`REVIEW` 1社は諏訪大社 下社秋宮で、entity granularityのMother Ship判断待ちを維持する。

## Lifecycle Contract Extension

Candidate Master schemaを`1.0 -> 1.1`へ更新し、以下のlifecycleを追加した。

```text
DISCOVERED
BUILD_READY
IMPORTED
CORE_READY
HOLD
REVIEW
```

重要な境界:

- BUILD_READYはData Build開始可能という意味
- BUILD_READYはProduction Import許可ではない
- IMPORTEDはProduction write後かつpost-import QA前
- CORE_READYはCompletion Contractを満たした後だけ
- HOLD / REVIEWはCandidate rejectionではない

## Sub-status Boundary

P0-Aでは過去AuditのavailabilityをFact確定へ昇格しない。

43 NEW候補について:

```text
duplicate_status = NEW
official_source_status = AVAILABLE
knowledge_status = ACQUISITION_PATH_CONFIRMED
identity_status = UNREVIEWED
```

諏訪大社 下社秋宮は43 NEW scope外のため:

```text
duplicate_status = REVIEW
official_source_status = UNREVIEWED
knowledge_status = UNREVIEWED
identity_status = UNREVIEWED
```

`AVAILABLE`はSource取得経路あり、`ACQUISITION_PATH_CONFIRMED`はDeity/History取得経路ありという意味に限定する。

## Factual Hydration Boundary

P0-Aでは以下を過去Auditから一括コピーしない。

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

これらは各W0-Batchの `Source Packet Freeze -> Candidate Master Update` で採用値として確定する。

したがってP0-A直後のBUILD_READY candidateでも、上記fieldはCandidate objectから省略されている。

## Batch Assignment

PR #2780のdeterministic groupingをそのまま登録した。

```text
W0-B01 = 5
W0-B02 = 5
W0-B03 = 5
W0-B04 = 5
W0-B05 = 5
W0-B06 = 5
W0-B07 = 5
```

HOLD / REVIEW候補にはbuild_batchを付けない。

Batch assignmentはProduct priorityではない。

## Discovery Provenance

`docs/audit/shrine-expansion-candidate-pool-wave0.md`のOmairi ranking snapshotをそのまま転記した。

各Candidateは以下を保持する。

```text
discovery_source
discovery_source_url
discovery_rank
captured_at
```

Discovery SourceをOfficial Fact Sourceへ昇格しない。

## Validation

`backend/temples/tests/test_shrine_expansion_candidate_master.py`を追加し、以下を固定する。

1. schema_version = 1.1
2. 44 candidates
3. candidate_id unique
4. BUILD_READY 35 / HOLD 8 / REVIEW 1
5. reason accounting 35 / 2 / 3 / 3 / 1
6. W0-B01〜B07が各5社
7. HOLD / REVIEWはbatch null
8. duplicate NEW 43 / REVIEW 1
9. 3 HOLD queueのmembership
10. entity granularity REVIEWが諏訪大社 下社秋宮1社
11. Discovery provenance必須field

## Non-Goals

- Production DB import
- Shrine seed追加
- Knowledge seed生成
- Source本文の再Review
- Official identity freeze
- Position adoption write
- goriyaku / goriyaku_tags hydration
- HOLD解消
- 諏訪大社entity granularity判断
- Recommendation / Ranking変更

## Next

P0-A完了後もW0-B01開始にはP0-B `import_shrines_seed safe goriyaku_tags extension` が必要である。
