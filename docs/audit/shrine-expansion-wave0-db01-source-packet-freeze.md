# W0-DB01 Source Packet Freeze

## Status

- Recorded at: `2026-09-12`
- Batch: `W0-DB01`
- Scope: 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
- Source Packet Freeze: `PASS`
- Identity: `PASS 5/5`
- Position: `PASS 5/5`
- Knowledge Source: `PASS 5/5`
- Goriyaku Evidence: `PASS 5/5`
- Tag Mapping: `PASS 5/5`
- Data Build write: **未実施**
- Production DB write: **なし**

```text
SOURCE_PACKET_IDENTITY    = PASS 5/5
SOURCE_PACKET_POSITION    = PASS 5/5
SOURCE_PACKET_KNOWLEDGE   = PASS 5/5
SOURCE_PACKET_GORIYAKU    = PASS 5/5
SOURCE_PACKET_TAG_MAPPING = PASS 5/5
SOURCE_PACKET_FREEZE      = PASS
REVERIFIED_AT             = 2026-09-12
```

## 目的

`docs/audit/shrine-expansion-wave0-data-build-plan.md` の Phase 1 `Source Packet Freeze` を、W0-DB01 の5社について current Source で再確認し、後続の Candidate Master hydration / Base Seed / Knowledge Seed Build に入る前提を固定する。

本監査では実データを書き込まない。

## Governing Contract

各 Shrine について最低限、以下を current Source で説明可能にする。

```text
official_name
official_address
official_source_type
official_source_url
verified_at
latitude
longitude
approved goriyaku wording
safe canonical goriyaku_tags
Deity source-backed facts
History source-backed facts
```

追加の祈願項目や意味が current Source に存在しても、本 Freeze だけを理由に `goriyaku_tags` を拡張しない。Wave0 Normalization Audit で既に承認済みの safe subset を維持する。

## Historical Auditとの関係

`docs/audit/shrine-expansion-wave0-b01-source-freeze-bootstrap-gate.md` は 2026-09-10 時点の point-in-time audit として保持する。

当時の状態:

```text
Source Packet Freeze = PARTIAL_4_PASS_1_POSITION_HOLD
御岩神社 Position   = HOLD_POSITION_REVIEW
Fresh Bootstrap     = FAIL
```

その後、PR #2796 で次を別工程として解決済み。

- `docs/knowledge/shrine-position-contract.md` を正本化
- 御岩神社 Visitor / Navigation Anchor を確定
- `POSITION_GATE = PASS`
- Fresh bootstrap infra を3-stepへ再検証し `BOOTSTRAP_INFRA = PASS`

本監査は historical audit を改変せず、現在の Source Packet 状態を新しい audit として記録する。

---

## 1. 三輪神社

### Identity / Source

```text
official_name        = 三輪神社
official_address     = 愛知県名古屋市中区大須3-9-32
official_source_type = shrine_official
official_source_url  = https://miwajinnjya.com/guide/miwa-yuisyo/
benefit_source_url   = https://miwajinnjya.com/guide/pray/
verified_at          = 2026-09-12
```

Current official sourceで由緒・所在地を再確認。

### Position

```text
latitude            = 35.1608797
longitude           = 136.9054313
position_source_url = https://mapfan.com/spots/SAYC%2CJ%2CBBZPY
position_status     = PASS
```

### Knowledge Fact candidates

Deity:

- 大物主神
- 徳川義宜公

History:

- type candidate: `tradition`
- period_text candidate: `元亀年間（1570〜1572）`
- 牧若狭守長清が大和三輪山に崇敬した大物主神を祀ったと伝えられている、という tradition boundary を保持する

### Recommendation Evidence

```text
approved goriyaku wording = 厄除祈願
safe canonical goriyaku_tags = ["厄除け"]
```

Current official sourceに他の祈願項目が存在しても、本 Freeze では safe subset を拡張しない。

Result: `PASS`

---

## 2. 大鳥大社

### Identity / Source

```text
official_name        = 大鳥大社
official_address     = 大阪府堺市西区鳳北町1-1-2
official_source_type = shrine_official
official_source_url  = https://www.ootoritaisha.jp/taisha/
benefit_source_url   = https://www.ootoritaisha.jp/kitou/
verified_at          = 2026-09-12
```

### Position

```text
latitude            = 34.5367778
longitude           = 135.4608611
position_source_url = https://kojiki.kokugakuin.ac.jp/jinjya/otoritaisha/
source_coordinate   = N34°32'12.4", E135°27'39.1"
position_status     = PASS
```

### Knowledge Fact candidates

Deity:

- 日本武尊
- 大鳥連祖神

History:

- 白鳥 / 日本武尊に関する origin tradition
- 明治38年の雷火後、明治42年に現社殿が再建された historical event

tradition と documented reconstruction を1 Factへ混在させない。

### Recommendation Evidence

```text
approved goriyaku wording:
- 家内安全
- 厄除祈願
- 安産祈願
- 必勝祈願
- 合格祈願
- 商売繁盛

safe canonical goriyaku_tags:
- 家内安全
- 厄除け
- 安産
- 勝運
- 合格祈願
- 商売繁盛
```

Result: `PASS`

---

## 3. 御岩神社

### Identity / Source

```text
official_name        = 御岩神社
official_address     = 茨城県日立市入四間町752
official_source_type = shrine_official
official_source_url  = https://www.oiwajinja.jp/jinjasyoukai.html
benefit_source_url   = https://www.oiwajinja.jp/kitou.html
verified_at          = 2026-09-12
```

Current official / official-tourism identityは `入四間町752` で整合。

### Position

`docs/knowledge/shrine-position-contract.md` および
`docs/audit/shrine-expansion-wave0-db01-g1-visitor-position-anchor.md` で確定済み。

```text
latitude             = 36.63604985
longitude            = 140.58558306
position_source_type = map_provider_poi
position_source_url  = https://www.mapion.co.jp/phonebook/M06005/08202/ILSP0061135259_ipclm/
position_status      = PASS
```

`入四間町1217番地` は legal entity / registered-office address として別用途で観測されており、visitor-facing address `752` と混同しない。

### Knowledge Fact candidates

Deity:

- 国常立尊
- 大国主命
- 伊邪那岐尊
- 伊邪那美尊

Official sourceの `他二十二柱` を unnamed Fact として展開しない。

History:

- 創建時期は不明。縄文晩期の祭祀遺跡や常陸国風土記の記述から、古代信仰の聖地であったことが窺える、という scope-preserving candidate
- 江戸期に水戸藩の祈願所として位置づけられ、藩主代々の参拝が常例とされた沿革 candidate

unknown founding dateを推測で補完しない。

### Recommendation Evidence

```text
approved goriyaku wording:
- 安産祈願
- 家内安全
- 厄除開運
- 病気平癒
- 商売繁昌
- 良縁成就

safe canonical goriyaku_tags:
- 安産
- 家内安全
- 厄除け
- 開運
- 病気平癒
- 商売繁盛
- 縁結び
```

Result: `PASS`

---

## 4. 烏森神社

### Identity / Source

```text
official_name        = 烏森神社
official_address     = 東京都港区新橋2-15-5
official_source_type = shrine_official
official_source_url  = https://karasumorijinja.or.jp/烏森神社について
benefit_source_url   = https://karasumorijinja.or.jp/
verified_at          = 2026-09-12
```

### Position

```text
latitude            = 35.666443
longitude           = 139.756134
position_source_url = https://geoshape.ex.nii.ac.jp/nrct-poi/resource/13/130000118800.html
position_status     = PASS
```

GeoShape address `東京都港区新橋二丁目15番` とcurrent official addressは同一visitor identityとして説明可能。

### Knowledge Fact candidates

Deity:

- 倉稲魂命
- 天鈿女命
- 瓊々杵尊

History:

- type candidate: `tradition`
- period_text candidate: `天慶3年（940）`
- 藤原秀郷の戦勝祈願と白狐・白羽の矢をめぐる創始伝承

### Recommendation Evidence

```text
approved goriyaku wording:
- 商売繁盛
- 技芸上達
- 家内安全
- 必勝祈願の成就

safe canonical goriyaku_tags:
- 商売繁盛
- 技芸上達
- 家内安全
- 勝運
```

Result: `PASS`

---

## 5. 榴岡天満宮

### Identity / Source

```text
official_name        = 榴岡天満宮
official_address     = 宮城県仙台市宮城野区榴ケ岡105-3
official_source_type = shrine_official
official_source_url  = https://tsutsujigaokatenmangu.jp/about/
benefit_source_url   = https://tsutsujigaokatenmangu.jp/gosanpai/
verified_at          = 2026-09-12
```

### Position

```text
latitude            = 38.260624
longitude           = 140.893021
position_source_url = https://geoshape.ex.nii.ac.jp/nrct-poi/resource/04/040000096500.html
position_status     = PASS
```

### Knowledge Fact candidates

Deity:

- 菅原道真公（天満大自在天神）

History:

- type candidate: `historical_event`
- period_text candidate: `寛文7年（1667）`
- 1667年7月25日、現在の鎮座地である榴ヶ岡へ遷座したこと

### Recommendation Evidence

```text
approved goriyaku wording:
- 合格成就
- 学業上達
- 厄祓い
- 安産祈願
- 交通安全
- 商売繁盛

safe canonical goriyaku_tags:
- 合格祈願
- 学業成就
- 厄除け
- 安産
- 交通安全
- 商売繁盛
```

Result: `PASS`

---

## Freeze Result

```text
三輪神社   = PASS
大鳥大社   = PASS
御岩神社   = PASS
烏森神社   = PASS
榴岡天満宮 = PASS

SOURCE_PACKET_PASS = 5 / 5
SOURCE_PACKET_FREEZE = PASS
```

## Explicit boundaries for next phase

本 Freeze が許可するのは Phase 2 `Candidate Master Update` への移行まで。

まだ以下は実施しない。

- `shrines_seed_clean.json` への5社追加
- `wave0_batch_01_seed.json` 作成
- Production DB write
- Candidate statusを `IMPORTED` / `CORE_READY` へ進めること
- Recommendation / Ranking / Concierge / Compass runtime変更
- `GoriyakuTag` master 39変更

`goriyaku_tags` は後続Data Buildで authoritative exact-set として扱われるため、Base Seed write前に各Shrineの
`BACKFILL_SET / APPROVED_EXPLICIT_SET / ADD_SET / REMOVE_SET` を監査し、説明不能なREMOVEが1件でもあればSTOPする。

## Next Gate

```text
NEXT = Phase 2 Candidate Master hydration
```

対象はW0-DB01の5社のみ。
