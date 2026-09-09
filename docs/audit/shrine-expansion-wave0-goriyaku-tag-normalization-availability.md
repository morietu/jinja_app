# Shrine Expansion Wave 0 Goriyaku Tag Normalization Availability Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `NEW` 43 candidates
- Target: runtime compatibility layer `Shrine.goriyaku_tags` / existing 39 `GoriyakuTag` labels
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- `Shrine.goriyaku` write: なし
- `goriyaku_tags` M2M write: なし
- GoriyakuTag add / rename / merge: なし
- NEED_TO_GORIYAKU_IDS変更: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

前工程 `shrine-expansion-wave0-goriyaku-evidence-availability.md` で分類した Wave 0 43社について、approved Sourceから確認済みの明示的Recommendation Evidenceを、現行runtimeが使用する既存39件の `GoriyakuTag.name` へ安全に正規化できるか監査する。

本監査はタグの実書き込み・Activationではない。

## Vocabulary Boundary

現行 `develop` には、責務の異なる2つのご利益語彙が併存する。

### A. Runtime compatibility vocabulary

`Shrine.goriyaku_tags` が利用する既存 `GoriyakuTag` 39件。

Recommendationの `score_need` / candidate prefilter / Purpose matchingで現在利用されるのはこちらである。

39 labels:

```text
縁結び
厄除け
交通安全
商売繁盛
五穀豊穣
開運
家内安全
福徳
学業成就
合格祈願
勝運
仕事運
航海安全
海上安全
武運長久
安産
八方除
夫婦円満
八難除
恋愛成就
導き
美容
方除け
健康長寿
芸能
家庭円満
出世運
金運
芸能運
強運厄除け
技芸上達
八方除け
病気平癒
火防
子宝
心願成就
延命長寿
足腰健康
農業守護
```

### B. Evidence Foundation vocabulary

`backend/temples/domain/goriyaku_taxonomy_v1.py` の `GORIYAKU_V1_CANONICAL_KEYS` は、現在Mother Ship DATA_REVIEWで承認された18 identityのみを持つ。

これは `GoriyakuTag` 39件とは別のEvidence Foundation identity体系であり、runtime M2Mと自動同期されていない。

したがって本監査で `goriyaku_tags normalization PASS` となっても、`ShrineGoriyakuAssignment` / Evidence Foundation 18-key側のAssignment Readyを意味しない。

## Governing Normalization Contract

`docs/knowledge/recommendation-evidence-review-contract.md` に従う。

1. exact `GoriyakuTag.name` matchはPASS候補。
2. surface-form variationの同一概念だけnarrow normalization可能。
3. vague / generic表現は正規化しない。
4. 2つ以上のcanonical labelが同程度に妥当ならHOLD。
5. Specific conceptをより広いcanonical conceptへ一般化しない。
6. Existing 39 labelsにないbenefitを近いlabelへ寄せない。
7. 新しいGoriyakuTagを作らない。
8. 前工程HOLD / UNKNOWNをNormalizationだけでPASSへ昇格しない。
9. Safe subsetが1件以上あれば、unsafe phraseを捨てたうえでShrine-level normalization pathは成立し得る。
10. 本監査ではM2Mへ書き込まない。

## Status Definition

- `PASS_NORMALIZABLE`: 前工程EvidenceがPASSで、少なくとも1件がexactまたはnarrow single-candidate normalizationで既存39 tagへ安全に対応
- `HOLD_MAPPING`: 前工程EvidenceはPASSだが、確認済みEvidenceを既存39 tagへ意味を変えず安全に落とせない
- `MAPPING_AVAILABLE_SOURCE_HOLD`: tag meaning自体は既存39へ安全に対応するが、前工程のSource / Evidence semanticsがHOLD
- `UNKNOWN_EVIDENCE`: 前工程UNKNOWNのためNormalization判定を実行しない

## Summary

| Status | Count |
|---|---:|
| PASS_NORMALIZABLE | 35 |
| HOLD_MAPPING | 2 |
| MAPPING_AVAILABLE_SOURCE_HOLD | 3 |
| UNKNOWN_EVIDENCE | 3 |
| **Total** | **43** |

```text
RUNTIME_GORIYAKU_TAG_NORMALIZATION_READY = 35 / 43
POTENTIAL_AFTER_SOURCE_REVIEW = 38 / 43
MAPPING_HOLD = 2 / 43
SOURCE_HOLD_WITH_MAPPING_PATH = 3 / 43
UNKNOWN_EVIDENCE = 3 / 43
```

35社は、現在のEvidence状態のままでも既存39タグへ少なくとも1件の安全なNormalization pathを持つ。

3社はtag meaning自体は既存39へ対応できるが、前工程のSource / Evidence境界が解決するまでActivation不可。

2社は前工程EvidenceがPASSでも、現行39 vocabularyへ安全に落とせない。

## Narrow Normalization Examples Allowed in This Audit

以下はSource意味を変えず、既存labelへ単一に対応するsurface variationとして扱う。

| Source wording | Existing tag | Decision |
|---|---|---|
| 必勝 / 必勝祈願 | 勝運 | narrow normalization |
| 試験合格 / 合格成就 / 進学合格 | 合格祈願 | narrow normalization |
| 学業上達 / 学力向上 | 学業成就 | narrow normalization |
| 良縁成就 | 縁結び | narrow normalization |
| 商業繁栄 / 事業繁栄 | 商売繁盛 | narrow normalization |
| 子授け | 子宝 | narrow normalization |
| 立身出世 | 出世運 | narrow normalization |
| 厄祓 / 厄祓い / 厄払い | 厄除け | narrow normalization |

## Normalization That Is NOT Allowed

以下は自動・人手を問わず、本監査では安全なsurface normalizationとみなさない。

| Source wording | Tempting tag | Reason |
|---|---|---|
| 疫病退散 | 厄除け / 病気平癒 | protectionとhealingの双方が妥当で単一対応しない |
| 決断・行動 | 開運 / 導き / 勝運 | semantic inferenceが必要 |
| 眼病平癒 | 病気平癒 | specific disease benefitをgeneric categoryへ一般化するため |
| 癌封じ / 難病封じ / 虫封じ | 病気平癒 | 封じと平癒は同一surface conceptではない |
| 健康 / 身体健康 / 身体健固 | 健康長寿 | 長寿の意味をSourceが述べていない |
| 生命力向上 | 健康長寿 / 延命長寿 | semantic broadening |
| 不老長寿 | 健康長寿 / 延命長寿 | 2 labelが同程度に妥当 |
| 旅行安全 | 交通安全 / 航海安全 / 海上安全 | travel modeが未特定 |
| 工事安全 | 交通安全 / 家内安全 | categoryが異なる |
| 豊漁 / 大漁 / 大漁満足 | 五穀豊穣 / 海上安全 | harvest / safetyと意味が異なる |
| 方位除 | 方除け / 八方除 / 八方除け | existing labelsが複数あり曖昧 |
| 大願成就 / 諸願成就 / 万物成就 / 所願成就 | 心願成就 | scope差を含みsurface variationと断定しない |
| 開運招福 | 開運 / 福徳 | compound phraseで複数候補 |
| 福 | 福徳 | genericすぎる |

## Candidate Matrix

| # | candidate_name | evidence_status | normalization_status | safe existing tags | deferred / rejected phrase |
|---:|---|---|---|---|---|
| 1 | 三輪神社 | PASS | PASS_NORMALIZABLE | 厄除け | — |
| 2 | 大鳥大社 | PASS | PASS_NORMALIZABLE | 家内安全 / 厄除け / 安産 / 勝運 / 合格祈願 / 商売繁盛 | — |
| 3 | 御岩神社 | PASS | PASS_NORMALIZABLE | 安産 / 家内安全 / 厄除け / 開運 / 病気平癒 / 商売繁盛 / 縁結び | — |
| 4 | 姫嶋神社 | PASS | HOLD_MAPPING | — | 決断・行動 / 疫病退散 |
| 5 | 烏森神社 | PASS | PASS_NORMALIZABLE | 商売繁盛 / 技芸上達 / 家内安全 / 勝運 | — |
| 6 | 榴岡天満宮 | PASS | PASS_NORMALIZABLE | 合格祈願 / 学業成就 / 厄除け / 安産 / 交通安全 / 商売繁盛 | — |
| 7 | 射水神社 | PASS | PASS_NORMALIZABLE | 五穀豊穣 / 商売繁盛 / 家内安全 / 縁結び / 開運 / 厄除け | みちひらきは `導き` へ自動正規化しない |
| 8 | 別小江神社 | PASS | PASS_NORMALIZABLE | 八方除け / 子宝 / 安産 / 金運 / 縁結び / 商売繁盛 / 交通安全 / 厄除け | `八方除け` はruntime39上のexact label。`八方除`へmergeしない |
| 9 | 戸隠神社 中社 | PASS | PASS_NORMALIZABLE | 学業成就 / 商売繁盛 / 開運 / 厄除け / 家内安全 | — |
| 10 | 札幌諏訪神社 | PASS | PASS_NORMALIZABLE | 開運 / 厄除け / 安産 / 子宝 / 家内安全 / 合格祈願 / 病気平癒 / 商売繁盛 | — |
| 11 | 少彦名神社 | PASS | PASS_NORMALIZABLE | 病気平癒 / 厄除け / 学業成就 / 合格祈願 / 縁結び / 子宝 / 安産 | 健康成就→健康長寿はしない |
| 12 | 大神神社 | PASS | PASS_NORMALIZABLE | 家内安全 / 商売繁盛 / 交通安全 / 縁結び / 病気平癒 / 厄除け | 健康→健康長寿はしない |
| 13 | 北野天満宮 | PASS | PASS_NORMALIZABLE | 合格祈願 / 学業成就 / 厄除け / 開運 / 商売繁盛 / 縁結び | — |
| 14 | 宮城縣護國神社 | PASS | PASS_NORMALIZABLE | 家内安全 / 病気平癒 / 交通安全 / 学業成就 / 合格祈願 / 勝運 / 安産 / 厄除け | 身体健固→健康長寿はしない |
| 15 | 平安神宮 | PASS | PASS_NORMALIZABLE | 厄除け / 家内安全 / 商売繁盛 / 交通安全 / 心願成就 / 安産 / 合格祈願 / 病気平癒 | 身体健康→健康長寿はしない |
| 16 | 岡田宮 | PASS | PASS_NORMALIZABLE | 交通安全 / 病気平癒 / 商売繁盛 / 合格祈願 | 旅行安全はHOLD |
| 17 | 若宮八幡社 | HOLD | MAPPING_AVAILABLE_SOURCE_HOLD | 商売繁盛 | 安全祈願はgeneric。Source acceptance解決前はActivationしない |
| 18 | 建勲神社 | PASS | PASS_NORMALIZABLE | 開運 | 大願成就 / 難局突破 / 災難除けは自動mappingしない |
| 19 | 水堂須佐男神社 | PASS | PASS_NORMALIZABLE | 厄除け / 安産 | — |
| 20 | 大阪天満宮 | PASS | PASS_NORMALIZABLE | 合格祈願 / 厄除け / 学業成就 / 交通安全 / 商売繁盛 / 安産 | — |
| 21 | 毛谷黒龍神社 | PASS | PASS_NORMALIZABLE | 厄除け / 子宝 / 安産 / 商売繁盛 | 生命力向上はHOLD |
| 22 | 富知六所浅間神社 | HOLD | MAPPING_AVAILABLE_SOURCE_HOLD | 安産 / 厄除け / 家内安全 / 交通安全 / 商売繁盛 | Primary / Authority Evidence未確認 |
| 23 | 居多神社 | UNKNOWN | UNKNOWN_EVIDENCE | — | explicit benefit Source未確定 |
| 24 | 大崎八幡宮 | PASS | PASS_NORMALIZABLE | 安産 / 交通安全 / 厄除け | — |
| 25 | 鎌数伊勢大神宮 | PASS | PASS_NORMALIZABLE | 五穀豊穣 / 厄除け / 商売繁盛 | 工事安全はHOLD |
| 26 | 廣田神社 | PASS | PASS_NORMALIZABLE | 縁結び / 病気平癒 / 商売繁盛 | 万物成就 / 厄災難除 / 開運招福は自動mappingしない |
| 27 | 石浦神社 | PASS | PASS_NORMALIZABLE | 商売繁盛 / 家内安全 / 交通安全 / 心願成就 / 子宝 / 縁結び / 病気平癒 / 安産 | 災難除は自動mappingしない |
| 28 | 洲崎神社 | PASS | PASS_NORMALIZABLE | 安産 / 航海安全 / 五穀豊穣 | 豊漁はHOLD。厄除開運のcompound splitは今回の最小safe setに使わない |
| 29 | 來宮神社 | PASS | PASS_NORMALIZABLE | 家内安全 / 商売繁盛 / 心願成就 / 合格祈願 / 病気平癒 | 身体強健 / 無病息災はHOLD |
| 30 | 蛇窪神社 | PASS | PASS_NORMALIZABLE | 出世運 | 立身出世→出世運のみnarrow normalization |
| 31 | 櫻岡大神宮 | PASS | PASS_NORMALIZABLE | 家内安全 / 商売繁盛 / 厄除け / 病気平癒 / 安産 / 合格祈願 / 学業成就 / 交通安全 | — |
| 32 | 三嶋大社 | PASS | PASS_NORMALIZABLE | 家内安全 / 商売繁盛 / 厄除け / 安産 / 交通安全 / 開運 / 病気平癒 / 合格祈願 / 縁結び | — |
| 33 | 唐澤山神社 | UNKNOWN | UNKNOWN_EVIDENCE | — | explicit benefit Source未確定 |
| 34 | 柏神社 | PASS | PASS_NORMALIZABLE | 厄除け / 家内安全 / 病気平癒 / 交通安全 / 安産 / 商売繁盛 / 学業成就 / 合格祈願 | 方位除 / 健康はHOLD |
| 35 | 櫛田神社 | PASS | PASS_NORMALIZABLE | 商売繁盛 / 縁結び | 不老長寿 / 開運厄除けcompoundは最小safe setへ使わない |
| 36 | 坪沼八幡神社 | PASS | PASS_NORMALIZABLE | 家内安全 / 商売繁盛 / 勝運 | 諸願成就→心願成就はしない |
| 37 | 菊田神社 | PASS | PASS_NORMALIZABLE | 厄除け / 合格祈願 / 勝運 / 商売繁盛 / 家内安全 / 病気平癒 | 方位除はHOLD |
| 38 | 伊奈波神社 | PASS | PASS_NORMALIZABLE | 安産 / 厄除け / 交通安全 / 家内安全 / 心願成就 / 商売繁盛 / 病気平癒 / 合格祈願 | 身体健康→健康長寿はしない |
| 39 | 行田八幡神社 | PASS | HOLD_MAPPING | — | 癌封じ / 虫封じ / 諸病難病封じ / ぼけ封じ / 悪癖封じ / 眼病平癒を既存39へ一般化しない |
| 40 | 青島神社 | PASS | PASS_NORMALIZABLE | 家内安全 / 商売繁盛 / 交通安全 / 海上安全 / 病気平癒 / 縁結び / 子宝 / 安産 / 学業成就 / 合格祈願 | 旅行安全 / 大漁はHOLD |
| 41 | 一之宮貫前神社 | UNKNOWN | UNKNOWN_EVIDENCE | — | explicit benefit Source未確定 |
| 42 | 若宮神明社 | HOLD | MAPPING_AVAILABLE_SOURCE_HOLD | 交通安全 / 金運 | 所願成就→心願成就は自動mappingしない。授与品Evidence境界解決前はActivationしない |
| 43 | 西宮神社 | PASS | PASS_NORMALIZABLE | 商売繁盛 / 海上安全 | 大漁満足 / 福はHOLD |

## HOLD_MAPPING Detail

### 姫嶋神社

前工程ではofficial tourism Source上の「決断・行動」および疫病退散の文脈を明示EvidenceとしてPASS扱いした。

しかしruntime39へのmappingでは以下の問題がある。

```text
決断・行動
  -> 開運 / 導き / 勝運 など複数候補

疫病退散
  -> 厄除け / 病気平癒 のどちらにも意味距離があり、同一surface conceptではない
```

したがって `HOLD_MAPPING`。

これは前工程Evidence PASSを取り消す判断ではなく、`Evidence exists != existing taxonomy mapping exists` の責務分離である。

### 行田八幡神社

Sourceには癌封じ、虫封じ、諸病難病封じ、ぼけ封じ、悪癖封じ、眼病平癒等が明示される。

既存39には `病気平癒` があるが、Sourceはgeneric `病気平癒` を明示していない。

`眼病平癒 -> 病気平癒` はSpecific benefitからGeneric categoryへの一般化であり、Contractが許可するsurface-form normalizationではない。

同様に `癌封じ -> 病気平癒` は「封じ」と「平癒」の意味差を消すため許可しない。

したがって `HOLD_MAPPING`。

## Source HOLD With Mapping Path

以下3社はmapping問題ではなく、前工程のEvidence acceptance問題で止まっている。

| Shrine | Safe tag path if Evidence is approved | Current blocker |
|---|---|---|
| 若宮八幡社 | 商売繁盛 | 関連施設SourceのRecommendation Evidence acceptance |
| 富知六所浅間神社 | 安産 / 厄除け / 家内安全 / 交通安全 / 商売繁盛 | Primary / Authority Evidence未確認 |
| 若宮神明社 | 交通安全 / 金運 | 授与品名をRecommendation Evidenceへ採用する境界 |

NormalizationだけでこのHOLDを解除しない。

## Evidence Foundation 18-Key Boundary

現行 `GORIYAKU_V1_CANONICAL_KEYS` は以下18 conceptのみを承認済みとして保持する。

```text
縁結び
厄除け
交通安全
商売繁盛
開運
家内安全
学業成就
合格祈願
勝運
海上安全
安産
八方除
出世運
金運
強運厄除け
病気平癒
心願成就
足腰健康
```

そのためruntime39ではvalidでも、以下のようなlabelはEvidence Foundation 18-key側では未承認である。

```text
五穀豊穣
航海安全
技芸上達
八方除け
子宝
...
```

本監査はこれらをruntime `goriyaku_tags`として否定しない。

同時に、runtime normalization PASSをEvidence Foundation Assignment PASSへ読み替えない。

## Audit Decision

1. Wave0 43社中35社は、現時点のPASS Evidenceから既存39 `GoriyakuTag`へ少なくとも1件安全に正規化可能。
2. 姫嶋神社・行田八幡神社はEvidenceを確認できても既存39へ安全にmappingできないため `HOLD_MAPPING`。
3. 若宮八幡社・富知六所浅間神社・若宮神明社はmapping path自体はあるがSource/Evidence acceptanceがHOLDのためActivation不可。
4. 居多神社・唐澤山神社・一之宮貫前神社はEvidence UNKNOWNのためNormalizationを行わない。
5. Safe subsetだけを将来のreviewed `Shrine.goriyaku` / `goriyaku_tags`候補とし、同一Source内のunsupported phraseを近似tagへ押し込まない。
6. 39 runtime tagsと18 Evidence Foundation keysを混同・自動同期しない。
7. 本監査ではDB・Seed・Candidate Master・Recommendation runtimeを変更しない。

## Non-Goals

- `Shrine.goriyaku`書き込み
- `goriyaku_tags` M2M書き込み
- GoriyakuTag追加 / rename / merge
- Evidence Foundation canonical key追加
- `ShrineGoriyakuAssignment`作成
- Need → Goriyaku mapping変更
- Recommendation Score変更
- Concierge / Compass runtime変更
- HOLD / UNKNOWN Sourceの追加Research

## Close Condition

以下を満たしたためNormalization Availability Auditを完了する。

- 43社を全件分類
- existing 39 vocabularyを正本として使用
- exact / narrow normalization / ambiguity / semantic broadeningを分離
- Source HOLDとMapping HOLDを分離
- Foundation 18-key体系との責務境界を記録
- 実データActivationを行っていない

次工程は、`REVIEW_ANCHOR 3社のPosition QA` または Wave0 Core Ready判定前のHOLD / UNKNOWN follow-upを母艦で選択する。