# Shrine Position Contract

## Status

- Status: `ACTIVE`
- Effective from: `2026-09-12`
- Scope: `Shrine.latitude` / `Shrine.longitude` の採用意味・Source要件・競合時Gate
- Runtime / DB schema change: なし
- Production DB write: なし

## 目的

KAMI MUSUBIで保存するShrine座標の意味を、法人登記所在地・歴史資料上の地点・山域中心点などと混同しないために定義する。

本Contractでは、`Shrine.latitude` / `Shrine.longitude` を **Visitor / Navigation Anchor** として扱う。

これは神社の法的所在地を表すための座標ではない。

## Canonical Meaning

```text
Shrine.latitude / Shrine.longitude
= Visitor / Navigation Anchor
```

Visitor / Navigation Anchorは、利用者が当該神社へ参拝する際の地図表示・距離・方角・経路案内に使用する代表点である。

主用途:

- 地図上のShrine表示
- 現在地からのdistance計算
- Compassのdirection計算
- route guidance
- Shrine detailからの地図導線

次の地点を自動的にVisitor / Navigation Anchorとはみなさない。

- 法人登記上の本店所在地
- 歴史資料上の旧所在地
- 境内を含む行政地番の任意点
- 山域・御神体・境内全体のcentroid
- 駐車場・社務所・登山口など、Shrineそのものと確認できない補助地点

## Identity Boundary

Positionを採用する前に、座標Sourceが指すreal-world entityとShrine identityを分離して確認する。

最低限、次を保持する。

```text
official_name
official_address
position_source_type
position_source_url
latitude
longitude
verified_at
```

`official_address`はvisitor-facingな神社所在地として、神社公式・自治体・都道府県公式観光・その他の公的な案内Sourceを優先する。

法人番号Source等に別住所が存在しても、それだけを理由にvisitor-facing identityを書き換えない。

## Source Adoption Rule

Position採用は次の条件を満たす場合に限る。

1. Shrine identityがcurrent authoritative sourceで確認できる。
2. primary position sourceが同一ShrineのPOI / place_of_worship / navigation targetを示している。
3. primary position sourceから緯度・経度を追跡可能である。
4. primary pointがvisitor-facing identityと説明可能に整合する。
5. 先行候補・住所・Source間に競合がある場合、独立corroborationを確認する。
6. 競合が説明不能な場合は座標を推測せず `HOLD_POSITION_REVIEW` とする。

### Primary position source

採用可能な例:

- 神社公式が直接掲載・リンクするnavigation map / map provider
- 自治体・都道府県等の公的visitor pageが当該Shrineとして掲載するmap / navigation target
- 現在のPOIとして同一Shrineを明示するmap provider
- 現行identityと整合する公的または準公的な位置資料

Source種別だけで自動PASSにはしない。名称・所在地・POIの対象entityを併せて確認する。

### Corroboration source

OSM / Wikidata等は独立corroborationとして使用できる。

ただし、先行採用候補とcurrent authoritative identityが競合している場合、**OSM / Wikidataのみをprimary sourceとしてadopted coordinateへ昇格させない**。

本Contractは「何m以内なら自動PASS」という固定閾値を定義しない。距離差は監査値として保持し、identity・Source種別・地点用途と合わせて評価する。

## Conflicting Address Rule

同一Shrineについて複数住所が観測された場合、まず用途を分離する。

例:

```text
visitor / navigation address
legal entity / registered office address
historical address
parcel / lot address
```

異なる用途の住所を「新旧」「正誤」と推測で統合しない。

法人登記住所は法人identityのEvidenceとして保持できるが、Visitor / Navigation Anchorの採用根拠として単独では使用しない。

## Existing Coordinate Conflict

既存座標とcurrent candidateに説明不能な差がある場合:

1. 既存座標を惰性で維持しない。
2. current candidateを距離だけで自動採用しない。
3. 両者のSource・address・地点用途を記録する。
4. deterministicにvisitor anchorを確定できなければ `HOLD_POSITION_REVIEW`。
5. Mother ShipでSource / policyが確定した後にのみPASSへ更新する。

## Audit Record

座標採用時には最低限、以下を追跡可能にする。

```text
official_name
official_address
latitude
longitude
position_source_type
position_source_url
verified_at
corroboration_source_url(s)
corroboration_coordinate(s)
coordinate_delta_m
conflicting_address_note
position_status
```

`coordinate_delta_m`はSource間差分の観測値であり、自動採用閾値ではない。

## Position Status

```text
PASS
HOLD_POSITION_REVIEW
```

### PASS

Visitor / Navigation Anchorとしてidentity・primary position source・必要なcorroborationが説明可能に揃っている。

### HOLD_POSITION_REVIEW

以下のいずれか:

- current primary coordinateを取得できない
- Sourceが指すentityが曖昧
- visitor addressとposition sourceの関係を説明できない
- 既存候補との競合が説明不能
- OSM / Wikidata等のcorroborationしかなく、primary sourceが不足

HOLD状態では座標を推測してSeed / Productionへ投入しない。

## Wave0 Decision Record: 御岩神社

2026-09-12 Mother Ship reviewで、御岩神社について次を確認した。

### Visitor identity

```text
official_name    = 御岩神社
official_address = 茨城県日立市入四間町752
```

Identity support:

- 御岩神社公式: `https://www.oiwajinja.jp/`
- 観光いばらき公式: `https://www.ibarakiguide.jp/spot.php?code=470&mode=detail`

いずれも参拝・観光対象として `入四間町752` を掲載する。
観光いばらき公式は同ページから御岩神社のGoogle Maps導線も掲載する。

### Adopted Visitor / Navigation Anchor

```text
latitude  = 36.63604985
longitude = 140.58558306
```

Primary position source:

```text
type = map_provider_poi
url  = https://www.mapion.co.jp/phonebook/M06005/08202/ILSP0061135259_ipclm/
```

Mapionの御岩神社POIページが地図centerとして上記緯度・経度を明示する。

Independent corroborationとして、既存監査で記録済みのOSM / Wikidata current shrine pointsは同一境内付近を示す。

```text
Mapion -> OSM       約39.1m
Mapion -> Wikidata  約38.0m
```

本距離は自動PASS閾値ではなく、同一Shrine周辺を指すcorroboration記録である。

### Conflicting address / old coordinate

法人情報では別用途の住所が存在する。

```text
legal entity source = gBizINFO / 法人番号公表サイト
legal address       = 茨城県日立市入四間町1217番地
url                 = https://info.gbiz.go.jp/hojin/ichiran?hojinBango=1050005007118
```

旧GeoShape candidate:

```text
address   = 入四間町1217
latitude  = 36.636842
longitude = 140.582930
```

Mapion visitor anchorとの差は約252.6m。

本Contractでは `1217` を「誤り」「旧住所」と断定しない。法人登記・歴史資料等の別用途addressである可能性を保持し、visitor-facing `752` と意味を分離する。

したがって旧GeoShape coordinateをVisitor / Navigation Anchorとして自動継承しない。

### Gate result

```text
POSITION_GATE = PASS
POSITION_STATUS = PASS
ADOPTED_COORDINATE = 36.63604985, 140.58558306
```

この決定はPosition ContractとSource採用の確定であり、Base Seed / Candidate Master / Production DBへのwriteを意味しない。Data writeは後続のW0-DB01 Data Build PRで別Gateとして実施する。

## Non-Goals

- 本ContractだけでProduction DBを書き換えない
- Base Seedをこの文書更新と同時に変更しない
- Candidate Masterを自動hydrationしない
- legal addressをvisitor addressへ書き換えない
- OSM / Wikidataを唯一のprimary sourceにしない
- coordinate distanceの固定PASS閾値を新設しない
- Recommendation / Ranking / Concierge / Compassのscoring logicを変更しない
