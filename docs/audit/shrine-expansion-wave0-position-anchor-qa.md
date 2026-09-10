# Shrine Expansion Wave 0 Position Anchor QA

## Status

- QA status: `COMPLETE`
- Recorded at: `2026-09-10`
- Scope: Wave 0 `REVIEW_ANCHOR` 3 shrines
- Target: Compass / distance / direction 用の representative shrine point
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- Recommendation / Concierge / Compass runtime変更: なし

## 目的

`shrine-expansion-wave0-coordinate-availability.md` で `REVIEW_ANCHOR` とした3社について、取得済み coordinate が「神社の代表点」として安全に採用可能かを再確認する。

本QAは座標をProductionへ書き込む工程ではない。後続Importで利用できる `adoption candidate` を確定する。

## Position Anchor Policy

Compass / distance / direction 用の代表点は以下の優先順位で決める。

1. 神社の real-world identity / official address と一致すること
2. 参拝対象となる拝殿・本殿・主要 worship area に近いこと
3. 公式サイトの地図、Authority / academic / public geospatial data で相互確認できること
4. 駐車場、参道入口だけ、観光Viewpoint、地図iframeのviewport centerを shrine anchor と誤認しないこと
5. 同名別社・摂社・周辺施設のcoordinateを混入させないこと

判定:

- `PASS_ANCHOR`: identity-safeな representative point を確定できる
- `HOLD_ANCHOR`: 複数候補を安全に解消できず、採用を保留する

## Summary

| Shrine | Previous | QA result | Adoption candidate |
|---|---|---|---|
| 大神神社 | `REVIEW_ANCHOR` | `PASS_ANCHOR` | `34.528817, 135.852894` |
| 宮城縣護國神社 | `REVIEW_ANCHOR` | `PASS_ANCHOR` | `38.252500, 140.855556` |
| 坪沼八幡神社 | `REVIEW_ANCHOR` | `PASS_ANCHOR` | `38.191446, 140.766149` |

```text
PASS_ANCHOR = 3 / 3
HOLD_ANCHOR = 0 / 3
REVIEW_ANCHOR_REMAINING = 0 / 3
```

## 1. 大神神社

### Identity

対象は奈良県桜井市三輪1422の大神神社。

Official / Authority corroboration:

- 大神神社公式: `https://oomiwa.or.jp/`
- 奈良県公式観光: `https://yamatoji.nara-kankou.or.jp/01shaji/01jinja/03east_area/omiwajinja/access/`
- 國學院大學 神社DB: `https://kojiki.kokugakuin.ac.jp/jinjya/omiwajinja/`
- 國學院大學デジタル・ミュージアム: `https://jmapps.ne.jp/kokugakuin/det.html?data_id=53357`

國學院大學の現代神社資料は大神神社を `桜井市三輪` とし、緯度経度を以下で明示する。

```text
N 34°31'43.740"
E 135°51'10.420"
= 34.5288167, 135.8528944
```

採用候補は6桁へ丸める。

```text
34.528817, 135.852894
```

### Anchor corroboration

國學院大學の「大神神社境内」考古資料は、禁足地南縁について以下を明示する。

- `https://jmapps.ne.jp/kokugakuin/det.html?data_id=30439`
- `34.5286567, 135.8531569`

現代神社DBの候補点との差は約30mで、同一主要境内域として整合する。

一方、GeoShape『日本歴史地名大系』の大神神社 record は同じ `三輪1422` を持つが `34.530479, 135.856628` を示し、上記現代神社DB点から約389m離れる。

- `https://geoshape.ex.nii.ac.jp/nrct-poi/resource/30/300000200300.html`

このGeoShape pointは歴史地名データの施設代表点としては利用できるが、Compassの参拝代表点としては採用しない。

また大神神社周辺には同名・摂社等の地理recordが複数あるため、名称だけでcoordinateを解決しない。

### Decision

```text
IDENTITY = CONFIRMED
WORSHIP_AREA_ANCHOR = RESOLVED
ADOPTION = PASS_ANCHOR
ADOPTION_CANDIDATE = 34.528817, 135.852894
```

## 2. 宮城縣護國神社

### Identity

Official Sourceおよび宮城県神社庁は所在地を以下で一致して示す。

```text
〒980-0862 宮城県仙台市青葉区川内1番地
```

Sources:

- 神社公式: `https://gokokujinja.org/`
- 宮城県神社庁: `https://miyagi-jinjacho.or.jp/jinja-search/detail.php?code=310010043`
- 神社公式境内案内: `https://gokokujinja.org/keidai/keidai.html`

仙台城本丸跡の広いprecinct内にあるため、住所だけではrepresentative pointを一意にしにくい。

### Position corroboration

Wikidata Shrine listは宮城縣護國神社 `Q11453994` を以下で示す。

```text
38.252500, 140.855556
```

- `https://www.wikidata.org/wiki/Wikidata:WikiProject_Japan/サブプロジェクト/神社/都道府県別/宮城`

OpenStreetMap `way 1023506588` / Mapcartaも `amenity=place_of_worship` として以下を示す。

```text
38.25249, 140.85552
```

- `https://mapcarta.com/W1023506588`

両者は数m級で整合するため、神社entity / worship-area representative pointとして採用可能と判断する。

神社公式トップページのGoogle Maps iframeには viewport center として概ね以下が含まれる。

```text
38.252450, 140.853157
```

これは採用候補から約210m西にあり、広い仙台城址を表示するための地図中心点と解釈できる。iframeの表示中心を神社anchorとして採用しない。

### Decision

```text
IDENTITY = CONFIRMED
WORSHIP_AREA_ANCHOR = RESOLVED
ADOPTION = PASS_ANCHOR
ADOPTION_CANDIDATE = 38.252500, 140.855556
```

## 3. 坪沼八幡神社

### Identity

神社公式アクセスページは「神社・社務所」として以下を明示する。

```text
〒982-0231 宮城県仙台市太白区坪沼舘前東69
```

Sources:

- 神社公式: `https://tsubonuma.org/`
- 神社公式アクセス: `https://tsubonuma.org/s/docs/access.html`

公式アクセスページの「大きな地図で見る」Google Maps linkには以下の map point が含まれる。

```text
ll=38.191446,140.766149
q=宮城県仙台市太白区坪沼舘前東69
```

したがって、公式サイトが案内する神社・社務所の詳細map pointを採用候補とする。

### Viewpoint exclusion

仙台市「杜の都・仙台」のビューポイント T047 は「参道から見る坪沼八幡神社」のViewpointとして以下を公開している。

```text
38.18997942, 140.7673272
```

- `https://www.city.sendai.jp/kekan/jigyosha/taisaku/kenchiku/toshikekan/toshikekan/viewpoint/documents/t047-t051.pdf`

同資料はこの点を「表坂」からの眺望地点として明示しており、神社本体pointではない。

公式サイトmap pointとの差は約193m。

したがって市Viewpoint coordinateはCompass anchorから除外する。

### Address note

一部Authority / mapping資料には `坪沼字舘前東70` 表記も存在するが、公式サイトの69番地と同一神社identityを指す資料群であり、本QAでは別神社とは扱わない。

### Decision

```text
IDENTITY = CONFIRMED
VIEWPOINT_CONFUSION = RESOLVED
ADOPTION = PASS_ANCHOR
ADOPTION_CANDIDATE = 38.191446, 140.766149
```

## QA Decision

1. `REVIEW_ANCHOR` 3社すべてで、Compass / distance / direction用のrepresentative point候補を確定した。
2. 3社とも `PASS_ANCHOR` へ進められる。
3. Production DB / Candidate Masterへは本PRでは書き込まない。
4. 大神神社ではhistorical-place coordinateとworship-area coordinateを分離する。
5. 宮城縣護國神社では広域map viewport centerをshrine pointとして採用しない。
6. 坪沼八幡神社では仙台市Viewpointをshrine pointとして採用しない。
7. 後続Wave0 Core Ready判定では、本書のadoption candidateをPosition QA通過値として扱える。

## Non-Goals

- Production DB latitude / longitude update
- Candidate Master data update
- Shrine seed update
- Geocoding implementation変更
- Compass calculation変更
- Route provider変更
- Recommendation / Ranking変更

## Close Condition

以下を満たしたためPosition QAを完了する。

```text
PASS_ANCHOR = 3
HOLD_ANCHOR = 0
REVIEW_ANCHOR_REMAINING = 0
```

次工程はWave0各Gateの結果を横断した `CORE READY候補の抽出` とする。