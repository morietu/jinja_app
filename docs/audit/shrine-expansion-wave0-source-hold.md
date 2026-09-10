# Shrine Expansion Wave 0 Source HOLD Queue

## Status

- Status: `ACTIVE_HOLD_QUEUE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `MAPPING_AVAILABLE_SOURCE_HOLD` 3 shrines
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- `Shrine.goriyaku` write: なし
- `goriyaku_tags` M2M write: なし
- GoriyakuTag add / rename / merge: なし
- NEED_TO_GORIYAKU_IDS変更: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

Wave 0 の `MAPPING_AVAILABLE_SOURCE_HOLD` 3社を、`HOLD_MAPPING` と `UNKNOWN_EVIDENCE` から分離した独立キューとして保持する。

この3社は、既存runtime `GoriyakuTag` 39件へのmapping path自体は存在するが、Source acceptance または Recommendation Evidence semantics が未確定である。

したがって、mapping可能性だけを理由に `PASS_NORMALIZABLE` へ昇格せず、Source / Evidence Reviewが完了するまでActivationしない。

## Queue Definition

```text
Evidence candidate exists = YES
Safe runtime mapping path = YES
Source / Evidence acceptance = HOLD
Candidate retention = YES
Recommendation activation = HOLD
```

## 対象3社

| Shrine | Current state | Safe mapping path | HOLD reason |
|---|---|---|---|
| 若宮八幡社 | `MAPPING_AVAILABLE_SOURCE_HOLD` | 商売繁盛 | 関連施設Sourceに祈願目的はあるが、神社本体のRecommendation Evidence Sourceとして採用できるか未確定 |
| 富知六所浅間神社 | `MAPPING_AVAILABLE_SOURCE_HOLD` | 安産 / 厄除け / 家内安全 / 交通安全 / 商売繁盛 | 二次編集Sourceではbenefitが明示されるが、Primary / Authority Sourceでのbenefit evidence未確認 |
| 若宮神明社 | `MAPPING_AVAILABLE_SOURCE_HOLD` | 交通安全 / 金運 | first-party授与所に目的別御守の明示はあるが、授与品名をRecommendation Evidenceとして採用する境界が未確定 |

## Boundary

このキューは以下と混同しない。

### HOLD_MAPPING

- Evidence自体はPASS
- Source acceptanceも問題なし
- しかし既存39 `GoriyakuTag`へ意味を変えずmappingできない
- 対象: 姫嶋神社 / 行田八幡神社

### UNKNOWN_EVIDENCE

- 現時点のSource setでは明示的benefitを確定できない
- Mapping判定そのものを実行しない
- 対象: 居多神社 / 唐澤山神社 / 一之宮貫前神社

### SOURCE_HOLD

- 明示的Evidence候補あり
- 既存39 tagへのmapping pathあり
- Source acceptance または Evidence semanticsのみ未確定
- 対象: 本文書の3社

## Activation Policy

以下を全て満たすまで `Shrine.goriyaku` / `goriyaku_tags` へActivationしない。

1. Accepted SourceまたはRecommendation Evidence Contract上許容されるSourceで明示benefitを確認する
2. Source文言と既存39 tagの意味対応を再確認する
3. HOLD理由が解消されたことをReview文書へ記録する
4. 既存39タグ以外の新規labelを作らない
5. Need mapping変更でEvidence不足を補わない

## Per-Shrine Re-review Gate

### 若宮八幡社

再Review条件:

- 神社本体の公式祈祷・御神徳ページで同一benefitを確認する
- または神社庁・自治体等のAccepted Authority Sourceで明示benefitを確認する

現時点では関連施設Sourceだけを根拠にActivationしない。

### 富知六所浅間神社

再Review条件:

- 神社公式 / 神社庁 / 自治体 / 文化財等のAccepted Sourceで、現在のbenefitを明示確認する

二次編集Sourceのみを根拠にActivationしない。

### 若宮神明社

再Review条件:

- Recommendation Evidence Contract上、授与品の商品目的をEvidenceとして採用する明示的なMother Ship判断がある
- または授与品ではなく、公式御神徳・祈祷・祈願ページ等から同一benefitを確認する

授与品名を自動的に神社の普遍的御神徳へ変換しない。

## Candidate Retention

3社はいずれもCandidate Poolから削除しない。

Source HOLDは「ご利益がない」「推薦対象外」という意味ではない。

```text
SOURCE_HOLD
!= NO_EVIDENCE
!= HOLD_MAPPING
!= Candidate rejection
```

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
- Source不足を祭神・歴史・知名度から推測して補完すること

## Close Condition

各社は個別に以下のいずれかへ遷移した時だけ本Queueから外す。

- `PASS_NORMALIZABLE`: Source / Evidence acceptanceが解消し、既存tagへ安全にmapping可能
- `HOLD_MAPPING`: Source acceptanceは解消したがmappingが安全でない
- `NO_EVIDENCE`: Reviewed Source set全体で明示Recommendation Evidenceなしが確定
- `UNKNOWN_EVIDENCE`: Source再取得不能等で判定材料不足へ戻った

## Next

次工程は `UNKNOWN_EVIDENCE 3社の分離保持` または `REVIEW_ANCHOR 3社のPosition QA`。

優先順位の最終判断はMother Shipへ差し戻す。
