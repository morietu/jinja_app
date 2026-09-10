# Shrine Expansion Wave0 B01 Source Packet Freeze

## Status

- Status: `FROZEN_5_OF_5`
- Recorded at: `2026-09-10`
- Batch: `W0-B01`
- Scope: 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
- Source verified_at: `2026-09-10T09:52:00+00:00`
- Production DB write: なし
- Production Import authorization: 本書だけでは与えない

## Purpose

PR #2784で `PARTIAL_4_PASS_1_POSITION_HOLD` となったW0-B01 Source Packetを再確認し、5社すべてについてData Buildへ渡す採用値をFreezeする。

Fact Source、Recommendation Evidence Source、Position Sourceは責務を分離する。
Discovery SourceはFact採用根拠として使用しない。

## Frozen Matrix

| candidate_id | shrine | official_name | official_address | official source | adopted coordinate | position source | safe goriyaku_tags |
|---|---|---|---|---|---|---|---|
| wave0-001 | 三輪神社 | 三輪神社 | 愛知県名古屋市中区大須3-9-32 | `https://miwajinnjya.com/guide/miwa-yuisyo/` | `35.1608797, 136.9054313` | MapFan `https://mapfan.com/spots/SAYC%2CJ%2CBBZPY` | 厄除け |
| wave0-002 | 大鳥大社 | 大鳥大社 | 大阪府堺市西区鳳北町1-1-2 | `https://www.ootoritaisha.jp/taisha/` | `34.536778, 135.460861` | 國學院大學古典文化学事業 `https://kojiki.kokugakuin.ac.jp/jinjya/otoritaisha/` | 家内安全 / 厄除け / 安産 / 勝運 / 合格祈願 / 商売繁盛 |
| wave0-003 | 御岩神社 | 御岩神社 | 茨城県日立市入四間町752 | `https://www.oiwajinja.jp/jinjasyoukai.html` | `36.63614, 140.58516` | official/current-address identity + map-provider main shrine identity + OSM/Wikidata corroboration | 安産 / 家内安全 / 厄除け / 開運 / 病気平癒 / 商売繁盛 / 縁結び |
| wave0-005 | 烏森神社 | 烏森神社 | 東京都港区新橋2-15-5 | `https://karasumorijinja.or.jp/` | `35.666443, 139.756134` | GeoShape `https://geoshape.ex.nii.ac.jp/nrct-poi/resource/13/130000118800.html` | 商売繁盛 / 技芸上達 / 家内安全 / 勝運 |
| wave0-006 | 榴岡天満宮 | 榴岡天満宮 | 宮城県仙台市宮城野区榴ケ岡105-3 | `https://tsutsujigaokatenmangu.jp/about/` | `38.260624, 140.893021` | GeoShape `https://geoshape.ex.nii.ac.jp/nrct-poi/resource/04/040000096500.html` | 合格祈願 / 学業成就 / 厄除け / 安産 / 交通安全 / 商売繁盛 |

## Recommendation Evidence Sources

### 三輪神社

- Source: `https://miwajinnjya.com/guide/pray/`
- explicit evidence: 厄除祈願
- runtime normalization: `厄除け`

本BatchではSource-backed safe subsetのみ採用し、祈祷ページに存在する他の願意を今回の既存Normalization Audit結果へ追加しない。

### 大鳥大社

- Source: `https://www.ootoritaisha.jp/kitou/`
- explicit evidence used by prior normalization: 家内安全 / 厄除祈願 / 安産祈願 / 必勝祈願 / 合格祈願 / 商売繁盛
- runtime normalization:
  - 家内安全 -> 家内安全
  - 厄除祈願 -> 厄除け
  - 安産祈願 -> 安産
  - 必勝祈願 -> 勝運
  - 合格祈願 -> 合格祈願
  - 商売繁盛 -> 商売繁盛

### 御岩神社

- Source: `https://www.oiwajinja.jp/kitou.html`
- explicit evidence used by prior normalization: 安産祈願 / 家内安全 / 厄除開運 / 病気平癒 / 商売繁昌 / 良縁成就
- safe runtime subset: 安産 / 家内安全 / 厄除け / 開運 / 病気平癒 / 商売繁盛 / 縁結び

`厄除開運`はSource内で複合願意として明示され、既存Normalization Auditでsafe subset `厄除け / 開運` が承認済みであるため、その既存判断のみを再利用する。

### 烏森神社

- Source: `https://karasumorijinja.or.jp/`
- explicit 御神徳: 商売繁盛 / 技芸上達 / 家内安全 / 必勝祈願の成就
- runtime normalization: 商売繁盛 / 技芸上達 / 家内安全 / 勝運

### 榴岡天満宮

- Source: `https://tsutsujigaokatenmangu.jp/gosanpai/`
- explicit evidence used by prior normalization: 合格成就 / 学業上達 / 厄祓い / 安産祈願 / 交通安全 / 商売繁盛
- runtime normalization: 合格祈願 / 学業成就 / 厄除け / 安産 / 交通安全 / 商売繁盛

## Knowledge Fact Freeze

### 三輪神社

Deity Fact candidates:

1. 大物主神
2. 徳川義宜公

Source: `https://miwajinnjya.com/guide/miwa-yuisyo/`

History Fact:

- type: `tradition`
- title: `元亀年間の創祀伝承`
- period_text: `元亀年間（1570〜1572）`
- content boundary: 牧若狭守長清が、生まれ故郷の大和三輪山にちなみ大物主神を鎮め祀ったと公式が伝える内容。確定史実へ昇格しない。

### 大鳥大社

Deity Fact candidates:

1. 日本武尊
2. 大鳥連祖神

Source: `https://www.ootoritaisha.jp/taisha/`

History Facts:

1. `tradition` / `日本武尊の白鳥降臨を起源とする社伝`
   - 日本武尊の御霊が白鳥となって当地へ降り立ち、社を建て祀ったことを起源とする社伝。伝承性を維持する。
2. `historical_event` / `明治42年の現社殿再建`
   - 明治38年の雷火による焼失後、明治42年に従来形式により現社殿が再建されたとの公式沿革。

### 御岩神社

Deity Fact candidatesは御岩神社本体の個別セクションにnamed deityとして明示された4柱だけを採用する。

1. 国常立尊
2. 大国主命
3. 伊邪那岐尊
4. 伊邪那美尊

`他二十二柱`、全山総祭神188柱、境内社の祭神は本Batchの御岩神社Deity FactへSyntheticに展開しない。

Source: `https://www.oiwajinja.jp/jinjasyoukai.html`

History Facts:

1. `official_origin` / `創建時期不明とする御由緒`
   - 公式は創建時期を不明とし、常陸國風土記の記述や祭祀遺跡等から古代より信仰の聖地であったことが窺えるとしている。創建年を補完しない。
2. `regional_context` / `水戸藩の祈願所としての信仰史`
   - 江戸時代に水戸藩の祈願所として位置づけられ、藩主代々の参拝が常例とされたとの公式記述を保持する。

### 烏森神社

Deity Fact candidates:

1. 倉稲魂命
2. 天鈿女命
3. 瓊々杵尊

Source: `https://karasumorijinja.or.jp/`

History Fact:

- type: `tradition`
- title: `天慶3年の創始伝承`
- period_text: `天慶3年（940）`
- content boundary: 藤原秀郷が戦勝祈願を行った際の白狐・白羽の矢にまつわる創始伝承。伝承として保持する。

### 榴岡天満宮

Deity Fact candidate:

1. 菅原道真公

Source: `https://tsutsujigaokatenmangu.jp/about/`

History Facts:

1. `founding` / `天延2年の創建由緒`
   - 公式は天延2年（974）に山城国で創建されたとする。
2. `historical_event` / `寛文7年の榴ヶ岡遷座`
   - 寛文7年（1667）7月25日、伊達綱宗公の意思により現在の鎮座地である榴ヶ岡へ遷座したとの公式沿革。

## 御岩神社 Position Closure

PR #2784のHOLD原因は、現行公式住所 `日立市入四間町752` と旧GeoShape historical-place record `入四間町1217 / 36.636842, 140.582930` が一致しなかったこと。

再QAでは以下を確認した。

1. 御岩神社公式が `茨城県日立市入四間町752` を現在住所として明示
2. 日立市および茨城県公式観光も同じ752住所でidentityをcorroborate
3. map-provider上でも752住所の御岩神社本体を独立entityとして識別可能
4. OSM/Wikidata系の同一御岩神社pointは `36.63614, 140.58516` 付近で一致
5. 旧GeoShape 1217 pointは現在の神社anchorとして採用しない

Mother Ship adoption:

```text
latitude = 36.63614
longitude = 140.58516
status = PASS_ANCHOR_AFTER_REVIEW
```

この採用は「OSMだから採用」ではなく、Authoritative current-address identityを先に固定し、map-provider main-shrine identityとgeospatial corroborationを重ねた結果である。

## Candidate Master Hydration Contract for W0-B01

Data Buildでは5社について以下をCandidate Masterへ書き込む。

```text
identity_status = CONFIRMED
official_source_status = CONFIRMED
official_name
official_address
official_source_type = shrine_official
official_source_url
verified_at = 2026-09-10T09:52:00+00:00
latitude
longitude
goriyaku
goriyaku_tags
```

`candidate_status` はData PR時点では `BUILD_READY` のまま維持する。
Production write前に `IMPORTED` へ進めない。

## Base Seed Contract for W0-B01

`Shrine.goriyaku`はsafe canonical subsetを `・` で連結する。

```text
三輪神社 = 厄除け
大鳥大社 = 家内安全・厄除け・安産・勝運・合格祈願・商売繁盛
御岩神社 = 安産・家内安全・厄除け・開運・病気平癒・商売繁盛・縁結び
烏森神社 = 商売繁盛・技芸上達・家内安全・勝運
榴岡天満宮 = 合格祈願・学業成就・厄除け・安産・交通安全・商売繁盛
```

`goriyaku_tags`も同一canonical subsetをlistとして明示する。

## Exit Decision

```text
SOURCE_PACKET_FREEZE = PASS_5_OF_5
POSITION_HOLD = 0
DATA_BUILD_INPUT_READY = YES
```

fresh-bootstrapのtwo-pass remediationは別Foundation PRで管理し、本Data Buildではそのmerge後の契約を前提にfresh-bootstrap exact39 regressionを必須とする。
