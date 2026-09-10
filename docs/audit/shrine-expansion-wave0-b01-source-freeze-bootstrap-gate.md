# Shrine Expansion Wave0 B01 Source Packet Freeze / Fresh Bootstrap Gate

## Status

- Recorded at: `2026-09-10`
- Batch: `W0-B01`
- Scope: 三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
- P0-A Candidate Master: merged
- P0-B safe `goriyaku_tags` importer: merged
- Source Packet Freeze: `PARTIAL_4_PASS_1_POSITION_HOLD`
- Fresh-bootstrap compatibility Gate: `FAIL`
- Data Build: `STOPPED_BEFORE_DATA_WRITE`
- Production DB write: なし
- Candidate Master write: なし
- `shrines_seed_clean.json` write: なし
- Knowledge Seed write: なし
- Recommendation / Ranking / Concierge / Compass runtime change: なし

## 目的

`docs/audit/shrine-expansion-wave0-data-build-plan.md` のW0-B01について、
Source Packetを現行Sourceで再確認した上で、P0-B後に最初のreal Base Seedへ
explicit `goriyaku_tags`を追加してもfresh Production bootstrap contractを維持できるか確認する。

本タスクはGateを通過しない場合にData Buildへ進まない。

## Governing Contract

W0-B01 Source Packet Freezeで最低限確認する値:

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

Source本文が過去Auditと不整合の場合、当該ShrineをHOLDへ戻す。

`goriyaku_tags`はPR #2768のNormalization AuditでPASS済みのsafe subsetだけを使い、
今回のcurrent-source再確認だけを理由にタグ集合を拡張しない。

## W0-B01 Packet Summary

| Shrine | Identity | Position | Knowledge Source | Goriyaku Evidence | Tag Mapping | Freeze |
|---|---|---|---|---|---|---|
| 三輪神社 | PASS | PASS | PASS | PASS | PASS | PASS |
| 大鳥大社 | PASS | PASS | PASS | PASS | PASS | PASS |
| 御岩神社 | PASS | HOLD_POSITION_REVIEW | PASS | PASS | PASS | HOLD |
| 烏森神社 | PASS | PASS | PASS | PASS | PASS | PASS |
| 榴岡天満宮 | PASS | PASS | PASS | PASS | PASS | PASS |

```text
SOURCE_PACKET_PASS = 4 / 5
SOURCE_PACKET_HOLD_POSITION = 1 / 5
SOURCE_PACKET_FREEZE = PARTIAL
```

## 1. 三輪神社

### Identity / Source

- official_name: `三輪神社`
- official_address: `愛知県名古屋市中区大須3-9-32`
- official_source_type: `shrine_official`
- official_source_url: `https://miwajinnjya.com/guide/miwa-yuisyo/`
- benefit_source_url: `https://miwajinnjya.com/guide/pray/`
- reverified_at: `2026-09-10`

### Position

- latitude: `35.1608797`
- longitude: `136.9054313`
- position_source: `https://mapfan.com/spots/SAYC%2CJ%2CBBZPY`
- result: `PASS`

### Deity Fact candidates

Official source explicitly names:

- `大物主神`
- `徳川義宜公`

Role is not inferred in this Freeze record beyond what the later Knowledge Review safely supports.

### History Fact candidate

- type candidate: `tradition`
- period_text candidate: `元亀年間（1570〜1572）`
- source-backed content boundary: 牧若狭守長清が大和三輪山に崇敬した大物主神を祀ったと伝えられていること。
- Do not promote the tradition wording to an unqualified historical founding fact.

### Recommendation Evidence

- reviewed source wording used for this batch: `厄除祈願`
- safe canonical `goriyaku_tags`: `厄除け`

Current official pages contain additional prayer purposes, but this Freeze does not expand beyond the safe subset already approved by the Wave0 normalization audit.

## 2. 大鳥大社

### Identity / Source

- official_name: `大鳥大社`
- official_address: `大阪府堺市西区鳳北町1-1-2`
- official_source_type: `shrine_official`
- official_source_url: `https://www.ootoritaisha.jp/taisha/`
- benefit_source_url: `https://www.ootoritaisha.jp/kitou/`
- reverified_at: `2026-09-10`

### Position

- latitude: `34.5367778`
- longitude: `135.4608611`
- position_source: `https://kojiki.kokugakuin.ac.jp/jinjya/otoritaisha/`
- source coordinate: N34°32'12.4", E135°27'39.1"
- result: `PASS`

### Deity Fact candidates

Official source explicitly names:

- `日本武尊`
- `大鳥連祖神`

### History Fact candidates

At minimum the official history supports separation of:

1. origin tradition concerning the white bird / 日本武尊 and the origin of worship at the site (`tradition` candidate)
2. 明治38年の雷火後、明治42年に現社殿が再建された沿革 (`historical_event` candidate)

The tradition and the documented later reconstruction must not be merged into one Fact.

### Recommendation Evidence

Reviewed Source meanings:

- 家内安全
- 厄除祈願
- 安産祈願
- 必勝祈願
- 合格祈願
- 商売繁盛

Safe canonical `goriyaku_tags`:

```text
家内安全
厄除け
安産
勝運
合格祈願
商売繁盛
```

## 3. 御岩神社

### Identity / Source

- official_name: `御岩神社`
- official_address: `茨城県日立市入四間町752`
- official_source_type: `shrine_official`
- official_source_url: `https://www.oiwajinja.jp/jinjasyoukai.html`
- benefit_source_url: `https://www.oiwajinja.jp/kitou.html`
- current official / official-tourism address reverified_at: `2026-09-10`

### Deity Fact candidates

The current official shrine introduction explicitly names the main shrine's following deities:

- `国常立尊`
- `大国主命`
- `伊邪那岐尊`
- `伊邪那美尊`

The same section states `他二十二柱`.
Unnamed deities are not expanded into invented Fact rows.
Separate subordinate shrines / 全山188柱 are not silently promoted to the main shrine's four explicitly named Fact candidates.

### History Fact candidates

The official source supports at least:

1. 創建時期は不明で、縄文晩期の祭祀遺跡や常陸国風土記の記述から古代信仰の聖地であったことが窺える、というscope-preserving history candidate
2. 江戸期に水戸藩の祈願所として位置づけられ、藩主代々の参拝が常例とされた沿革 candidate

Unknown founding date is preserved as unknown. No year is invented.

### Recommendation Evidence

Reviewed Source meanings retained from the existing Wave0 review:

- 安産祈願
- 家内安全
- 厄除開運
- 病気平癒
- 商売繁昌
- 良縁成就

Safe canonical `goriyaku_tags`:

```text
安産
家内安全
厄除け
開運
病気平癒
商売繁盛
縁結び
```

### Position discrepancy detected during Freeze

Past Wave0 coordinate availability used:

```text
GeoShape
address = 茨城県日立市入四間町1217番地
lat/lng = 36.636842, 140.582930
```

Current authoritative identity sources now re-confirm:

```text
御岩神社公式 = 茨城県日立市入四間町752
観光いばらき = 茨城県日立市入四間町752
Google Maps link from official-tourism page = query for 御岩神社 @ 日立市入四間町752
```

Independent current map corroboration:

```text
Wikidata = approx. 36.6362, 140.5852
OSM place_of_worship = approx. 36.63614, 140.58516
Wikidata / OSM difference = 4m
```

The old GeoShape point and current OSM shrine point differ by approximately 214m.
GeoShape's address is also `1217`, not the current official `752`.

Existing Position policy does not promote OSM/Wikidata corroboration alone to an adopted Production anchor when a prior adopted candidate conflicts with current authoritative identity evidence.

Result:

```text
POSITION = HOLD_POSITION_REVIEW
SOURCE_PACKET_FREEZE = HOLD
```

The old `36.636842, 140.582930` coordinate is not carried into W0-B01 Base Seed by this task.

## 4. 烏森神社

### Identity / Source

- official_name: `烏森神社`
- official_address: `東京都港区新橋2-15-5`
- official_source_type: `shrine_official`
- official_source_url: `https://karasumorijinja.or.jp/烏森神社について`
- benefit_source_url: same official shrine source / homepage
- reverified_at: `2026-09-10`

### Position

- latitude: `35.666443`
- longitude: `139.756134`
- position_source: `https://geoshape.ex.nii.ac.jp/nrct-poi/resource/13/130000118800.html`
- GeoShape address: `東京都港区新橋二丁目15番`
- current official address: `東京都港区新橋2-15-5`
- result: `PASS`

### Deity Fact candidates

Official source explicitly names:

- `倉稲魂命`
- `天鈿女命`
- `瓊々杵尊`

### History Fact candidate

- type candidate: `tradition`
- period_text candidate: `天慶3年（940）`
- source-backed content boundary: 藤原秀郷の戦勝祈願と白狐・白羽の矢をめぐる創始伝承。
- The origin narrative remains `tradition`; do not promote it to unqualified historical fact.

### Recommendation Evidence

Reviewed Source meanings:

- 商売繁盛
- 技芸上達
- 家内安全
- 必勝祈願の成就

Safe canonical `goriyaku_tags`:

```text
商売繁盛
技芸上達
家内安全
勝運
```

## 5. 榴岡天満宮

### Identity / Source

- official_name: `榴岡天満宮`
- official_address: `宮城県仙台市宮城野区榴ケ岡105-3`
- official_source_type: `shrine_official`
- official_source_url: `https://tsutsujigaokatenmangu.jp/about/`
- benefit_source_url: `https://tsutsujigaokatenmangu.jp/gosanpai/`
- reverified_at: `2026-09-10`

### Position

- latitude: `38.260624`
- longitude: `140.893021`
- position_source: `https://geoshape.ex.nii.ac.jp/nrct-poi/resource/04/040000096500.html`
- result: `PASS`

### Deity Fact candidate

Official source explicitly names:

- `菅原道真公（天満大自在天神）`

Canonical/display naming must follow the Knowledge Review contract when the actual seed is built; this Freeze does not infer an alternate canonical deity name.

### History Fact candidate

- type candidate: `historical_event`
- period_text candidate: `寛文7年（1667）`
- source-backed content boundary: 1667年7月25日、現在の鎮座地である榴ヶ岡へ遷座したこと。

The source also describes earlier origin/relocation history, but this packet can satisfy the minimum usable History path without inventing dates or collapsing separate events.

### Recommendation Evidence

Reviewed Source meanings:

- 合格成就
- 学業上達
- 厄祓い
- 安産祈願
- 交通安全
- 商売繁盛

Safe canonical `goriyaku_tags`:

```text
合格祈願
学業成就
厄除け
安産
交通安全
商売繁盛
```

## Fresh-bootstrap Compatibility Gate

### Current Production bootstrap order

The current `bootstrap_production_data` contract is:

```text
1. import_shrines_seed
2. backfill_goriyaku_tags --force
```

The exact-39 bootstrap test intentionally pins both this order and the resulting `GoriyakuTag` ids 1..39.

### P0-B explicit tag behavior

After P0-B, an `import_shrines_seed` row containing `goriyaku_tags` calls the explicit-tag resolver before the Shrine transaction is applied.

That resolver requires the database to already contain the exact canonical `GoriyakuTag` id range 1..39.

### Fresh DB execution path if W0-B01 real rows are added now

```text
fresh migrated DB
GoriyakuTag rows = 0
↓
bootstrap_production_data
↓
step 1: import_shrines_seed
↓
W0-B01 row contains goriyaku_tags
↓
canonical master ids 1..39 required
↓
actual master = empty
↓
CommandError
↓
step 2 backfill_goriyaku_tags --force is never reached
```

Therefore the proposed W0-B01 Base Seed shape from the Data Build Plan is incompatible with the current fresh-bootstrap order.

```text
FRESH_BOOTSTRAP_COMPATIBILITY = FAIL
```

This is an expected fail-closed boundary identified by P0-B, not a reason to bypass P0-B validation.

## Data Build Decision

The Data Build Plan requires Source Packet Freeze and the fresh-bootstrap compatibility Gate before writing the real Base Seed / Knowledge Seed.

Two blockers exist:

1. 御岩神社 Position is `HOLD_POSITION_REVIEW`
2. fresh-bootstrap compatibility Gate is `FAIL`

Therefore this task stops before any data write.

```text
Candidate Master hydration = NOT_EXECUTED
Base Seed W0-B01 rows = NOT_WRITTEN
Knowledge Seed wave0_batch_01 = NOT_CREATED
Isolated apply = NOT_EXECUTED
Production write = 0
W0-B01 DATA BUILD = STOPPED_BEFORE_DATA_WRITE
```

## Mother Ship Decision Inputs

Fresh-bootstrap remediation changes an existing Production bootstrap contract, so this audit does not select one automatically.

Possible implementation families for Mother Ship review:

### Option A: explicit canonical master bootstrap

Create/establish the exact canonical 39-row `GoriyakuTag` master before Base Shrine explicit M2M activation.

Implication: introduces a first-class source of truth for the 39-row master and changes bootstrap orchestration.

### Option B: two-pass Base/M2M activation

First import Base Shrine scalar rows without applying explicit M2M, create/verify the canonical master, then execute a second scoped explicit-tag activation pass.

Implication: changes bootstrap orchestration and requires a clearly testable second phase; must not silently skip unknown tags.

### Option C: separate tag-activation phase from Base Seed bootstrap

Keep fresh Base Shrine bootstrap independent from Wave0 explicit M2M activation, and activate reviewed tags only after canonical master readiness is established.

Implication: changes the Data Build Plan boundary and requires Candidate Master / Production closure to prove the activation phase occurred.

No option is selected in this audit.

## Required Follow-up Before W0-B01 Data Build

1. Mother Ship selects the fresh-bootstrap remediation contract.
2. Implement remediation in an isolated Foundation PR with exact-39 regression coverage.
3. Resolve 御岩神社 Position using an accepted Production anchor source under the existing Position policy, or explicitly revise that policy via Mother Ship decision.
4. Re-run Source Packet Freeze. Expected target: 5/5 PASS.
5. Re-run `test_bootstrap_goriyaku_master_exact39_contract.py` and P0-B explicit-tag tests.
6. Only then hydrate Candidate Master and create W0-B01 Base / Knowledge seed files.

## Non-Goals

- Do not guess 御岩神社 coordinates from name/address alone.
- Do not use the old GeoShape `1217` coordinate merely to preserve prior PASS status.
- Do not weaken the P0-B exact-39 guard.
- Do not remove `goriyaku_tags` from W0-B01 solely to make the Gate green without changing the Data Build contract.
- Do not automatically rewrite the Production bootstrap order.
- Do not create new `GoriyakuTag` rows from reviewed shrine wording.
- Do not treat this audit PR merge as Production Import permission.
