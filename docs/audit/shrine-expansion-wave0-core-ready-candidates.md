# Shrine Expansion Wave 0 CORE READY Candidate Extraction

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-10`
- Scope: Wave 0 `NEW` 43 candidates
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- Knowledge Fact生成: なし
- `Shrine.goriyaku` write: なし
- `goriyaku_tags` M2M write: なし
- Recommendation / Ranking / Concierge / Compass runtime変更: なし

## 目的

Wave 0で完了した各Availability / QA Gateを横断し、実データ生成・Import工程へ進める `CORE READY候補` を抽出する。

本書の `CORE READY候補` は監査上の通過候補であり、Productionで既にCORE READYであることを意味しない。

実際のCORE READY化には後続工程で、Fact生成、Source relation、verification、座標・goriyaku・goriyaku_tagsの実書き込み、Import、Concierge / Compass QAが必要である。

## Gate Definition

本抽出では、Wave 0 NEW候補について以下を全て満たすことを `CORE READY候補` の条件とする。

1. Current DB duplicate audit: `NEW`
2. Official / Authority Source availability: PASS系
3. Position: `PASS` またはPosition QA後の `PASS_ANCHOR`
4. Shared Recommendation Eligibility acquisition path: usable Deity Fact候補またはusable History Fact候補を作成可能
5. Goriyaku / Recommendation Evidence: `PASS`
6. Runtime `goriyaku_tags` normalization: `PASS_NORMALIZABLE`
7. `HOLD_MAPPING` / `MAPPING_AVAILABLE_SOURCE_HOLD` / `UNKNOWN_EVIDENCE` に該当しない

## Cross-Gate Summary

```text
Original Wave0 pool                         = 44
Entity-granularity REVIEW                  = 1  (諏訪大社 下社秋宮)
Wave0 NEW                                  = 43
Official / Authority Source path           = 43 / 43
Coordinate acquisition path                = 43 / 43
Position anchor resolved                    = 43 / 43
Deity acquisition path                     = 41 / 43
History acquisition path                   = 43 / 43
Deity OR History acquisition path           = 43 / 43
Explicit goriyaku Evidence PASS            = 37 / 43
PASS_NORMALIZABLE                          = 35 / 43
HOLD_MAPPING                               = 2 / 43
MAPPING_AVAILABLE_SOURCE_HOLD              = 3 / 43
UNKNOWN_EVIDENCE                           = 3 / 43
CORE READY candidates                      = 35 / 43
```

`35 = 43 - 2 HOLD_MAPPING - 3 SOURCE_HOLD - 3 UNKNOWN_EVIDENCE`

## CORE READY候補 35社

| # | candidate_name | prefecture | Position | Deity / History path | Goriyaku Evidence | Tag normalization | Result |
|---:|---|---|---|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 2 | 大鳥大社 | 大阪府 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 3 | 御岩神社 | 茨城県 | PASS | Deity(partial) + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 4 | 烏森神社 | 東京都 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 5 | 榴岡天満宮 | 宮城県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 6 | 射水神社 | 富山県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 7 | 別小江神社 | 愛知県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 8 | 戸隠神社 中社 | 長野県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 9 | 札幌諏訪神社 | 北海道 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 10 | 少彦名神社 | 大阪府 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 11 | 大神神社 | 奈良県 | PASS_ANCHOR | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 12 | 北野天満宮 | 京都府 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 13 | 宮城縣護國神社 | 宮城県 | PASS_ANCHOR | History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 14 | 平安神宮 | 京都府 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 15 | 岡田宮 | 福岡県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 16 | 建勲神社 | 京都府 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 17 | 水堂須佐男神社 | 兵庫県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 18 | 大阪天満宮 | 大阪府 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 19 | 毛谷黒龍神社 | 福井県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 20 | 大崎八幡宮 | 宮城県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 21 | 鎌数伊勢大神宮 | 千葉県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 22 | 廣田神社 | 青森県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 23 | 石浦神社 | 石川県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 24 | 洲崎神社 | 千葉県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 25 | 來宮神社 | 静岡県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 26 | 蛇窪神社 | 東京都 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 27 | 櫻岡大神宮 | 宮城県 | PASS | Deity(partial) + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 28 | 三嶋大社 | 静岡県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 29 | 柏神社 | 千葉県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 30 | 櫛田神社 | 福岡県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 31 | 坪沼八幡神社 | 宮城県 | PASS_ANCHOR | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 32 | 菊田神社 | 千葉県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 33 | 伊奈波神社 | 岐阜県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 34 | 青島神社 | 宮崎県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |
| 35 | 西宮神社 | 兵庫県 | PASS | Deity + History | PASS | PASS_NORMALIZABLE | CORE READY候補 |

## HOLD 8社

### HOLD_MAPPING 2社

| Shrine | Reason |
|---|---|
| 姫嶋神社 | EvidenceはPASSだが `決断・行動 / 疫病退散` を既存39タグへ意味を変えず単一mappingできない |
| 行田八幡神社 | EvidenceはPASSだが `眼病平癒 -> 病気平癒` 等のspecific-to-generic一般化を許可しない |

### MAPPING_AVAILABLE_SOURCE_HOLD 3社

| Shrine | Reason |
|---|---|
| 若宮八幡社 | `商売繁盛`へのmapping pathはあるがRecommendation Evidence Source acceptanceが未解決 |
| 富知六所浅間神社 | mapping pathはあるがPrimary / Authority benefit Evidence未確認 |
| 若宮神明社 | `交通安全 / 金運`へのmapping pathはあるが授与品名をRecommendation Evidenceへ採用する境界が未解決 |

### UNKNOWN_EVIDENCE 3社

| Shrine | Reason |
|---|---|
| 居多神社 | identity / deity / historyは取得可能だがexplicit benefit Evidence未確定 |
| 唐澤山神社 | first-party取得不能、Authority Sourceでexplicit benefit未確認 |
| 一之宮貫前神社 | first-party取得不能、祭神属性からbenefitを推測しない |

## Wave0 Original Pool Boundary

`諏訪大社 下社秋宮` はCurrent DB Duplicate Auditで `REVIEW` のまま、本43 NEW候補の外に置く。

これは重複確定ではなく、KAMI MUSUBIで諏訪大社を全体entityとして扱うか、四社個別entityとして扱うかというMother Shipのentity granularity判断待ちである。

したがってOriginal Wave0 44件の会計は以下となる。

```text
35 CORE READY候補
 2 HOLD_MAPPING
 3 SOURCE_HOLD
 3 UNKNOWN_EVIDENCE
 1 ENTITY_GRANULARITY_REVIEW
---------------------------
44 total
```

## Important Boundary

本書での `CORE READY候補` は以下を意味しない。

- Production DBへ登録済み
- Candidate Masterへ必要fieldが書き込み済み
- `ShrineDeity` / `ShrineHistory` Factが生成済み
- Fact ↔ Source relation済み
- verification_status / verified_at設定済み
- Evidence Gate `usable=True` 確認済み
- `Shrine.goriyaku`書き込み済み
- `goriyaku_tags` M2M Activation済み
- Concierge / Compass integration QA済み

したがって次工程で、35社を実際のCore Ready状態へ移すためのData Build / Import単位を別途定義する必要がある。

## Decision

1. Wave0 NEW 43社のうち35社を `CORE READY候補` として抽出する。
2. 8社は既存の3つのHOLD queueに保持し、35社へ混入させない。
3. 諏訪大社 下社秋宮はentity granularity REVIEWとして43 NEW scope外に維持する。
4. 本抽出を理由にProduction / Candidate Master / runtimeへ自動書き込みしない。
5. 次工程の実装順・Batchサイズ・HOLD解消優先度は本監査では決定せず、Mother Shipへ差し戻す。

## Non-Goals

- Production DB import
- Candidate Master field update
- Knowledge Fact generation
- Source relation write
- verification status update
- goriyaku / goriyaku_tags write
- Recommendation activation
- Concierge / Compass QA
- HOLD解消
- 新規taxonomy追加

## Next

Mother Ship判断後、35社を実際のCORE READYへ移すData Build / Import taskへ進む。