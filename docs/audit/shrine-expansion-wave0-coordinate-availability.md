# Shrine Expansion Wave 0 Coordinate Availability Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `NEW` 43 candidates
- Coordinate availability only
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- Coordinate adoption: なし
- Recommendation / Concierge / Compass変更: なし

## 目的

Wave 0 の `NEW` 43社について、KAMI MUSUBI の Compass / distance / direction 計算に利用する `latitude / longitude` を、神社 identity を取り違えずに取得できる経路が存在するかを確認する。

本監査は座標の最終採用ではない。
取得可能性を確認し、実DBへ書き込む前の Position QA が必要な候補を分離する。

## Position Source Policy

位置情報の確認では、Fact Source と Position Source を分離する。

```text
Official / Authority Source
= 神社名称・正式住所・real-world identity を確定する

Position Source
= 緯度経度を取得する
```

Position Source の優先順位は以下。

1. 神社公式 / 国・自治体等が明示する緯度経度
2. 地図 provider（MapFan / NAVITIME / Yahoo!マップ / Apple Maps 等）
3. 大学・研究機関・公開地理データ（國學院大學 / GeoShape 等）
4. OpenStreetMap / Wikidata 系は corroboration 用

Discovery ranking は Position Source として使用しない。

## 判定

- `PASS`: official identity / address と対応する明示的な coordinate source を取得できる
- `REVIEW_ANCHOR`: coordinate source は取得できるが、境内が広い・複数 anchor が存在するなど、最終採用前に目視QAが必要
- `HOLD`: 現時点で coordinate を取得できる安全な経路がない
- `UNKNOWN`: candidate identity と coordinate source の対応を確定できない

## Summary

| Status | Count |
|---|---:|
| PASS | 40 |
| REVIEW_ANCHOR | 3 |
| HOLD | 0 |
| UNKNOWN | 0 |
| **Total** | **43** |

```text
COORDINATE_ACQUISITION_PATH = 43 / 43
SAFE_TO_WRITE_WITHOUT_POSITION_QA = 0 / 43
```

43社すべてで latitude / longitude の取得経路は確認できた。
ただし、本監査だけを根拠にDBへ座標を書き込まない。

## Candidate Matrix

| # | candidate_name | prefecture | status | coordinate source / note |
|---:|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | PASS | MapFan。名古屋市中区大須の対象社として coordinate 取得可能。 |
| 2 | 大鳥大社 | 大阪府 | PASS | 國學院大學 神社DB。住所と緯度経度を明示。 |
| 3 | 御岩神社 | 茨城県 | PASS | GeoShape『日本歴史地名大系』。日立市の対象社 coordinate を確認。 |
| 4 | 姫嶋神社 | 大阪府 | PASS | MapFan。大阪市西淀川区姫島の対象社として coordinate 取得可能。 |
| 5 | 烏森神社 | 東京都 | PASS | GeoShape。港区新橋の対象社として緯度経度を明示。 |
| 6 | 榴岡天満宮 | 宮城県 | PASS | GeoShape。仙台市宮城野区榴ケ岡の対象社 coordinate を明示。 |
| 7 | 射水神社 | 富山県 | PASS | official address `高岡市古城1-1` と照合し、GeoShape の古城側 record を採用候補として識別可能。二上側同名社を除外できる。 |
| 8 | 別小江神社 | 愛知県 | PASS | GeoShape。公式所在地と一致する coordinate を取得可能。 |
| 9 | 戸隠神社 中社 | 長野県 | PASS | 長野市公式「ながの百景」および MapFan で coordinate を取得可能。 |
| 10 | 札幌諏訪神社 | 北海道 | PASS | MapFan。札幌市東区の対象社として coordinate を取得可能。 |
| 11 | 少彦名神社 | 大阪府 | PASS | GeoShape。大阪市中央区道修町の対象社 coordinate を明示。 |
| 12 | 大神神社 | 奈良県 | REVIEW_ANCHOR | official address `桜井市三輪1422` は確定。國學院大學 / GeoShape に同住所対応 coordinate があるが、境内 anchor に数百m差があるため最終採用前に目視QA必須。 |
| 13 | 北野天満宮 | 京都府 | PASS | 國學院大學デジタル・ミュージアムで住所・緯度経度を明示。 |
| 14 | 宮城縣護國神社 | 宮城県 | REVIEW_ANCHOR | official address `仙台市青葉区川内1` は確定。OSM系 coordinate は取得可能だが、広い仙台城本丸域内でSource間差があるため目視QA必須。 |
| 15 | 平安神宮 | 京都府 | PASS | MapFan。京都市公式所在地と対応する coordinate を取得可能。 |
| 16 | 岡田宮 | 福岡県 | PASS | 國學院大學 古典文化学DB。北九州市八幡西区岡田町の緯度経度を明示。 |
| 17 | 若宮八幡社 | 愛知県 | PASS | NAVITIME。名古屋市中区栄3-35-30 の coordinate を取得可能。 |
| 18 | 建勲神社 | 京都府 | PASS | MapFan。京都市北区の対象社 coordinate を取得可能。 |
| 19 | 水堂須佐男神社 | 兵庫県 | PASS | provider / shrine-map 系で `尼崎市水堂町1-25-7` と対応する coordinate を取得可能。尼崎市公式で住所を corroborate。 |
| 20 | 大阪天満宮 | 大阪府 | PASS | GeoShape。大阪市北区の対象社 coordinate を明示。 |
| 21 | 毛谷黒龍神社 | 福井県 | PASS | MapFan / 地図系Source。公式住所 `福井市毛矢3-8-1` と対応する coordinate を取得可能。 |
| 22 | 富知六所浅間神社 | 静岡県 | PASS | GeoShape。富士市浅間本町の対象社 coordinate を明示。 |
| 23 | 居多神社 | 新潟県 | PASS | GeoShape。上越市五智6-1-11 の coordinate を明示。 |
| 24 | 大崎八幡宮 | 宮城県 | PASS | NAVITIME。宮城県神社庁の所在地と一致する coordinate を取得可能。 |
| 25 | 鎌数伊勢大神宮 | 千葉県 | PASS | GeoShape。旭市鎌数の対象社 coordinate を明示。 |
| 26 | 廣田神社 | 青森県 | PASS | MapFan。青森県神社庁の住所 `青森市長島2-13-5` と対応する coordinate を取得可能。 |
| 27 | 石浦神社 | 石川県 | PASS | MapFan / GeoShape。金沢市の対象社 coordinate を取得可能。 |
| 28 | 洲崎神社 | 千葉県 | PASS | GeoShape。館山市洲崎1697の対象社 coordinate を明示。 |
| 29 | 來宮神社 | 静岡県 | PASS | 静岡県Open Dataが `熱海市西山町43-1` と緯度経度を明示。MapFanとも整合。 |
| 30 | 蛇窪神社 | 東京都 | PASS | Yahoo!マップ / geospatial source。品川区公式でidentity・住所を確認でき、対象地点を一意に解決可能。 |
| 31 | 櫻岡大神宮 | 宮城県 | PASS | OpenStreetMap系 geospatial source で coordinate 取得可能。公式所在地との照合を後続 Position QA で行う。 |
| 32 | 三嶋大社 | 静岡県 | PASS | 國學院大學 / GeoShape。公式所在地と対応する coordinate を明示。 |
| 33 | 唐澤山神社 | 栃木県 | PASS | MapFan。佐野市公式の対象社 identity と対応する coordinate を取得可能。 |
| 34 | 柏神社 | 千葉県 | PASS | MapFan。公式住所 `柏市柏3-2-2` と対応する coordinate を取得可能。 |
| 35 | 櫛田神社 | 福岡県 | PASS | GeoShape。福岡市博多区上川端町の対象社 coordinate を明示。 |
| 36 | 坪沼八幡神社 | 宮城県 | REVIEW_ANCHOR | 仙台市公式が参道Viewpoint coordinateを明示し、公式サイトにも地図あり。ただし viewpoint / 社殿 anchor を区別して最終採用する必要がある。 |
| 37 | 菊田神社 | 千葉県 | PASS | 大学研究資料に `習志野市津田沼3-2-5` と coordinate があり、公式住所と一致。 |
| 38 | 伊奈波神社 | 岐阜県 | PASS | GeoShape。岐阜市伊奈波通の対象社 coordinate を明示。 |
| 39 | 行田八幡神社 | 埼玉県 | PASS | MapFan。行田市の対象社 coordinate を取得可能。 |
| 40 | 青島神社 | 宮崎県 | PASS | 國學院大學 / GeoShape。公式所在地と対応する coordinate を明示。 |
| 41 | 一之宮貫前神社 | 群馬県 | PASS | 國學院大學デジタル・ミュージアムで緯度経度を明示。 |
| 42 | 若宮神明社 | 愛知県 | PASS | MapFan。一宮市の対象社 coordinate を取得可能。 |
| 43 | 西宮神社 | 兵庫県 | PASS | GeoShape。西宮市社家町1-17 の対象社 coordinate を明示。 |

## REVIEW_ANCHOR Detail

### 大神神社

Official Source:

```text
奈良県桜井市三輪1422
```

同住所に対応する coordinate Sourceは取得できる。
一方、公開Source間で拝殿・三ツ鳥居・境内遺跡等のanchor差があり、数百m級の差が確認できる。

判定:

```text
ACQUISITION = AVAILABLE
ADOPTION = REVIEW_REQUIRED
```

### 宮城縣護國神社

Official Source:

```text
宮城県仙台市青葉区川内1番地
```

仙台城本丸域内という広い precinct のため、公開coordinate Source間に差がある。
位置情報そのものは取得可能だが、Compassで使用するShrine pointとして本殿・拝殿付近を採るかを目視確認する。

判定:

```text
ACQUISITION = AVAILABLE
ADOPTION = REVIEW_REQUIRED
```

### 坪沼八幡神社

公式住所・公式地図は取得可能。
仙台市公式には「参道から見る坪沼八幡神社」のViewpoint coordinateが存在するが、これはShrine本体pointと同義ではない。

判定:

```text
ACQUISITION = AVAILABLE
ADOPTION = REVIEW_REQUIRED
```

## Same-name / Identity Risks Resolved at Availability Stage

### 射水神社

公開地理データには富山県高岡市内の「射水神社」が複数存在する。
神社公式の所在地は以下。

```text
〒933-0044 富山県高岡市古城1番1号
```

したがって、二上1519側recordではなく、古城1番側recordを対象と識別できる。

### 大神神社

奈良県内に同名recordが複数あるため名称のみでは照合しない。
公式所在地 `桜井市三輪1422` をidentity keyとして対象を絞る。

## Audit Decision

1. Wave 0 NEW 43社すべてで latitude / longitude の取得経路を確認した。
2. 43社を `coordinate unavailable` 理由でCandidate Poolから除外する必要はない。
3. 40社は通常のPosition QAへ進める。
4. 3社は `REVIEW_ANCHOR` として、DB書込前の目視確認を必須とする。
5. 本監査では座標値をCandidate Master / Shrine Seed / Production DBへ書き込まない。
6. Official addressとPosition Sourceの一致確認をDB投入時の必須Gateとして維持する。
7. 同名神社は名称のみでcoordinateを採用しない。

## Non-Goals

- coordinateのDB投入
- `location` geometry更新
- Google Place IDの採用
- coordinate correction migration作成
- goriyaku / goriyaku_tags確認
- Deity / History Fact生成
- Recommendation / Direction / Distanceロジック変更

## Next

次工程は Wave 0 候補の `usable Deity Fact / usable History Fact` 取得可能性監査、または `source-backed goriyaku` 取得可能性監査とする。
