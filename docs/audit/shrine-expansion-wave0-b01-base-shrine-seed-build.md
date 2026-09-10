# Shrine Expansion Wave0 B01 Base Shrine Seed Build

## Status

- Recorded at: `2026-09-10`
- Batch: `W0-B01`
- Scope: 現行Base Shrine集合103社の再現可能build
- Builder: `scripts/build_base_shrine_seed.py`
- Contract test: `backend/temples/tests/test_base_shrine_seed_build_contract.py`
- Base Seed schema change: なし（`id` / `prefecture` 追加なし）
- Shrine identity mutation: `0`
- Shrine row order change: なし
- Production DB write: なし
- Candidate Master write: なし
- Knowledge Seed write: なし
- Knowledge / GoriyakuTag / Recommendation / `visit_style_tags` 意味内容の変更: なし
- `BASE_SEED_BUILD`: `OK`

## 目的

現在のShrine母集団から、同一入力・同一コードで毎回bit単位で同一の
Base Shrine Seedを生成できる状態を確立する。

W0-B01のゴールはschema拡張ではなく、**現在の103社とProduction上のidentityを
維持したまま、同一入力から同一のBase Shrine Seedを毎回生成できること**である。

## 決定事項

### `id` をBase Seedへ追加しない

現行Productionと同じく `(name_jp, address)` をShrine identityとして扱う。
`import_shrines_seed` は当該pairで既存Shrineを引き、Knowledge Seedの
`shrine_ref` も同じpairで解決するため、Seed側に別系統のidentity keyを
新設しない。

### `prefecture` をBase Seedへ追加しない

`Shrine` modelに `prefecture` fieldは存在しない。Geographic Coverage等で
必要な場合はaddressからのderived valueとして算出し、Base Seedの
必須fieldにはしない。builderはvalidation目的でのみ導出し、Seedへは
書き出さない。

### identityを変更する正規化を禁止

現行Seedに対しNFKC正規化を適用した場合の実測影響:

```text
NFKC changes name_jp = 7 rows
  伊勢神宮（内宮） / 氷川神社（大宮） / 諏訪大社（上社本宮）
  神田神社（神田明神） / 賀茂御祖神社（下鴨神社）
  賀茂別雷神社（上賀茂神社） / 住吉神社（博多）
NFKC changes address  = 2 rows
  長太稲荷神社 / 給田六所神社（Google Maps形式address）
```

合計9件のidentityが変化する。`import_shrines_seed` は
`(name_jp, address)` でlookupするため、この9件はUPDATEではなく
CREATEとなり、Production DBへ重複Shrine行を作る。同時に
Knowledge Seedの `shrine_ref` 解決も `NOT_FOUND` へ倒れる。

したがってNFKC・全角半角変換・括弧変換・住所表記変換をいずれも行わない。
`name_jp` / `address` の永続値は変更しない。trimはvalidation用途の検査
（前後空白の検出）に限定し、値の書き換えには使わない。

Google Maps形式address 2件の `日本、〒...` 前置部は、prefecture導出時に
のみ読み飛ばす。addressそのものは書き換えない。

### Shrine行の順序を維持

入力の並び順をそのまま維持し、sortしない。

### JSON serializationとkey順のみを固定

現行Seedは同一の9keyを持ちながら、`visit_style_tags` / `location` の
順序だけが2通りに割れていた。これを1通りへ統一する。

```text
before: ('...', 'astro_elements', 'location', 'visit_style_tags')  = 72 rows
        ('...', 'astro_elements', 'visit_style_tags', 'location')  = 31 rows
after : ('...', 'astro_elements', 'visit_style_tags', 'location')  = 103 rows
```

serializationは `ensure_ascii=False` / `indent=2` /
`separators=(",", ": ")` / 末尾改行ありに固定する。

## Build I/O

```text
入力元（1ファイル固定） = backend/temples/data/shrines_seed_clean.json
出力                    = backend/temples/data/shrines_seed_clean.json
```

Base Seed自身がcanonical sourceであり、builderはその正準形を再生成する。

## Validation

```text
TOTAL=103
DUPLICATE_IDENTITY=0
DUPLICATE_ID=0
MISSING_REQUIRED=0
PREFECTURES=30
SHA256=88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c
IDENTITY_MUTATION=0
SCHEMA_UNEXPECTED_CHANGE=0
PREFECTURE_UNRESOLVED=0
ID_FIELD_ROWS=0
```

`DUPLICATE_ID` は `id` がBase Seedのfieldでないため `ID_FIELD_ROWS=0` の
状態で `0` である。`id` keyを持つ行が現れた場合はbuilderが重複検証を行う。

`MISSING_REQUIRED` の必須fieldは、W0-B01の決定により
`name_jp` / `address` である。

### 都道府県内訳（derived value / Seed未書き込み）

```text
東京都=30  埼玉県=9  神奈川県=9  京都府=7  茨城県=6
千葉県=5   栃木県=5  福岡県=4    群馬県=4  三重県=2
大阪府=2   石川県=2
兵庫県 / 北海道 / 大分県 / 奈良県 / 宮崎県 / 富山県 / 山口県 /
岡山県 / 島根県 / 広島県 / 愛知県 / 新潟県 / 沖縄県 / 滋賀県 /
熊本県 / 長野県 / 静岡県 / 香川県 = 各1
```

## 初回buildの差分

初回buildによる `shrines_seed_clean.json` の差分は、key順統一のみである。

```text
row count            : 103 -> 103
row order            : 保持
value-level equality : 完全一致（JSON object比較でbuild前後が等価）
identity mutation    : 0
schema change        : 0
```

## 再現性の確認

```text
1st build SHA256 = 88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c
2nd build SHA256 = 88d9edbfee67a239a09c4eb3a37febce64f0a457b49e1f3e427be2e8f83fb07c
2nd build WRITTEN = 0
2nd build git diff = 0
--check exit code  = 0
```

`--check` は書き込みを行わず、commit済みSeedとbuilder出力の差分だけを検証する。

## Test

`backend/temples/tests/test_base_shrine_seed_build_contract.py`（9 test）が
以下を固定する。

- commit済みSeedとbuilder出力がbyte単位で一致すること
- 同一入力から2回buildしてSHA-256が一致すること
- 全行がcanonical key順であること（`location` object内を含む）
- buildが `(name_jp, address)` を変化させないこと
- validation gateが全て通ること
- Base Seedが `id` / `prefecture` fieldを持たないこと
- 全行でprefectureが導出可能であること

件数・Batch17 identity・`visit_style_tags` の意味内容は既存の
`test_shrine_base_batch17_seed.py` /
`test_visit_style_legacy_drift_seed_contract.py` が正本であり、重複させない。

## Non-Goals

- Base Seedへの `id` / `prefecture` 追加
- identityを変更する正規化の適用
- Shrine行のsort
- Knowledge / GoriyakuTag / Recommendation / `visit_style_tags` の意味内容変更
- Production DBへのimport実行
