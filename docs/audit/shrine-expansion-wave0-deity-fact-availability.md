# Shrine Expansion Wave 0 Deity Fact Availability Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `NEW` 43 candidates
- Deity Fact availability only
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- Knowledge Fact生成: なし
- goriyaku / goriyaku_tags変更: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

Wave 0 の `NEW` 43社について、現行KAMI MUSUBIのShared Recommendation Eligibilityで利用可能になり得る `ShrineDeity` Factを、安全なSourceから取得・生成できるかを監査する。

本監査はDeity FactそのものをDBへ生成・投入する工程ではない。Source本文から現在の祭神を明示確認できるか、現行Knowledge Modelで安全に表現できるかを判定する。

## Runtime Contract

現行コード正本のRecommendation eligibilityは以下。

```text
Shrine DB presence != Recommendation eligibility

Recommendation eligibility
= usable Deity Fact OR usable History Fact
```

`legacy goriyaku` / `history_theme` からeligibilityを推定しない。

Evidence Gate上のusable Factは最低限、Factと関連Sourceがfact-readyである必要がある。現行のfact-ready verification statusは以下。

```text
source_confirmed
reviewed
```

したがって本監査では、単に祭神名がWeb上に存在するだけでなく、Source-backed Factとして現在のKnowledge Pipelineへ接続できることを確認対象とする。

## Deity Extraction Policy

以下を固定する。

1. 現在の祭神としてSourceに明示された名称だけをFact候補にする。
2. 神社名から祭神を推測しない。
3. 由緒・神話・系譜から現在の祭神を逆算しない。
4. `他22柱` / `ほか十六柱` 等の未記名部分をAIで補完しない。
5. 未記名集合をSyntheticなDeity Factへ変換しない。
6. 歴史資料にのみ現れる過去の祭神記述を、そのまま現在の祭神へ昇格しない。
7. Discovery rankingはDeity Fact Sourceに使用しない。

Accepted Sourceは既存Shrine Knowledge Contractに従い、神社公式、神社庁、政府・自治体、文化財、必要に応じて公式観光情報等の確認可能なSourceを用いる。

## Status Definition

- `PASS_DEITY`: 現在の祭神として明示されたnamed deityを、現行 `ShrineDeity` でSource-backed Fact化可能
- `PASS_DEITY_PARTIAL`: named deityの一部はFact化可能だが、Sourceに未記名・集合部分があり、その部分はFact化しない
- `HOLD_DEITY_STRUCTURE`: trusted Sourceはあるが祭神表現が現行Contractのcollective deity境界に該当し、Deity Fact化を保留
- `HOLD_DEITY_SOURCE`: shrine identity Sourceはあるが、現在の祭神を明示するaccepted Sourceを確保できない
- `UNKNOWN_DEITY`: SourceとShrine identityの対応関係を確定できない

## Summary

| Status | Count |
|---|---:|
| PASS_DEITY | 39 |
| PASS_DEITY_PARTIAL | 2 |
| HOLD_DEITY_STRUCTURE | 1 |
| HOLD_DEITY_SOURCE | 1 |
| UNKNOWN_DEITY | 0 |
| **Total** | **43** |

```text
DEITY_FACT_ACQUISITION_PATH = 41 / 43
DEITY_HOLD = 2 / 43
```

41社では、少なくとも1件のSource-backed named Deity Factを作成できる取得経路を確認した。

これは41社がすでにRecommendation eligibleであることを意味しない。Fact生成、Source関連付け、verification_status設定、Evidence Gate実行は後続工程である。

## Candidate Matrix

| # | candidate_name | prefecture | status | Deity Source / note |
|---:|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | PASS_DEITY | 神社公式で現在の御祭神を明示。named Deity Fact化可能。 |
| 2 | 大鳥大社 | 大阪府 | PASS_DEITY | 神社公式で日本武尊を明示。歴史的な祭神論の記述と現在のFactを混同しない。 |
| 3 | 御岩神社 | 茨城県 | PASS_DEITY_PARTIAL | 神社公式で国常立尊・大国主命・伊邪那岐尊・伊邪那美尊等を明示。一方 `他22柱` / 総祭神188柱は未記名のためFact化しない。 |
| 4 | 姫嶋神社 | 大阪府 | PASS_DEITY | 大阪市系Authority Sourceで阿迦留姫命・住吉大神を明示。named Fact化可能。 |
| 5 | 烏森神社 | 東京都 | PASS_DEITY | 神社公式で倉稲魂命・天鈿女命・瓊々杵尊を明示。 |
| 6 | 榴岡天満宮 | 宮城県 | PASS_DEITY | 神社公式で菅原道真公を明示。 |
| 7 | 射水神社 | 富山県 | PASS_DEITY | 神社公式で二上神（瓊瓊杵尊）を明示。古城1-1側のShrine identityに限定する。 |
| 8 | 別小江神社 | 愛知県 | PASS_DEITY | 神社公式で複数の御祭神を明示。named Fact化可能。 |
| 9 | 戸隠神社 中社 | 長野県 | PASS_DEITY | 神社公式の中社セクションで天八意思兼命を明示。 |
| 10 | 札幌諏訪神社 | 北海道 | PASS_DEITY | 神社公式で建御名方之命・八坂刀売之命を明示。 |
| 11 | 少彦名神社 | 大阪府 | PASS_DEITY | 神社公式で少彦名命・炎帝神農を明示。 |
| 12 | 大神神社 | 奈良県 | PASS_DEITY | 神社公式の御祭神ページで現在の祭神を確認可能。桜井市三輪1422のShrine identityに限定。 |
| 13 | 北野天満宮 | 京都府 | PASS_DEITY | 神社公式で菅原道真公等を明示。 |
| 14 | 宮城縣護國神社 | 宮城県 | HOLD_DEITY_STRUCTURE | 宮城県神社庁が主祭神を「明治維新以降戦歿者の御霊 56,091柱」と明示。未記名collective deityで、既存の靖國神社Contract境界と同型のためSynthetic Fact化しない。 |
| 15 | 平安神宮 | 京都府 | PASS_DEITY | 神社公式で桓武天皇・孝明天皇を明示。 |
| 16 | 岡田宮 | 福岡県 | PASS_DEITY | 神社公式で複数の御祭神を明示。named Fact化可能。 |
| 17 | 若宮八幡社 | 愛知県 | PASS_DEITY | 名古屋市公式で仁徳天皇・応神天皇・武内宿禰命を明示。 |
| 18 | 建勲神社 | 京都府 | PASS_DEITY | 神社公式で主祭神 織田信長公、配祀 織田信忠卿を明示。 |
| 19 | 水堂須佐男神社 | 兵庫県 | PASS_DEITY | 兵庫県神社庁で須佐男命を明示。 |
| 20 | 大阪天満宮 | 大阪府 | PASS_DEITY | 神社公式で菅原道真公を御祭神として明示。 |
| 21 | 毛谷黒龍神社 | 福井県 | PASS_DEITY | 神社公式で高龗神・闇龗神・男大迹天皇等を明示。 |
| 22 | 富知六所浅間神社 | 静岡県 | HOLD_DEITY_SOURCE | 静岡県文化財Sourceはidentity/所在地を確認できるが現在の祭神を明示しない。富士市歴史資料の過去記述や二次Sourceの祭神一覧を現在のFactへ昇格しない。 |
| 23 | 居多神社 | 新潟県 | PASS_DEITY | 上越地域の公式観光Sourceで大国主命・奴奈川姫・建御名方命を明示。tourism_officialとして現行Source typeで表現可能。 |
| 24 | 大崎八幡宮 | 宮城県 | PASS_DEITY | 宮城県神社庁で応神天皇・仲哀天皇・神功皇后を明示。 |
| 25 | 鎌数伊勢大神宮 | 千葉県 | PASS_DEITY | 神社公式で天照皇大神を明示。 |
| 26 | 廣田神社 | 青森県 | PASS_DEITY | 神社公式で主祭神・配祀神を明示。named Fact化可能。 |
| 27 | 石浦神社 | 石川県 | PASS_DEITY | 神社公式で複数の御祭神を明示。 |
| 28 | 洲崎神社 | 千葉県 | PASS_DEITY | 館山市公式で祭神 天比理乃咩命を明示。 |
| 29 | 來宮神社 | 静岡県 | PASS_DEITY | 神社公式の御祭神ページでnamed deityを明示。 |
| 30 | 蛇窪神社 | 東京都 | PASS_DEITY | 品川区系公式観光Sourceで天照大神・天児屋根命・応神天皇を明示。tourism_officialとして表現可能。 |
| 31 | 櫻岡大神宮 | 宮城県 | PASS_DEITY_PARTIAL | 神社公式で天照皇大神・豊受大神を明示する一方 `ほか十六柱` は未記名。明示2柱のみFact候補とし、未記名16柱は生成しない。 |
| 32 | 三嶋大社 | 静岡県 | PASS_DEITY | 神社公式で大山祇命・積羽八重事代主神を明示。 |
| 33 | 唐澤山神社 | 栃木県 | PASS_DEITY | 佐野市公式で祭神 藤原秀郷を明示。 |
| 34 | 柏神社 | 千葉県 | PASS_DEITY | 神社公式で複数の祭神を明示。named Fact化可能。 |
| 35 | 櫛田神社 | 福岡県 | PASS_DEITY | 福岡市文化財系Sourceで大幡主命・天照大神・素戔嗚尊を明示。 |
| 36 | 坪沼八幡神社 | 宮城県 | PASS_DEITY | 宮城県神社庁で仲哀天皇・神功皇后・応神天皇・武内宿禰を明示。 |
| 37 | 菊田神社 | 千葉県 | PASS_DEITY | 神社公式で大己貴大神（大国主命）・藤原時平命を明示。 |
| 38 | 伊奈波神社 | 岐阜県 | PASS_DEITY | 神社公式で主祭神 五十瓊敷入彦命および配祭神を明示。 |
| 39 | 行田八幡神社 | 埼玉県 | PASS_DEITY | 神社公式で誉田別尊（応神天皇）・気長足姫尊（神功皇后）等を明示。 |
| 40 | 青島神社 | 宮崎県 | PASS_DEITY | 神社公式で彦火火出見命・豊玉姫命・塩筒大神を明示。 |
| 41 | 一之宮貫前神社 | 群馬県 | PASS_DEITY | 富岡市公式観光Sourceで経津主神・比売大神を明示。tourism_officialとして表現可能。 |
| 42 | 若宮神明社 | 愛知県 | PASS_DEITY | 神社公式で天照皇大神・素戔嗚尊を明示。 |
| 43 | 西宮神社 | 兵庫県 | PASS_DEITY | 神社公式でえびす大神（蛭児大神）・天照大御神・大国主大神・須佐之男大神を明示。 |

## PASS_DEITY_PARTIAL Handling

### 御岩神社

Source上、named deityと未記名集合が併存する。

```text
named: 国常立尊 / 大国主命 / 伊邪那岐尊 / 伊邪那美尊 等
unnamed: 他22柱
aggregate statement: 総祭神188柱
```

本監査ではnamed部分のみをFact候補とする。`他22柱` や `188柱` を1件のcollective Deity Factに変換しない。

### 櫻岡大神宮

Source上、以下のnamed deityは明示される。

```text
天照皇大神
豊受大神
```

一方 `ほか十六柱` は個別名が当該Source上で確認できないため、AI推測で補完しない。

## HOLD Detail

### 宮城縣護國神社 — HOLD_DEITY_STRUCTURE

Authority Sourceは取得でき、祭神表現自体も明示されている。

```text
明治維新以降戦歿者の御霊 56,091柱
```

問題はSource欠落ではなくKnowledge representationである。

既存Repositoryには靖國神社の未記名collective deityを `ShrineDeity` Contract上の境界としてDEFERした前例がある。本監査では宮城縣護國神社についてもSyntheticな `display_name` を作らず、Deity Fact生成を保留する。

```text
SOURCE = AVAILABLE
DEITY_INFORMATION = AVAILABLE
MODEL_REPRESENTATION = MOTHER_SHIP_REVIEW_REQUIRED
```

この候補をCandidate Poolから除外しない。usable History Factが存在すればShared Recommendation Eligibilityは満たし得る。

### 富知六所浅間神社 — HOLD_DEITY_SOURCE

Authority SourceでShrine identityと所在地は確認できる。一方、今回確認したaccepted current Sourceから現在の祭神を明示確認できなかった。

富士市の歴史資料には過去の祭神記述が存在するが、歴史的記述を現在の御祭神へ自動昇格しない。一般二次Sourceに現在の祭神一覧は存在するが、Source hierarchy上の確認なしにDeity Factへ採用しない。

```text
IDENTITY_SOURCE = AVAILABLE
CURRENT_DEITY_AUTHORITY_SOURCE = NOT_CONFIRMED
```

この候補もCandidate Poolから除外しない。usable History Factが取得できる場合はShared Recommendation Eligibilityを満たし得る。

## Eligibility Impact

Deity側だけで見ると、41社にはusable Deity Fact生成へ進める経路がある。

ただしShared Recommendation EligibilityはOR条件である。

```text
usable Deity OR usable History
```

したがって、今回Deity HOLDとなった2社をRecommendation-ineligibleと確定しない。

次のHistory Fact availability auditで以下を確認する。

- 宮城縣護國神社にusable History Factを作成できるか
- 富知六所浅間神社にusable History Factを作成できるか

## Audit Decision

1. 43社中41社で少なくとも1件のSource-backed named Deity Fact取得経路を確認した。
2. 御岩神社・櫻岡大神宮はnamed部分のみFact候補とし、未記名集合を補完しない。
3. 宮城縣護國神社はSource不足ではなくcollective deity構造のためHOLDする。
4. 富知六所浅間神社は現在の祭神を確定するaccepted Source不足のためHOLDする。
5. Deity HOLD 2社をCandidate Poolから除外しない。
6. History Fact availability audit完了前にRecommendation eligibilityを確定しない。
7. Production / Seed / Candidate Master / Runtimeは変更しない。

## Next

```text
Wave0 usable History Fact Availability Audit
```

History監査後、Deity OR HistoryのShared Eligibility到達可能性を43社全体で再集計する。
