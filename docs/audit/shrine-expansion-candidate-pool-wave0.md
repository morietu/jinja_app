# Shrine Expansion Candidate Pool Wave 0

## Status

- Status: `DISCOVERY_POOL_CREATED`
- Recorded at: `2026-09-09`
- Scope: Historical Omairi recovery 44 candidates
- Candidate Master write: まだ行わない
- Production DB write: なし
- Shrine seed change: なし

## 目的

500社拡充用Candidate Poolの最初の母集団として、Historical Candidate Auditで再確認できた44社をWave 0候補として固定する。

本表は採用済み神社一覧ではない。
全候補は `UNREVIEWED` とし、現行DB重複・real-world identity・Official Source・Knowledge取得可能性の確認後にCandidate Masterへ採用する。

## Discovery Source Snapshot

Omairiランキング断片は同一日時の単一TOP100ではない。
そのため順位ごとに以下のSource URLとcaptured_atを保持する。

| Rank range | discovery_source_url | captured_at |
|---|---|---|
| 1-25 | https://omairi.club/spots/ranking/shrine | 2026-09-07 |
| 26-50 | https://omairi.club/spots/ranking/shrine/page/2 | 2026-09-06 |
| 51-75 | https://omairi.club/spots/ranking/shrine/page/3 | 2026-08-27 |
| 76-100 | https://omairi.club/spots/ranking/shrine/page/4 | 2026-09-03 |

`discovery_source = Omairi 全国神社人気ランキング2026`

## Wave 0 Candidates

| # | candidate_name | prefecture | discovery_rank | captured_at | duplicate_status |
|---:|---|---|---:|---|---|
| 1 | 三輪神社 | 愛知県 | 6 | 2026-09-07 | UNREVIEWED |
| 2 | 大鳥大社 | 大阪府 | 14 | 2026-09-07 | UNREVIEWED |
| 3 | 御岩神社 | 茨城県 | 15 | 2026-09-07 | UNREVIEWED |
| 4 | 姫嶋神社 | 大阪府 | 16 | 2026-09-07 | UNREVIEWED |
| 5 | 烏森神社 | 東京都 | 18 | 2026-09-07 | UNREVIEWED |
| 6 | 榴岡天満宮 | 宮城県 | 19 | 2026-09-07 | UNREVIEWED |
| 7 | 射水神社 | 富山県 | 20 | 2026-09-07 | UNREVIEWED |
| 8 | 別小江神社 | 愛知県 | 23 | 2026-09-07 | UNREVIEWED |
| 9 | 戸隠神社 中社 | 長野県 | 30 | 2026-09-06 | UNREVIEWED |
| 10 | 札幌諏訪神社 | 北海道 | 34 | 2026-09-06 | UNREVIEWED |
| 11 | 少彦名神社 | 大阪府 | 36 | 2026-09-06 | UNREVIEWED |
| 12 | 大神神社 | 奈良県 | 38 | 2026-09-06 | UNREVIEWED |
| 13 | 北野天満宮 | 京都府 | 40 | 2026-09-06 | UNREVIEWED |
| 14 | 宮城縣護國神社 | 宮城県 | 44 | 2026-09-06 | UNREVIEWED |
| 15 | 平安神宮 | 京都府 | 46 | 2026-09-06 | UNREVIEWED |
| 16 | 岡田宮 | 福岡県 | 47 | 2026-09-06 | UNREVIEWED |
| 17 | 若宮八幡社 | 愛知県 | 48 | 2026-09-06 | UNREVIEWED |
| 18 | 諏訪大社 下社秋宮 | 長野県 | 53 | 2026-08-27 | UNREVIEWED |
| 19 | 建勲神社 | 京都府 | 54 | 2026-08-27 | UNREVIEWED |
| 20 | 水堂須佐男神社 | 兵庫県 | 56 | 2026-08-27 | UNREVIEWED |
| 21 | 大阪天満宮 | 大阪府 | 59 | 2026-08-27 | UNREVIEWED |
| 22 | 毛谷黒龍神社 | 福井県 | 61 | 2026-08-27 | UNREVIEWED |
| 23 | 富知六所浅間神社 | 静岡県 | 62 | 2026-08-27 | UNREVIEWED |
| 24 | 居多神社 | 新潟県 | 66 | 2026-08-27 | UNREVIEWED |
| 25 | 大崎八幡宮 | 宮城県 | 70 | 2026-08-27 | UNREVIEWED |
| 26 | 鎌数伊勢大神宮 | 千葉県 | 71 | 2026-08-27 | UNREVIEWED |
| 27 | 廣田神社 | 青森県 | 72 | 2026-08-27 | UNREVIEWED |
| 28 | 石浦神社 | 石川県 | 73 | 2026-08-27 | UNREVIEWED |
| 29 | 洲崎神社 | 千葉県 | 74 | 2026-08-27 | UNREVIEWED |
| 30 | 来宮神社 | 静岡県 | 75 | 2026-08-27 | UNREVIEWED |
| 31 | 蛇窪神社 | 東京都 | 79 | 2026-09-03 | UNREVIEWED |
| 32 | 櫻岡大神宮 | 宮城県 | 80 | 2026-09-03 | UNREVIEWED |
| 33 | 三嶋大社 | 静岡県 | 81 | 2026-09-03 | UNREVIEWED |
| 34 | 唐澤山神社 | 栃木県 | 84 | 2026-09-03 | UNREVIEWED |
| 35 | 柏神社 | 千葉県 | 85 | 2026-09-03 | UNREVIEWED |
| 36 | 櫛田神社 | 福岡県 | 86 | 2026-09-03 | UNREVIEWED |
| 37 | 坪沼八幡神社 | 宮城県 | 87 | 2026-09-03 | UNREVIEWED |
| 38 | 菊田神社 | 千葉県 | 93 | 2026-09-03 | UNREVIEWED |
| 39 | 伊奈波神社 | 岐阜県 | 94 | 2026-09-03 | UNREVIEWED |
| 40 | 行田八幡神社 | 埼玉県 | 95 | 2026-09-03 | UNREVIEWED |
| 41 | 青島神社 | 宮崎県 | 96 | 2026-09-03 | UNREVIEWED |
| 42 | 一之宮貫前神社 | 群馬県 | 97 | 2026-09-03 | UNREVIEWED |
| 43 | 若宮神明社 | 愛知県 | 98 | 2026-09-03 | UNREVIEWED |
| 44 | 西宮神社 | 兵庫県 | 100 | 2026-09-03 | UNREVIEWED |

## Gate before Candidate Master

各候補について次の順序で確認する。

1. 現行Shrine DB / seedと照合する。
2. name-onlyではなくprefecture / address / identityを確認する。
3. `NEW / DUPLICATE / ALIAS / SAME_NAME_DIFFERENT_SHRINE / REVIEW`へ分類する。
4. NEW候補のみCandidate Masterへ投入する。
5. 同一Candidateが別Discovery Sourceにも存在する場合は新規Candidateを作らず `discovery_sources[]` へ統合する。

## Knowledge / Runtime Gate

Candidate Master投入後もDB採用とはしない。

DB投入候補に進める前に最低限以下を確認する。

- official_name
- official_address
- official_source_type
- official_source_url
- verified_at
- latitude / longitude
- source-backed goriyaku
- goriyaku_tags normalization

DB投入後は現行の共有Recommendation Eligibilityを通過し、Concierge / Compass両方で利用可能かを別途QAする。

## Next

Wave 0の次工程は `CURRENT_DB_DUPLICATE_AUDIT` とする。
その後、巡縁・じゃらん・都道府県別Discoveryを追加しCandidate Poolを500社超へ拡張する。
