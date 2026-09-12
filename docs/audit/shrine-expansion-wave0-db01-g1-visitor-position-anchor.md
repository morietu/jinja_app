# W0-DB01-G1 Visitor / Navigation Anchor Resolution

## Status

- Recorded at: `2026-09-12`
- Scope: W0-DB01 / 御岩神社のPosition HOLD解消
- Governing Contract: `docs/knowledge/shrine-position-contract.md`
- Production DB write: なし
- Base Seed write: なし
- Candidate Master factual hydration: なし
- Knowledge Seed write: なし
- Recommendation / Concierge / Compass runtime change: なし

```text
POSITION_GATE = PASS
POSITION_STATUS = PASS
ADOPTED_COORDINATE = 36.63604985, 140.58558306
W0_DB01_DATA_BUILD = NOT_STARTED
```

本工程はPosition ContractとSource採用を確定するだけであり、Data Buildそのものは開始しない。

## Background

W0-DB01-G0では御岩神社について次の競合があり、`HOLD_UNRESOLVED` とした。

```text
current visitor-facing address = 茨城県日立市入四間町752
old GeoShape address            = 茨城県日立市入四間町1217
old GeoShape coordinate         = 36.636842, 140.582930
OSM / Wikidata                  = current shrine vicinityを示すが単独採用禁止
```

Codex環境ではprimary position sourceへ到達できず、座標を選定せずSTOPした。

Mother Ship側でcurrent Sourceを再確認し、Positionの意味をVisitor / Navigation Anchorとして正本化した。

## Canonical Position Meaning

`docs/knowledge/shrine-position-contract.md` により、KAMI MUSUBIの `Shrine.latitude` / `Shrine.longitude` は次を意味する。

```text
Visitor / Navigation Anchor
```

用途:

- map display
- distance calculation
- Compass direction calculation
- route guidance
- Shrine detail map transition

法人登記所在地・歴史資料地点・山域centroid等とは意味を分離する。

## Visitor Identity

### Shrine official

Source:

`https://www.oiwajinja.jp/`

確認値:

```text
name    = 御岩神社
address = 〒311-0402 茨城県日立市入四間町752
```

公式は同住所を掲示し、参拝者向け交通案内を提供している。

### Ibaraki official tourism

Source:

`https://www.ibarakiguide.jp/spot.php?code=470&mode=detail`

確認値:

```text
address = 茨城県日立市入四間町752
```

同ページは御岩神社へのGoogle Maps導線も掲載している。

Result:

```text
VISITOR_IDENTITY = CONFIRMED
OFFICIAL_ADDRESS = 茨城県日立市入四間町752
```

## Primary Position Source

Mapion POI:

`https://www.mapion.co.jp/phonebook/M06005/08202/ILSP0061135259_ipclm/`

Mapionの「御岩神社」POIページの地図centerに次が明示されている。

```text
latitude  = 36.63604985
longitude = 140.58558306
```

Source type:

```text
map_provider_poi
```

Mapionページ上の名称は `御岩神社` であり、日立市入四間町のPOIとしてroute / map導線を提供する。

Result:

```text
PRIMARY_POSITION_SOURCE = PASS
```

## Independent Corroboration

W0-DB01-G0で記録済みのcurrent corroboration:

```text
OSM       = 36.63614, 140.58516
Wikidata  = 36.6362, 140.5852
```

Mapion adopted candidateとのhaversine距離（R=6371008.8m）:

```text
Mapion -> OSM       = 39.1 m
Mapion -> Wikidata  = 38.0 m
```

この距離は自動PASS閾値ではない。同一Shrine周辺を指す独立corroborationの観測値として記録する。

## Conflicting Legal Address

gBizINFO / 法人番号公表サイト:

`https://info.gbiz.go.jp/hojin/ichiran?hojinBango=1050005007118`

確認値:

```text
entity        = 宗教法人御岩神社
legal address = 茨城県日立市入四間町1217番地
```

本工程では `1217` を旧住所・誤住所とは断定しない。

用途を次のように分離する。

```text
752  = current visitor-facing shrine address
1217 = legal entity / registered-office addressとして観測
```

legal addressだけを理由にVisitor / Navigation Anchorを変更しない。

## Old GeoShape Candidate

既存監査値:

```text
address   = 茨城県日立市入四間町1217
latitude  = 36.636842
longitude = 140.582930
```

Mapion adopted candidateとの差:

```text
252.6 m
```

旧GeoShapeはvisitor-facing current address `752` と一致せず、現在のvisitor navigation anchorとして自動継承しない。

ただし、旧GeoShape地点を「誤った地点」と断定もしない。legal / historical / parcel用途の別地点である可能性を保持する。

## Mother Ship Decision

次を採用する。

```text
POSITION_GATE = PASS
POSITION_STATUS = PASS

ADOPTED_POSITION
latitude  = 36.63604985
longitude = 140.58558306

POSITION_SOURCE_TYPE = map_provider_poi
POSITION_SOURCE_URL  = https://www.mapion.co.jp/phonebook/M06005/08202/ILSP0061135259_ipclm/

OFFICIAL_VISITOR_ADDRESS = 茨城県日立市入四間町752
```

採用理由:

1. current visitor-facing identityがShrine officialとIbaraki official tourismで一致する。
2. Mapion current POIが同一名称の御岩神社をnavigation対象として明示し、追跡可能な座標を提供する。
3. OSM / Wikidataのcurrent shrine pointsが独立corroborationとして同一境内付近を示す。
4. `1217` legal addressは別用途として分離でき、visitor identity `752` を否定しない。
5. old GeoShape candidateはcurrent visitor addressと一致せず、visitor anchorとして自動継承する理由がない。

## Remaining Gate

Position HOLDは解消したが、W0-DB01 Data Buildはまだ開始しない。

```text
REAL_W0_DB01_SEED_RETEST = PENDING
```

Data Build時には実W0-DB01 Seedを作成した上で、fresh DBに対する3段階bootstrapを再実行する。

またexplicit `goriyaku_tags` はauthoritative exact-setであるため、各Shrineについて次を監査する。

```text
BACKFILL_SET
APPROVED_EXPLICIT_SET
ADD_SET
REMOVE_SET
```

説明不能な `REMOVE_SET` が1件でもある場合はSTOPする。

## Non-Goals

- 本工程でBase Seedへ御岩神社を追加しない
- Candidate Masterをhydrationしない
- Production DBへ書き込まない
- Knowledge Seedを作成しない
- Position採用を理由にgoriyaku / goriyaku_tagsを変更しない
- Recommendation / Ranking / Concierge / Compassのruntime logicを変更しない
- 旧GeoShape / legal addressを削除・改変しない
