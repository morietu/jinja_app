# W0-DB01-G0 Pre-Build Unblock Gate

## Status

- Recorded at: `2026-09-12`
- 工程: `W0-DB01-G0`（Data Build 前の precondition 再評価）
- Data Build: **実施していない**

```text
POSITION_GATE (Gate A)        = HOLD_UNRESOLVED
BOOTSTRAP_INFRA (Gate B)      = PASS
REAL_W0_DB01_SEED_RETEST      = PENDING

W0_DB01_DATA_BUILD            = NOT_STARTED
```

**Gate A が PASS しないため、W0-DB01 Data Build は開始しない。**

### 未変更（本工程での write なし）

- `backend/temples/data/shrines_seed_clean.json`（SHA-256 `88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c` 不変）
- `backend/temples/data/knowledge_seeds/`
- Candidate Master の factual fields / status
- Production DB
- Recommendation / Concierge / Compass
- `goriyaku` / `goriyaku_tags` データ

## W0-DB01 member set

```text
三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 / 榴岡天満宮
```

5 社を維持する。別 Shrine への差替えは行っていない。

---

## Gate A: 御岩神社 Position HOLD resolution

### 結果

```text
POSITION_GATE = HOLD_UNRESOLVED
ADOPTED_COORDINATE = NONE（座標を選定していない）
```

### A-1. 現行 Coordinate / Position 採用 contract の所在

正本コードを検索した結果、**Position 採用 policy を実装する runtime code は存在しない**。

```text
grep -rl "GeoShape|geoshape|position_source" backend/ scripts/ packages/ apps/
  -> 0 件
```

採用 policy は **doc 上の人間 policy** としてのみ存在し、実際の座標採用は
個別 migration が静的定数として持つ。したがって「contract」は次の 2 つの
実装先例と 1 つの明文 policy から構成される。

#### 実装先例 1 — `temples.0099`（id 49 富岡八幡宮 / P8-C）

採用された座標の根拠（migration docstring より）:

```text
Google Place ChIJK11I4BGJGGAR5mZswigcu58 の place_of_worship geocode
  かつ 江東区 MUNICIPAL_OFFICIAL address 東京都江東区富岡1-20-3 のもの
  かつ duplicate shadow 行 id 104 が保持していた同一値
  かつ published Wikipedia coordinate から 6.6 m
```

すなわち **place_of_worship 型の primary geocode + 公式住所の一致 + 独立
corroboration** が揃って初めて採用されている。

#### 実装先例 2 — W0-B01 Source Packet Freeze の 4 社（PASS 事例）

`docs/audit/shrine-expansion-wave0-b01-source-freeze-bootstrap-gate.md`

| Shrine | position_source | 判定 |
|---|---|---|
| 三輪神社 | `mapfan.com` | PASS |
| 大鳥大社 | `kojiki.kokugakuin.ac.jp`（N34°32'12.4", E135°27'39.1"） | PASS |
| 烏森神社 | `geoshape.ex.nii.ac.jp`（GeoShape address が公式住所と整合） | PASS |
| 榴岡天満宮 | `geoshape.ex.nii.ac.jp` | PASS |
| 御岩神社 | — | **HOLD_POSITION_REVIEW** |

#### 明文 policy

同 doc より:

> Existing Position policy does not promote OSM/Wikidata corroboration alone
> to an adopted Production anchor when a prior adopted candidate conflicts
> with current authoritative identity evidence.

```text
POLICY: OSM / Wikidata の corroboration “のみ” では adopted Production anchor
        に昇格させない（特に、先行候補が現行の authoritative identity evidence
        と矛盾している場合）
```

本タスクの指示「OSM/Wikidata 単独採用禁止」とも一致する。

### A-2. official address の current source 再確認

**結果: `茨城県日立市入四間町752` を複数の独立 source で再確認した。**

Web search により、観光いばらき公式 / 日立市観光物産協会公式 / Wikipedia /
NAVITIME / じゃらん / Omairi などが一致して

```text
〒311-0402 茨城県日立市入四間町752
TEL 0294-21-8445
```

を掲載していることを確認した。W0-B01 Freeze 時点の記録（公式 = 752 /
観光いばらき = 752）と現在も一致しており、**address 側に drift はない**。

参照した検索結果:

- 観光いばらき公式 https://www.ibarakiguide.jp/spot.php?mode=detail&code=470
- 日立市観光物産協会公式 https://www.kankou-hitachi.jp/spot.php?mode=detail&c=28&code=115
- Wikipedia https://ja.wikipedia.org/wiki/御岩神社

### A-3. old GeoShape との乖離の再計算

W0-B01 Freeze が記録した値を用いて、haversine（地球半径 6371008.8 m）で
距離を**実際に再計算**した。

| 組 | 距離 |
|---|---|
| GeoShape(`1217`) `36.636842, 140.582930` vs OSM `36.63614, 140.58516` | **213.7 m** |
| GeoShape(`1217`) vs Wikidata `36.6362, 140.5852` | 214.8 m |
| Wikidata vs OSM | 7.6 m |

- 「約 214 m」という Freeze の記録は**再計算で確認できた**。
- 一方、Freeze が記した「Wikidata / OSM difference = 4m」は、同 doc が
  記録している座標値から計算すると **7.6 m** である。乖離の結論
  （両者はほぼ同一点を指す）は変わらないが、**数値としては不一致**である。
  本 doc はこの差異を訂正せず、point-in-time fact と実測値の両方を記録する。
- GeoShape 記録の address は `入四間町1217` であり、現行公式の `752` と
  **一致しない**。

### A-4. candidate current coordinate の取得

**取得できなかった。**

本実行環境の network egress policy により、Position 採用 policy が認める
primary source のすべてに到達できない。

```text
https://www.oiwajinja.jp/          -> EGRESS_BLOCKED（公式）
https://www.ibarakiguide.jp/       -> EGRESS_BLOCKED（観光いばらき公式）
https://www.kankou-hitachi.jp/     -> 到達不可
https://geoshape.ex.nii.ac.jp/     -> 到達不可
https://kojiki.kokugakuin.ac.jp/   -> 到達不可
https://mapfan.com/                -> 到達不可
https://ja.wikipedia.org/          -> 到達不可
```

Web search の snippet 経由では address は確認できたが、**座標は取得できて
いない**。またかりに snippet に座標が現れたとしても、それは primary source
の直接取得ではなく、A-1 の採用先例（place_of_worship geocode / 公式住所
一致 / 独立 corroboration）を満たす証拠にはならない。

### A-5. 採用可否の評価

```text
deterministic contract で一意に採用可能か = NO
```

理由:

1. 旧 GeoShape 点は address が `1217` で現行公式 `752` と矛盾する。
   A-1 の明文 policy により、矛盾する先行候補をそのまま採用できない。
2. OSM / Wikidata は互いに 7.6 m で一致するが、**単独採用禁止**であり、
   これらを補強する primary source を本環境では取得できない。
3. `temples.0099` 先例が要求する「place_of_worship geocode + 公式住所一致 +
   独立 corroboration」の 3 条件のうち、**満たせているのは公式住所 `752` の
   確認のみ**である。

したがって指示どおり **座標を選定せず STOP** し、Mother Ship Decision Packet
を作成する。

---

## Mother Ship Decision Packet — 御岩神社 Position

### 確定している事実

```text
official_address      = 茨城県日立市入四間町752   （現行 source で再確認済み）
address drift         = なし（W0-B01 Freeze 記録と一致）
old GeoShape address  = 茨城県日立市入四間町1217  （現行公式と不一致）
old GeoShape coord    = 36.636842, 140.582930
OSM (参考)            = 36.63614, 140.58516
Wikidata (参考)       = 36.6362, 140.5852
GeoShape vs OSM       = 213.7 m（実測再計算）
OSM vs Wikidata       = 7.6 m（実測再計算）
```

### 未確定

```text
adopted_coordinate    = 未選定
取得できていないもの  = policy が認める primary source からの現行座標
取得できない理由      = 本実行環境の network egress policy
```

### 決定が必要な事項

**D1. 座標 primary source の取得経路**

Codex 実行環境からは公式 / GeoShape / kokugakuin / mapfan のいずれにも
到達できない。次のいずれかが必要。

- (a) Mother Ship 側で primary source を直接確認し、座標と source URL を
  提供する（`temples.0099` 先例と同じ粒度: 座標 / source 種別 / 公式住所
  との一致 / 独立 corroboration の距離）
- (b) egress allowlist に当該ドメインを追加する
- (c) Position policy 自体を改訂し、採用可能な source 種別を再定義する

**D2. `1217` と `752` の関係**

旧 GeoShape record が指す `1217` が、
「同一神社の別表記 / 旧地番」なのか「別地点（例: 山中の別施設）」なのかが
未確定。前者なら旧座標は「粗い anchor」、後者なら「誤った anchor」であり、
扱いが変わる。

**D3. W0-DB01 の進め方**

- (a) 御岩神社の Position 確定まで W0-DB01 全体を保留
- (b) 御岩神社のみ後続 batch へ送り、残り 4 社で先に進む
  → **ただし本タスクの制約「5社維持のための別Shrine差替え禁止」および
     member set freeze（`test_wave0_db01_member_set_is_frozen`）に抵触する**
  ため、選ぶ場合は member set contract の改訂が前提
- (c) 座標なし（`latitude`/`longitude` = NULL）で Base Seed へ投入し、
  Position を後続工程で補う
  → 現行 Base Seed の contract test は全 103 行が数値座標を持つことを
     固定している（`test_seed_numeric_coordinates_are_usable_by_the_importer`）
     ため、これも contract 改訂が前提

本 audit はいずれも選択しない。

---

## Gate B: Fresh-bootstrap remediation current-state revalidation

### 結果

```text
BOOTSTRAP_INFRA = PASS
```

### B-1. current develop の bootstrap contract

`backend/temples/management/commands/bootstrap_production_data.py` の
`BOOTSTRAP_STEPS` は 3 段階である。

```text
1. import_shrines_seed --skip-goriyaku-tags   (step=import_shrines_seed_base)
2. backfill_goriyaku_tags --force
3. import_shrines_seed
```

`import_shrines_seed` は `--skip-goriyaku-tags` を実装済み
（`import_shrines_seed.py:99`）。PR #2785 相当の remediation が現行 develop
に入っていることを確認した。

### B-2. fresh isolated DB での実行

使い捨て DB（PostGIS 有効、`migrate` 完走）で実行。Production ではない。

初期状態:

```text
shrines=0  goriyaku_tags=0  m2m=0
```

| step | command 出力 | 実行後 |
|---|---|---|
| 1 | `goriyaku_tags rows=0 ... / done created=103 updated=0 skipped=0 total_seed=103` | `shrines=103 tags=0 m2m=0` |
| 2 | `total=98 updated=98 created_tags=39 added_links=280` | `shrines=103 tags=39 (id 1..39) m2m=280` |
| 3 | `goriyaku_tags rows=0 ... / done created=0 updated=0 skipped=103` | `shrines=103 tags=39 (id 1..39) m2m=280` |

```text
canonical GoriyakuTag = 39
tag id range          = 1..39（min=1 / max=39 / count=39）
```

step 1 が `CommandError` を出さずに完走しており、旧 audit が記録した
fail 経路（fresh DB で explicit tag が canonical master 不在に当たる）は
現行 contract では発生しない。

### B-3. second run idempotency

`bootstrap_production_data` を通しで再実行した。

```text
tags=39  ids_1_39=true  m2m=280  shrines=103
Shrine with visit_style_tags: 103
Shrine with goriyaku_tags: 98
```

**2 回目でも 39 / 1..39 / 280 が不変**であり idempotent。

### B-4. explicit activation が new tag を作らないこと

現行 Base Seed には `goriyaku_tags` key を持つ行が **0 / 103** 行しか無い
ため、step 3 の explicit activation 経路は実データでは 0 行しか通らない
（`goriyaku_tags rows=0`）。

そこで **実 Seed を変更せず**、一時 seed ファイル（repo 外）で当該経路を
実行した。

| ケース | 結果 | GoriyakuTag 件数 |
|---|---|---|
| canonical 39 に含まれる tag のみ（`厄除け` / `家内安全` / `商売繁盛`） | `goriyaku_tags rows=1 updated=1 added_links=2 removed_links=2` | 39 → **39**（新規作成 0） |
| canonical 外の tag（`存在しないご利益タグ`） | `CommandError: unknown goriyaku_tags outside canonical master: ['存在しないご利益タグ']` | **39**（変化なし / fail closed） |

**explicit activation は new tag を作らず、canonical 外は fail closed で拒否する。**

#### 付随して観測した挙動（W0-DB01 設計への影響）

canonical tag を explicit 指定したケースで `added_links=2 removed_links=2`
となり、対象 Shrine の M2M は explicit 指定値へ**置換**された。

```text
明治神宮 tags（explicit 指定後） = 厄除け / 商売繁盛 / 家内安全
```

すなわち seed の `goriyaku_tags` は additive ではなく **authoritative** で
あり、backfill 由来の link のうち list に無いものは削除される。W0-DB01 で
explicit tag を持つ行を投入する際は、この置換挙動を前提に safe subset を
決める必要がある。

### B-5. contract tests

```text
backend/temples/tests/test_bootstrap_goriyaku_master_exact39_contract.py
backend/temples/tests/test_import_shrines_seed_command.py
  25 passed
```

### B-6. 旧 audit の扱い

`docs/audit/shrine-expansion-wave0-b01-source-freeze-bootstrap-gate.md` の

```text
FRESH_BOOTSTRAP_COMPATIBILITY = FAIL
```

は **2026-09-10 時点の point-in-time fact** であり、本 audit では改変しない。
当時は `import_shrines_seed` に `--skip-goriyaku-tags` が存在せず、
bootstrap は 2 段階だった。現行 develop の 3 段階 contract における
再評価結果が本 doc の `BOOTSTRAP_INFRA = PASS` である。

### B-7. `REAL_W0_DB01_SEED_RETEST = PENDING`

B-4 の explicit activation 検証は**合成した一時 seed** に対するものであり、
W0-DB01 の実 Seed 行（三輪神社 / 大鳥大社 / 御岩神社 / 烏森神社 /
榴岡天満宮 の 5 行 + それぞれの safe canonical `goriyaku_tags`）では
実行していない。実 Seed が存在しないため実行できない。

```text
REAL_W0_DB01_SEED_RETEST = PENDING
```

W0-DB01 Base Seed が作成された時点で、同じ 3 段階 bootstrap を fresh DB
に対して再実行し、canonical 39 / explicit activation / idempotency を
再確認する必要がある。

---

## 実行した command / test の記録

```text
# Gate A
grep -rl "GeoShape|geoshape|position_source" backend/ scripts/ packages/ apps/   -> 0 件
haversine 再計算（python3, R=6371008.8 m）
  GeoShape vs OSM      = 213.7 m
  GeoShape vs Wikidata = 214.8 m
  Wikidata vs OSM      =   7.6 m
WebFetch oiwajinja.jp / ibarakiguide.jp -> EGRESS_BLOCKED
curl kankou-hitachi.jp / geoshape.ex.nii.ac.jp / kojiki.kokugakuin.ac.jp /
     mapfan.com / ja.wikipedia.org -> いずれも到達不可

# Gate B（使い捨て isolated DB / Production ではない）
manage.py migrate                                        -> 完走
manage.py import_shrines_seed --skip-goriyaku-tags       -> created=103
manage.py backfill_goriyaku_tags --force                 -> created_tags=39 added_links=280
manage.py import_shrines_seed                            -> skipped=103
manage.py bootstrap_production_data                      -> 2 回目も 39 / 1..39 / 280
manage.py import_shrines_seed --source <tmp canonical>   -> tags 39 -> 39
manage.py import_shrines_seed --source <tmp unknown>     -> CommandError（fail closed）

pytest test_bootstrap_goriyaku_master_exact39_contract.py
       test_import_shrines_seed_command.py                -> 25 passed
pytest test_shrine_expansion_candidate_master.py          -> 7 passed
python scripts/build_base_shrine_seed.py --check          -> BASE_SEED_BUILD=OK
                                                             SHA-256 88d9edb… 不変
```

## 結論

```text
Gate A (POSITION_GATE)   = HOLD_UNRESOLVED  -> Mother Ship Decision 待ち
Gate B (BOOTSTRAP_INFRA) = PASS
REAL_W0_DB01_SEED_RETEST = PENDING

W0-DB01 Data Build       = 開始しない（STOP）
```

Gate A が PASS しない限り W0-DB01 Data Build へ進まない。
