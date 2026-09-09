# Shrine Expansion Wave 0 Goriyaku Evidence Availability Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `NEW` 43 candidates
- Goriyaku / Recommendation Evidence availability only
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- `Shrine.goriyaku` write: なし
- `goriyaku_tags` write: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

Wave 0 の `NEW` 43社について、KAMI MUSUBIのRecommendation Evidenceとして利用可能になり得る、ご利益・御神徳・祈願目的の明示的なSource-backed Evidenceを取得できるか監査する。

本監査は `goriyaku_tags` の割当監査ではない。
Evidenceが存在しても、既存39件のcanonical `GoriyakuTag`へ安全に正規化できるとは限らないため、タグ割当は後続の `goriyaku_tags normalization audit` へ分離する。

## Canonical Contract

本監査は `docs/knowledge/recommendation-evidence-review-contract.md` の既存分類を使用する。

### Evidence class

- `ELIGIBLE_EXPLICIT`: approved Sourceが blessing / prayer benefit を明示している
- `REVIEW_REQUIRED`: 明示的な意味候補はあるが、Source強度・Evidence種別・canonical mappingに追加Reviewが必要
- `INELIGIBLE`: 神社名・祭神名・知名度・一般知識・根拠のない観光コピー等からの推測
- `UNKNOWN`: Sourceが取得不能、または現時点のSourceだけでは判定材料が不足

### Review outcome

- `PASS`
- `HOLD`
- `UNKNOWN`

本監査専用の永続ステータスは追加しない。

## Evidence Policy

以下を固定する。

1. 神社名からご利益を推測しない。
2. 祭神名から一般的なご利益を逆算しない。
3. 歴史・伝承・文化的イメージからご利益を生成しない。
4. Popularity / Omairi rankingをRecommendation Evidenceとして使用しない。
5. approved Sourceが「ご利益」「御神徳」「祈願」「祈祷目的」等として明示した内容だけをEvidence候補にする。
6. 神社自身の祈願メニューは、祈願対象を明示するEvidence候補として扱える。
7. 祈願メニューを「当該神社の普遍的な御神徳」と言い換えない。
8. 公式観光・自治体Sourceは、benefit meaningが明示されている場合のみEvidence候補にする。
9. 二次編集Sourceだけで確認した内容は自動PASSにしない。
10. 御守・授与品の商品名だけからcanonical `goriyaku_tags`を直接割り当てない。
11. 新しいGoriyakuTag名を本監査で作らない。
12. `UNKNOWN`を`NO_EVIDENCE`へ自動変換しない。

## Summary

| Review outcome | Count |
|---|---:|
| PASS | 37 |
| HOLD | 3 |
| UNKNOWN | 3 |
| **Total** | **43** |

```text
CONFIRMED_EXPLICIT_GORIYAKU_EVIDENCE = 37 / 43
EXPLICIT_CANDIDATE_INCLUDING_REVIEW_REQUIRED = 40 / 43
HOLD_REVIEW_REQUIRED = 3 / 43
UNKNOWN = 3 / 43
```

37社は、approved Source上で少なくとも1件の明示的なご利益・御神徳・祈願目的を確認できた。

3社は明示的なEvidence候補があるものの、Source強度またはEvidence種別の解釈にReviewが必要なため `HOLD` とした。

3社は現時点の取得Sourceだけでは安全に判定できず `UNKNOWN` とした。

これは37社の `goriyaku_tags` が確定したことを意味しない。

## Candidate Matrix

| # | candidate_name | prefecture | outcome | evidence_class | Source / Evidence note |
|---:|---|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | PASS | ELIGIBLE_EXPLICIT | 神社公式祈願案内 `https://miwajinnjya.com/guide/pray/` に厄除祈願等を明示。 |
| 2 | 大鳥大社 | 大阪府 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.ootoritaisha.jp/kitou/` に家内安全・厄除・安産・必勝・合格・商売繁盛等を明示。 |
| 3 | 御岩神社 | 茨城県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.oiwajinja.jp/kitou.html` に安産・家内安全・厄除開運・病気平癒・商売繁昌・良縁成就等を明示。 |
| 4 | 姫嶋神社 | 大阪府 | PASS | ELIGIBLE_EXPLICIT | 大阪公式観光 `https://osaka-info.jp/spot/himejimajinja/` が決断・行動に関する神様との説明、疫病退散の祭事文脈を明示。first-partyではないため後続tag mappingではSource強度を再確認する。 |
| 5 | 烏森神社 | 東京都 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://karasumorijinja.or.jp/` が御神徳として商売繁盛・技芸上達・家内安全・必勝祈願成就等を明示。 |
| 6 | 榴岡天満宮 | 宮城県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://tsutsujigaokatenmangu.jp/gosanpai/` に合格成就・学業上達・厄祓い・安産・交通安全・商売繁盛等を明示。 |
| 7 | 射水神社 | 富山県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.imizujinjya.or.jp/about` が御神徳として五穀豊穣・商業繁栄・家内安全・縁結び・開運厄祓・みちひらきを明示。 |
| 8 | 別小江神社 | 愛知県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.wakeoe.com/about.html` 等で八方除け・子授け・安産・金運・縁結び・事業繁栄・交通安全・厄除け等を明示。 |
| 9 | 戸隠神社 中社 | 長野県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.togakushi-jinja.jp/about/` 中社セクションで学業成就・商売繁盛・開運・厄除・家内安全を明示。 |
| 10 | 札幌諏訪神社 | 北海道 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.sapporo-suwajinja.com/` の祈願案内で開運厄除・安産・子宝・家内安全・合格・病気平癒・商売繁昌等を確認可能。 |
| 11 | 少彦名神社 | 大阪府 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.sinnosan.jp/` が病気平癒・健康成就を明示し、祈願案内にも厄除・学業・合格・良縁・子宝・安産等を掲載。 |
| 12 | 大神神社 | 奈良県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://oomiwa.or.jp/` の祈祷案内で家内安全・商売繁盛・健康・交通安全・厄払い・縁結び・病気平癒等を確認可能。 |
| 13 | 北野天満宮 | 京都府 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://kitanotenmangu.or.jp/sanpai-gokito/gokito/` 等で合格祈願・学力向上・厄除け・開運・商売繁盛・縁結び等を明示。 |
| 14 | 宮城縣護國神社 | 宮城県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://gokokujinja.org/sanpai/personal/` に家内安全・身体健固・病気平癒・交通安全・学業成就・合格・必勝・安産・厄祓等を明示。Collective Deity HOLDとは独立してEvidenceを取得可能。 |
| 15 | 平安神宮 | 京都府 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.heianjingu.or.jp/visit/prayer/` に厄除・家内安全・商売繁盛・交通安全・心願成就・安産・身体健康・合格・病気平癒等を明示。 |
| 16 | 岡田宮 | 福岡県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://okadagu.jp/rites/rites.html` に交通安全・病気平癒・商売繁盛・進学合格・旅行安全等を明示。 |
| 17 | 若宮八幡社 | 愛知県 | HOLD | REVIEW_REQUIRED | 関連施設 `https://www.wakamiyanomori-geihinkan.jp/` で商売繁盛・安全祈願等の祈祷例を確認できるが、Recommendation Evidenceのfirst-party shrine Sourceとしての扱いを後続Reviewで確定する必要あり。名古屋市Sourceはidentity/history中心。 |
| 18 | 建勲神社 | 京都府 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://kenkun-jinja.org/history/` が大願成就・開運・難局突破・災難除け等の御神徳を明示。 |
| 19 | 水堂須佐男神社 | 兵庫県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.m-susanoo.net/` に厄除祈願・安産祈願等を明示。 |
| 20 | 大阪天満宮 | 大阪府 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://osakatemmangu.or.jp/gokito` に試験合格・厄除け・学業成就・交通安全・商売繁昌・安産等を明示。 |
| 21 | 毛谷黒龍神社 | 福井県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.kurotatu-jinja.jp/about/` 等で厄除け・生命力向上・子授け・安産・商売繁盛等を明示。 |
| 22 | 富知六所浅間神社 | 静岡県 | HOLD | REVIEW_REQUIRED | 静岡県文化財Sourceはidentity/historyを確認できるがbenefit記載なし。二次編集Sourceでは安産・厄除・家内安全・交通安全・商売繁盛等の明示あり。二次Sourceだけでは自動PASSしない。 |
| 23 | 居多神社 | 新潟県 | UNKNOWN | UNKNOWN | 新潟・上越のAuthority/公式観光Sourceで祭神・由緒は確認できるが、本監査で取得した本文から明示的なご利益・祈願benefitを確定できない。追加Source探索前に`NO_EVIDENCE`とはしない。 |
| 24 | 大崎八幡宮 | 宮城県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.oosaki-hachiman.or.jp/guidance/` 等に安産祈願・交通安全祈願・厄除祈願等の祈祷導線を明示。 |
| 25 | 鎌数伊勢大神宮 | 千葉県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://kamakazu.com/free/rekishi` が五穀豊穣・厄除祈願・工事安全・商売繁盛等を明示。 |
| 26 | 廣田神社 | 青森県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://hirotajinja.or.jp/about-idx/` が万物成就・厄災難除・縁結び・病気平癒・商売繁盛・開運招福等を明示。 |
| 27 | 石浦神社 | 石川県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.ishiura.jp/gokitou/` に商売繁栄・災難除・家内安全・交通安全・心願成就・子宝・良縁・病気平癒・安産等を明示。 |
| 28 | 洲崎神社 | 千葉県 | PASS | ELIGIBLE_EXPLICIT | 千葉県公式観光 `https://maruchiba.jp/spot/detail_12056.html` が安産・航海安全・豊漁・五穀豊穣・厄除開運を明示。館山市文化財Sourceでも安産祈願の歴史文脈を確認可能。 |
| 29 | 來宮神社 | 静岡県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://kinomiya.or.jp/` の祈願案内で家内安全・商売繁盛・身体強健・心願成就・無病息災・合格・病気平癒等を明示。 |
| 30 | 蛇窪神社 | 東京都 | PASS | ELIGIBLE_EXPLICIT | しながわ観光協会の公式観光Sourceが立身出世のご神徳を明示。神社公式は前監査で403のため、tag mapping時にSource優先順位を再確認する。 |
| 31 | 櫻岡大神宮 | 宮城県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://sakuragaoka6826.sakura.ne.jp/` に家内安全・商売繁盛・厄除・病気平癒・安産・合格・学業成就・交通安全等の祈願内容を明示。 |
| 32 | 三嶋大社 | 静岡県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.mishimataisha.or.jp/` の祈願案内で家内安全・商売繁盛・厄除・安産・交通安全・開運・病気平癒・合格・良縁等を確認可能。 |
| 33 | 唐澤山神社 | 栃木県 | UNKNOWN | UNKNOWN | 神社公式 `https://karasawayama.com/` は本監査環境で取得不能。佐野市Authority Sourceではidentity/historyを確認できるがbenefitを確定できないため、第三者記載へfallbackせずUNKNOWN。 |
| 34 | 柏神社 | 千葉県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.kashiwajinja.com/gokitou` に厄除・災除・方位除・健康・家内安全・病気平癒・交通安全・安産・商売繁盛・学業成就・合格等を明示。 |
| 35 | 櫛田神社 | 福岡県 | PASS | ELIGIBLE_EXPLICIT | 福岡県公式観光Sourceが商売繁盛・不老長寿・縁結び・開運厄除け等を明示。 |
| 36 | 坪沼八幡神社 | 宮城県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://tsubonuma.org/` が家内安全・商売繁盛・必勝祈願・諸願成就等を明示。 |
| 37 | 菊田神社 | 千葉県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://kikuta-jinja.jp/` の祈願案内で厄除・方位除・合格・必勝・商売繁盛・家内安全・病気平癒等を明示。 |
| 38 | 伊奈波神社 | 岐阜県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.inabasan.com/` の祈祷案内で安産・厄除け・交通安全・身体健康・家内安全・心願成就・商売繁盛・病気平癒・合格等を明示。 |
| 39 | 行田八幡神社 | 埼玉県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://www.gyodahachiman.jp/` が癌封じ・虫封じ・諸病難病封じ・ぼけ封じ・悪癖封じ・眼病平癒等を明示。 |
| 40 | 青島神社 | 宮崎県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://aoshima-jinja.jp/` の祈願案内で家内安全・商売繁昌・交通/旅行/海上安全・病気平癒・縁結び・大漁・子授け・安産・学業成就・合格等を明示。 |
| 41 | 一之宮貫前神社 | 群馬県 | UNKNOWN | UNKNOWN | 神社公式 `https://nukisaki.or.jp/` は本監査環境で取得不能。富岡市公式Sourceは祭神の役割等を示すが、祭神属性からbenefitを推測しないためUNKNOWN。 |
| 42 | 若宮神明社 | 愛知県 | HOLD | REVIEW_REQUIRED | 神社first-partyの公式オンライン授与所で交通安全守・所願成就守・白蛇金運守等の目的表示を確認できる。ただし授与品名をRecommendation Evidenceとしてどこまで採用するかは現契約上Reviewが必要なためHOLD。 |
| 43 | 西宮神社 | 兵庫県 | PASS | ELIGIBLE_EXPLICIT | 神社公式 `https://nishinomiya-ebisu.com/` の祈祷・御神徳記述で商売繁盛・大漁満足・海上安全・福等を明示。 |

## HOLD Detail

### 若宮八幡社

明示的な祈願目的候補は確認できるが、取得先が神社公式本体ではなく関連施設ページである。

```text
Evidence meaning = explicit candidate
Source acceptance = REVIEW_REQUIRED
Review outcome = HOLD
```

後続Reviewで神社本体の祈祷ページ、または神社庁・自治体等の強いSourceから同内容を確認できればPASSへ昇格可能。

### 富知六所浅間神社

二次編集Sourceには明示的なご利益一覧があるが、前工程で確認した静岡県文化財Sourceはbenefitを記載していない。

```text
Evidence meaning = explicit candidate
Primary / Authority evidence = not yet confirmed
Review outcome = HOLD
```

祭神や浅間信仰一般からの推測で補完しない。

### 若宮神明社

first-party授与所に目的別御守の明示があるため、Evidence候補そのものは存在する。
一方、現Recommendation Evidence Contractで「授与品の商品名」を直接canonical benefitへ変換する境界は自動適用しない。

```text
Evidence meaning = explicit product-purpose candidate
Recommendation evidence semantics = REVIEW_REQUIRED
Review outcome = HOLD
```

## UNKNOWN Detail

### 居多神社

Authority / tourism Sourceからidentity・祭神・由緒は取得できるが、本監査で確認したSource本文には明示的benefitを確定できなかった。

Source setが完全に尽くされたとは判断しないため `NO_EVIDENCE` ではなく `UNKNOWN` とする。

### 唐澤山神社

神社公式は本監査環境で取得不能。
佐野市公式Sourceには神社identityと歴史情報があるが、Recommendation benefitを確定できない。

第三者サイトの一般的なご利益記載へfallbackせず `UNKNOWN` とする。

### 一之宮貫前神社

神社公式は本監査環境で取得不能。
富岡市公式Sourceには祭神を「武神」「農耕と機織の神」とする説明があるが、これはそのまま祈願benefitを意味しない。

祭神属性から `勝運` 等を推測せず `UNKNOWN` とする。

## Goriyaku Tags Boundary

本監査のPASSは以下を意味しない。

```text
explicit benefit evidence exists
!=
canonical GoriyakuTag assignment approved
```

次工程では、各明示Evidenceを現在のcanonical `GoriyakuTag` 39件に対して以下の順でReviewする。

1. exact meaning match
2. contract上許容されたnarrow normalization
3. ambiguous / generic meaningはHOLD
4. canonical tagが存在しないbenefitは新tagを勝手に作らずHOLD
5. Source wordingとtag意味の差を記録

既存Contract上、`goriyaku_tags` M2MはRecommendationの `score_need` / candidate prefilterへ直接影響するため、Evidence AvailabilityとTag Activationを同一工程にしない。

## Audit Decision

1. Wave0 43社中37社でapproved Source上の明示的Goriyaku / Prayer Evidenceを確認した。
2. 3社はexplicit candidateを確認したが、Source強度またはEvidence種別の意味Reviewが必要なためHOLDとした。
3. 3社は現時点のSourceだけでは判定できないためUNKNOWNとした。
4. HOLD / UNKNOWNをCandidate Poolから除外しない。
5. 神社名・祭神・伝承・知名度からご利益を推測しない。
6. 本監査では `goriyaku_tags` を割り当てない。
7. 新しいcanonical GoriyakuTagを追加しない。
8. 次工程で `goriyaku_tags` normalization availabilityを43社単位で監査する。

## Non-Goals

- `Shrine.goriyaku`更新
- `goriyaku_tags` M2M更新
- GoriyakuTag新設
- Production DB更新
- Candidate Master更新
- Recommendation Score変更
- Need → Goriyaku mapping変更
- Concierge / Compass runtime変更

## Close Condition

以下を満たしたため本Availability Auditを完了する。

- Wave0 43社を全件分類した
- explicit evidenceと推測を分離した
- accepted Source / review-required Source / unknownを分離した
- tag assignmentを後続工程へ分離した
- HOLD / UNKNOWNを推測でPASSへ昇格しない境界を固定した

次工程は `Wave0 goriyaku_tags normalization availability audit` とする。
