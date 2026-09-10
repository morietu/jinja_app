# Shrine Expansion Wave 0 Goriyaku Mapping Hold

## Status

- Status: `ACTIVE_HOLD_QUEUE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `HOLD_MAPPING` 2 candidates only
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master write: なし
- `Shrine.goriyaku` write: なし
- `goriyaku_tags` M2M write: なし
- GoriyakuTag add / rename / merge: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

`docs/audit/shrine-expansion-wave0-goriyaku-tag-normalization-availability.md` で `HOLD_MAPPING` と判定された2社を、Source HOLD / UNKNOWN Evidenceとは分離して保持する。

この2社はRecommendation Evidence自体が欠けているのではない。

```text
Evidence status = PASS
Runtime GoriyakuTag mapping = HOLD
```

すなわち、Source-backedな意味は確認できるが、現行39件のruntime `GoriyakuTag`へ意味を変えずに安全に正規化できない状態である。

## Hold Queue

| candidate_name | prefecture | evidence_status | hold_status | Source-backed meaning | mapping issue |
|---|---|---|---|---|---|
| 姫嶋神社 | 大阪府 | PASS | HOLD_MAPPING | 決断・行動 / 疫病退散 | `決断・行動` は開運・導き・勝運など複数候補。`疫病退散` は厄除け・病気平癒のいずれにも意味距離があり、単一surface normalizationではない。 |
| 行田八幡神社 | 埼玉県 | PASS | HOLD_MAPPING | 癌封じ / 虫封じ / 諸病難病封じ / ぼけ封じ / 悪癖封じ / 眼病平癒 | `眼病平癒 -> 病気平癒` はspecificからgenericへの一般化。各種「封じ」を `病気平癒` へ変換すると意味が変わる。 |

## 分離ルール

以下を固定する。

1. `HOLD_MAPPING` を `MAPPING_AVAILABLE_SOURCE_HOLD` と混在させない。
2. `HOLD_MAPPING` を `UNKNOWN_EVIDENCE` と混在させない。
3. この2社をCandidate Poolから削除しない。
4. この2社を `PASS_NORMALIZABLE` へ昇格しない。
5. 既存39タグへ近似意味で押し込まない。
6. 新しい `GoriyakuTag` を本タスクで作らない。
7. `NEED_TO_GORIYAKU_IDS` を変更して解決しない。
8. Source-backed wordingを書き換えて既存タグに合わせない。
9. 今後taxonomy拡張またはmapping policyを変更する場合はMother Ship decisionを必要とする。
10. Mother Ship decisionがない限り、本hold queueの2社はmapping観点では非Activation状態を維持する。

## Core Ready Boundary

`HOLD_MAPPING` はShrine identity / Source / Coordinate / Deity / Historyまでを否定するものではない。

ただし現在のKAMI MUSUBIにおいて、Source-backed benefitをruntime `goriyaku_tags`へ安全に接続できないため、少なくともRecommendation Evidence / Goriyaku runtime integrationの観点ではCore Readyへ自動昇格させない。

```text
Source-backed Goriyaku Evidence = YES
Safe runtime GoriyakuTag mapping = NO
Recommendation activation       = HOLD
Candidate retention              = YES
```

## Resolution Conditions

以下のいずれかが成立した場合のみ再Reviewする。

- より直接的なSourceが、既存39タグのいずれかとexactまたはnarrow normalization可能なbenefitを追加で明示した
- Mother Shipがtaxonomy拡張を決定した
- Mother Shipがmapping policy変更を決定した

上記以外ではステータスを維持する。

## Non-Goals

- 新しいGoriyakuTag設計
- taxonomy拡張判断
- existing tag merge
- Evidence Foundation 18-key変更
- runtime M2M書き込み
- Recommendation score変更
- Purpose mapping変更
- Candidate削除

## Close Condition

以下を満たしたため本分離作業を完了する。

- HOLD_MAPPING 2社を独立queueとして明示した
- Source HOLD / UNKNOWNから分離した
- Candidateを削除しないことを固定した
- RecommendationへActivationしないことを固定した
- 再Review条件をMother Ship decisionまたは追加Sourceに限定した
