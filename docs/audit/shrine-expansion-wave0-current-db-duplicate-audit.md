# Shrine Expansion Wave 0 Current DB Duplicate Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: `docs/audit/shrine-expansion-candidate-pool-wave0.md` の44候補
- Current DB reference: Project Google Sheet `神社のDB`
- Current real shrine rows: 113（EXCLUDED QA fixture 5行を除外）
- Production DB write: なし
- Candidate Master write: なし
- Shrine seed change: なし

## 目的

Wave 0の44候補をCandidate Masterへ投入する前に、現行神社データとの重複を除外する。

この監査での `NEW` は「現行DBに同一real-world shrineの登録が確認されなかった」という意味であり、Official Sourceによるidentity確定やKnowledge Readyを意味しない。

## 判定ルール

name-onlyでは重複判定しない。

以下を順に確認した。

1. exact name match
2. Unicode / 表記正規化後のname match
3. 既存113社との近似名・部分一致候補
4. 都道府県 / address文脈
5. 同一institution・別siteの可能性

判定値はCandidate Master Contractに従い、以下を使用する。

```text
NEW
DUPLICATE
ALIAS
SAME_NAME_DIFFERENT_SHRINE
REVIEW
```

## Aggregate Result

```text
wave0_candidates = 44
NEW = 43
DUPLICATE = 0
ALIAS = 0
SAME_NAME_DIFFERENT_SHRINE = 0
REVIEW = 1
```

`DUPLICATE = 0` は「44候補すべてを即DB投入してよい」という意味ではない。
43件のNEW候補もOfficial Source / coordinates / goriyaku / Knowledgeを別Gateで確認する。

## Candidate Matrix

| # | candidate_name | prefecture | result | identity_status | note |
|---:|---|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | NEW | UNREVIEWED | current DB same identity not detected |
| 2 | 大鳥大社 | 大阪府 | NEW | UNREVIEWED | current DB same identity not detected |
| 3 | 御岩神社 | 茨城県 | NEW | UNREVIEWED | current DB same identity not detected |
| 4 | 姫嶋神社 | 大阪府 | NEW | UNREVIEWED | current DB same identity not detected |
| 5 | 烏森神社 | 東京都 | NEW | UNREVIEWED | current DB same identity not detected |
| 6 | 榴岡天満宮 | 宮城県 | NEW | UNREVIEWED | current DB same identity not detected |
| 7 | 射水神社 | 富山県 | NEW | UNREVIEWED | current DB same identity not detected |
| 8 | 別小江神社 | 愛知県 | NEW | UNREVIEWED | current DB same identity not detected |
| 9 | 戸隠神社 中社 | 長野県 | NEW | UNREVIEWED | current DB same identity not detected |
| 10 | 札幌諏訪神社 | 北海道 | NEW | UNREVIEWED | current DB same identity not detected |
| 11 | 少彦名神社 | 大阪府 | NEW | UNREVIEWED | current DB same identity not detected |
| 12 | 大神神社 | 奈良県 | NEW | UNREVIEWED | representative/test seed mention is not treated as current canonical DB evidence |
| 13 | 北野天満宮 | 京都府 | NEW | UNREVIEWED | current DB same identity not detected |
| 14 | 宮城縣護國神社 | 宮城県 | NEW | UNREVIEWED | current DB same identity not detected |
| 15 | 平安神宮 | 京都府 | NEW | UNREVIEWED | current DB same identity not detected |
| 16 | 岡田宮 | 福岡県 | NEW | UNREVIEWED | current DB same identity not detected |
| 17 | 若宮八幡社 | 愛知県 | NEW | UNREVIEWED | current DB same identity not detected |
| 18 | 諏訪大社 下社秋宮 | 長野県 | REVIEW | PARTIAL_CONFIRMED | existing 上社本宮 is a distinct official site/address; product entity granularity review required |
| 19 | 建勲神社 | 京都府 | NEW | UNREVIEWED | current DB same identity not detected |
| 20 | 水堂須佐男神社 | 兵庫県 | NEW | UNREVIEWED | current DB same identity not detected |
| 21 | 大阪天満宮 | 大阪府 | NEW | UNREVIEWED | current DB same identity not detected |
| 22 | 毛谷黒龍神社 | 福井県 | NEW | UNREVIEWED | current DB same identity not detected |
| 23 | 富知六所浅間神社 | 静岡県 | NEW | UNREVIEWED | current DB same identity not detected |
| 24 | 居多神社 | 新潟県 | NEW | UNREVIEWED | current DB same identity not detected |
| 25 | 大崎八幡宮 | 宮城県 | NEW | UNREVIEWED | current DB same identity not detected |
| 26 | 鎌数伊勢大神宮 | 千葉県 | NEW | UNREVIEWED | current DB same identity not detected |
| 27 | 廣田神社 | 青森県 | NEW | UNREVIEWED | current DB same identity not detected |
| 28 | 石浦神社 | 石川県 | NEW | UNREVIEWED | current DB same identity not detected |
| 29 | 洲崎神社 | 千葉県 | NEW | UNREVIEWED | current DB same identity not detected |
| 30 | 来宮神社 | 静岡県 | NEW | UNREVIEWED | current DB same identity not detected |
| 31 | 蛇窪神社 | 東京都 | NEW | UNREVIEWED | current DB same identity not detected |
| 32 | 櫻岡大神宮 | 宮城県 | NEW | UNREVIEWED | current DB same identity not detected |
| 33 | 三嶋大社 | 静岡県 | NEW | UNREVIEWED | current DB same identity not detected |
| 34 | 唐澤山神社 | 栃木県 | NEW | UNREVIEWED | current DB same identity not detected |
| 35 | 柏神社 | 千葉県 | NEW | UNREVIEWED | current DB same identity not detected |
| 36 | 櫛田神社 | 福岡県 | NEW | UNREVIEWED | current DB same identity not detected |
| 37 | 坪沼八幡神社 | 宮城県 | NEW | UNREVIEWED | current DB same identity not detected |
| 38 | 菊田神社 | 千葉県 | NEW | UNREVIEWED | current DB same identity not detected |
| 39 | 伊奈波神社 | 岐阜県 | NEW | UNREVIEWED | current DB same identity not detected |
| 40 | 行田八幡神社 | 埼玉県 | NEW | UNREVIEWED | current DB same identity not detected |
| 41 | 青島神社 | 宮崎県 | NEW | UNREVIEWED | current DB same identity not detected |
| 42 | 一之宮貫前神社 | 群馬県 | NEW | UNREVIEWED | current DB same identity not detected |
| 43 | 若宮神明社 | 愛知県 | NEW | UNREVIEWED | current DB same identity not detected |
| 44 | 西宮神社 | 兵庫県 | NEW | UNREVIEWED | current DB same identity not detected |

## Suwa Taisha Review

現行DBには以下が存在する。

```text
諏訪大社（上社本宮）
長野県諏訪市中洲宮山1
```

Wave 0には以下が存在する。

```text
諏訪大社 下社秋宮
```

諏訪大社公式情報では、上社本宮と下社秋宮は別の宮として掲載され、所在地も異なる。

```text
上社本宮: 長野県諏訪市中洲宮山1
下社秋宮: 長野県諏訪郡下諏訪町5828
```

したがって `DUPLICATE` とは判定しない。

ただし、KAMI MUSUBIのShrine entityを「諏訪大社全体」「四社個別」のどちらの粒度で管理するかは本監査では決定しないため `REVIEW` とする。

## Fixture Boundary

repository内のrepresentative fixture / test seedにCandidate名が存在しても、Current Production / canonical Shrine DBの重複証拠として扱わない。

例として `大神神社` はrepresentative/test用途のseedに存在するが、今回参照したCurrent DB 113実社の登録行としては検出されなかった。

Test fixtureの存在を理由にreal candidateを除外しない。

## Decision

1. 43候補を `NEW` としてCandidate Master投入対象へ進める。
2. 43候補の `identity_status` はまだ `UNREVIEWED` とする。
3. 諏訪大社 下社秋宮はCandidate Masterへの自動投入を保留し `REVIEW` とする。
4. 43候補について次にOfficial Source Availability / location / goriyaku取得可能性を監査する。
5. RankingはDiscovery Provenanceのままとし、Fact Sourceへ昇格させない。

## Non-Goals

- Production DBへの追加
- Shrine seedへの追加
- 43候補のOfficial identity確定
- goriyaku / goriyaku_tagsの付与
- Recommendation Eligibility判定
- Concierge / Compass runtime変更
- 諏訪大社のentity granularity最終決定

## Next

次工程は `WAVE0_OFFICIAL_SOURCE_AND_KNOWLEDGE_AVAILABILITY_AUDIT` とする。

その監査を通過した候補からCandidate MasterへDiscovery Provenance付きで投入する。
