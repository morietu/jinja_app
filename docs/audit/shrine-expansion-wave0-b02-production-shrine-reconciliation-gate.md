# Shrine Expansion Wave0 B02 Production Shrine Reconciliation Gate

## Status

- Recorded at: `2026-09-10`
- Batch: `W0-B02`
- Scope: Base Shrine Seed と Production Shrine 母集団の read-only identity 突合
- Gate: `scripts/reconcile_production_shrine_identity.py`
- Production query: `scripts/migration_safety/sql/shrine_identity_reconciliation.sql`（SELECT-only）
- Contract test: `scripts/tests/test_reconcile_production_shrine_identity.py`（18 test）
- Base Seed write: なし（SHA-256 `88d9edb…` 変化なし）
- Production DB write: なし
- identity normalization: なし
- **Production 実測: `NOT_EXECUTED`**
- `STATUS`: `NOT_MEASURED_AGAINST_PRODUCTION`

## 目的

W0-B01で固定したBase Shrine Seedと現在のProduction Shrine母集団を、
read-onlyでexact `(name_jp, address)` 単位に完全突合する。

## 契約

- Base Seed = `backend/temples/data/shrines_seed_clean.json`
- Base Seedのidentity = exact `(name_jp, address)`
- Base Seedを変更しない
- Production DBを変更しない
- identity normalizationを行わない（NFKC・trim・全角半角変換・括弧変換・
  住所表記変換をいずれも適用しない）
- 類似候補はREVIEW候補として別表示するのみで、自動的にMATCH扱いしない
- 差分がある場合は `STATUS=FAIL` として差分一覧を出し、修正せずSTOPする

## Production側の取得経路

ambient credential lookupは行わない。経路を明示的に選ぶ。

### 1. Production向けの正式経路（`--production-snapshot`）

`scripts/migration_safety/` の既存read-only契約に従う。credentialはrepo外の
ファイルに置き、値がAIセッションやargv・ログへ現れない。

```bash
scripts/migration_safety/readonly_query.sh \
  ~/.config/kami-musubi/production-db.env DATABASE_URL \
  scripts/migration_safety/sql/shrine_identity_reconciliation.sql \
  > /path/outside/repo/production-shrine-snapshot.txt

python scripts/reconcile_production_shrine_identity.py \
  --production-snapshot /path/outside/repo/production-shrine-snapshot.txt
```

### 2. local / CI経路（`--from-db`）

```bash
DJANGO_SETTINGS_MODULE=shrine_project.settings PYTHONPATH=backend \
python scripts/reconcile_production_shrine_identity.py --from-db
```

Django ORMの `.values()` によるSELECTのみ。writeを行わない。

### SQLのscope

`kind` による絞り込みを行わない。`temples_shrine` table全体を
「Production Shrine母集団」として扱う。`temple` kindの行が存在する場合は
`PROD_ONLY` として表面化し、Gateが黙って隠さない（fail-closed）。

## Production 実測が未実行である理由

本セッションのremote containerにProduction credentialが存在しない。

```text
scripts/migration_safety/check_credential_presence.sh \
  ~/.config/kami-musubi/production-db.env DATABASE_URL
=> VAR_SET=0
```

`scripts/migration_safety/README.md` が定める契約どおり、この tooling は
Production へ自動接続しない。credential は利用者のマシン上にのみ存在し、
実行の可否は毎回人間が決める。したがって W0-B02 の Production 実測は
**利用者自身の環境で上記コマンドを実行することでのみ成立する**。

過去資料にある Production = 105 件という数値は期待値として固定していない。
Gate は件数を一切ハードコードせず、渡された Production snapshot を実測して
判定する。

## Local verification（Productionではない）

使い捨てローカルDB（`w0b02_local`）に `import_shrines_seed` でBase Seedを
投入し、Gateを両経路で実行した。

### PASS 経路

```text
BASE_SEED_TOTAL=103
PRODUCTION_TOTAL=103
MATCH=103
PROD_ONLY=0
SEED_ONLY=0
PRODUCTION_DUPLICATE_IDENTITY=0
STATUS=PASS
exit code = 0
```

`--from-db` と `--production-snapshot` の両経路が同一結果を返すことを確認した。

### FAIL 経路

使い捨てローカルDBへ意図的に4種の乖離を投入した。

```text
BASE_SEED_TOTAL=103
PRODUCTION_TOTAL=105
MATCH=102
PROD_ONLY=2
SEED_ONLY=1
PRODUCTION_DUPLICATE_IDENTITY=1
STATUS=FAIL
exit code = 1

PROD_ONLY:
  db_id=104 kind='shrine' name_jp='検証専用神社'    address='東京都検証区1-1'
  db_id=105 kind='shrine' name_jp='伊勢神宮(内宮)'  address='三重県伊勢市宇治館町1'
SEED_ONLY:
  db_id=None name_jp='波上宮' address='沖縄県那覇市若狭1-25-11'
PRODUCTION_DUPLICATE_IDENTITY:
  count=2 db_ids=[1, 106] name_jp='明治神宮' address='東京都渋谷区代々木神園町1-1'
REVIEW_CANDIDATES:
  [PROD_ONLY] db_id=105 name_jp='伊勢神宮(内宮)' address='三重県伊勢市宇治館町1'
    -> score=1.0 name_jp='伊勢神宮（内宮）' address='三重県伊勢市宇治館町1'
```

半角括弧の `伊勢神宮(内宮)` は score 1.0 の類似候補として表示されるが、
`MATCH` にはならず `PROD_ONLY` のまま残る。normalizationを行わない契約と、
類似を自動MATCHしない契約の双方が実際に効いていることを示す。

### REVIEW候補の比較範囲

REVIEW候補は差分行同士ではなく、**相手側の母集団全体**と比較する。
Base Seedに完全一致行が別途存在するProduction側の近似重複は、
差分行同士の比較だけでは表面化しないため。

## 付随して検出した既存不具合（本タスクでは修正しない）

`scripts/migration_safety/check_credential_presence.sh:40` と
`scripts/migration_safety/readonly_query.sh:53` の permission 判定は、
Linux（GNU coreutils）上で常に失敗する。

```bash
PERMS="$(stat -f '%OLp' "${CRED_FILE}" 2>/dev/null || stat -c '%a' "${CRED_FILE}" 2>/dev/null)"
```

GNU `stat` の `-f` は「filesystem status」であり、`%OLp` を解釈できない。
実測では filesystem 情報を **stdout へ出力したうえで非ゼロ終了する**ため、
`||` の fallback も走り、両方の出力が連結された値が `PERMS` に入る。
結果として `600` のファイルでも `BLOCKED: file permissions are ... 600,
expected 600` となり、Production向けの正式経路がLinux上で通らない。

macOS（BSD `stat`）では `-f '%OLp'` が期待どおり permission を返すため、
この不具合は表面化しない。

W0-B02のscope外であり、credential取り扱いに関わるscriptで独自のtest
suiteを持つため、本タスクでは修正しない。

## Validation出力の定義

```text
BASE_SEED_TOTAL              Base Seedの行数
PRODUCTION_TOTAL             Production Shrineの行数
MATCH                        両側に存在するexact identityの数（行数ではない）
PROD_ONLY                    Productionにあり Base Seedにない行数
SEED_ONLY                    Base Seedにあり Productionにない行数
PRODUCTION_DUPLICATE_IDENTITY  Production側で重複しているidentityの数
STATUS                       PASS / FAIL
```

PASS条件:

```text
PROD_ONLY = 0
SEED_ONLY = 0
PRODUCTION_DUPLICATE_IDENTITY = 0
```

補助出力として `BASE_SEED_DUPLICATE_IDENTITY` と `REVIEW_CANDIDATES` を出す。

audit reportは既定で `logs/shrine_identity_reconciliation.json` へ保存する
（`--report` で変更可能）。

## Non-Goals

- Base Seedの変更
- Production DBの変更
- identity normalizationの適用
- 類似候補の自動MATCH
- 差分の自動修正（差分検出時はSTOPする）
- `scripts/migration_safety/` 既存scriptの修正
