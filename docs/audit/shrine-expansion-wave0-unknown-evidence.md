# Shrine Expansion Wave 0 UNKNOWN_EVIDENCE Queue

## Status

- Status: `ACTIVE_UNKNOWN_QUEUE`
- Recorded at: `2026-09-10`
- Scope: Wave 0 `UNKNOWN_EVIDENCE` 3 shrines
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- `Shrine.goriyaku` write: なし
- `goriyaku_tags` M2M write: なし
- GoriyakuTag add / rename / merge: なし
- NEED_TO_GORIYAKU_IDS変更: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

Wave 0 の `UNKNOWN_EVIDENCE` 3社を、`HOLD_MAPPING` と `MAPPING_AVAILABLE_SOURCE_HOLD` から分離した独立キューとして保持する。

この3社は、現時点で取得・確認できたSource setだけでは明示的なRecommendation Evidenceを安全に確定できていない。

したがって、`NO_EVIDENCE` へ確定せず、祭神・神社名・歴史・一般的イメージからご利益を推測せず、追加Source確認まで判定保留とする。

## Queue Definition

```text
Explicit Recommendation Evidence = NOT CONFIRMED
Source set completeness = NOT CONFIRMED
Safe runtime mapping decision = NOT RUN
Candidate retention = YES
Recommendation activation = HOLD
Final evidence state = UNKNOWN_EVIDENCE
```

## 対象3社

| Shrine | Current state | Confirmed material | UNKNOWN reason |
|---|---|---|---|
| 居多神社 | `UNKNOWN_EVIDENCE` | Authority / official tourism Sourceでidentity・祭神・由緒を確認済み | 現時点で取得したSource本文から明示的benefitを確定できない。Source setを尽くしたとは判断できない |
| 唐澤山神社 | `UNKNOWN_EVIDENCE` | 佐野市Authority Sourceでidentity・historyを確認済み | 神社first-party Sourceが取得不能。Authority Sourceではbenefitを確認できず、第三者記載へfallbackしない |
| 一之宮貫前神社 | `UNKNOWN_EVIDENCE` | 富岡市Authority Sourceでidentity・祭神等を確認済み | first-party Sourceが取得不能。祭神属性から勝運等を推測しないためbenefit未確定 |

## Boundary

### HOLD_MAPPINGとの違い

`HOLD_MAPPING` はEvidence自体がPASSしているが、既存39 `GoriyakuTag`へ意味を変えずにmappingできない状態。

対象:

- 姫嶋神社
- 行田八幡神社

### SOURCE_HOLDとの違い

`MAPPING_AVAILABLE_SOURCE_HOLD` は明示的Evidence候補とruntime mapping pathがあるが、Source acceptanceまたはEvidence semanticsが未確定の状態。

対象:

- 若宮八幡社
- 富知六所浅間神社
- 若宮神明社

### UNKNOWN_EVIDENCE

本Queueはそれより前段階で、明示Recommendation Evidenceを安全に確定する材料自体が不足している。

```text
UNKNOWN_EVIDENCE
!= NO_EVIDENCE
!= HOLD_MAPPING
!= SOURCE_HOLD
!= Candidate rejection
```

## Evidence Policy

以下を固定する。

1. `UNKNOWN_EVIDENCE`を`NO_EVIDENCE`へ自動変換しない。
2. 神社名からbenefitを推測しない。
3. 祭神名・祭神属性からbenefitを推測しない。
4. 歴史・伝承・知名度・一般的信仰イメージからbenefitを生成しない。
5. ランキング・口コミ・Omairi等のDiscovery SourceをRecommendation Evidenceへ昇格しない。
6. Third-party editorial Sourceだけを理由に自動PASSしない。
7. 追加Sourceで明示benefitを確認するまで`goriyaku_tags` normalizationを実行しない。
8. Candidate Poolから削除しない。

## Per-Shrine Re-review Gate

### 居多神社

再Review条件:

- 神社公式、神社庁、自治体、公式観光等のAccepted Sourceで明示的なご利益・御神徳・祈願目的を確認する
- Source本文を確認し、benefitが具体的に記載されていることを記録する

identity・祭神・由緒が確認できていること自体はRecommendation Evidenceを意味しない。

### 唐澤山神社

再Review条件:

- 神社first-party Sourceを再取得できる
- または神社庁・自治体・公式観光等のAccepted Sourceで明示benefitを確認する

first-partyが取得不能であることを理由に、一般サイトへ自動fallbackしない。

### 一之宮貫前神社

再Review条件:

- 神社first-party Sourceを再取得できる
- または富岡市等のAccepted Authority Sourceで明示的benefit記載を確認する

祭神が武神・農耕や機織に関係すると記載されていても、それだけから`勝運`・`農業守護`・`仕事運`等を生成しない。

## Transition Rules

各社は追加Source Review後にのみ、以下へ遷移できる。

- `PASS_NORMALIZABLE`: Accepted Sourceのexplicit evidenceがあり、既存39 tagへ安全にmapping可能
- `MAPPING_AVAILABLE_SOURCE_HOLD`: explicit candidateとmapping pathはあるが、Source acceptance / Evidence semanticsがHOLD
- `HOLD_MAPPING`: explicit evidenceはPASSしたが、既存39 tagへ安全にmapping不能
- `NO_EVIDENCE`: Reviewed Source setを十分に確認し、明示Recommendation Evidenceが存在しないと確定

状態遷移は追加Evidenceまたは明示Review結果なしに行わない。

## Candidate Retention

3社はいずれもCandidate Poolに保持する。

`UNKNOWN_EVIDENCE` は、神社そのもののRecommendation eligibility全体を否定する状態ではない。

Knowledge側のDeity / History Fact取得可能性・Shared Recommendation Eligibilityとは別軸で管理する。

## Non-Goals

- Production DB更新
- Shrine seed更新
- Candidate Master data更新
- `Shrine.goriyaku`更新
- `goriyaku_tags` M2M更新
- GoriyakuTag新設 / rename / merge
- NEED_TO_GORIYAKU_IDS変更
- Recommendation Score変更
- Concierge / Compass runtime変更
- taxonomy拡張判断
- 第三者Sourceへの自動fallback
- `NO_EVIDENCE`確定

## Close Condition

以下を満たしたため、Wave 0 のUNKNOWN 3社を独立キューとして分離保持する。

- 3社を全件列挙した
- HOLD_MAPPING / SOURCE_HOLDとの責務境界を明記した
- UNKNOWNをNO_EVIDENCEへ変換しないルールを固定した
- Candidate Pool保持を固定した
- 再Review条件と状態遷移条件を明記した

次工程候補は `REVIEW_ANCHOR 3社のPosition QA`。

優先順位の最終判断はMother Shipへ差し戻す。
