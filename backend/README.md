# Backend（Django / DRF）

AI参拝ナビのバックエンド実装です。

---

## 技術スタック

- Django 5 + DRF
- PostgreSQL + PostGIS
- JWT（SimpleJWT）
- 画像アップロード（S3 予定）

---

## 役割

- 神社 / 御朱印 / お気に入り API
- AI参拝ナビ（Concierge）
- ルート計算・位置検索
- 認証・ユーザー管理

---

## 開発・設計ドキュメント

詳細設計・運用ルールは **docs/** 配下に集約しています。

- アーキテクチャ / 認証    → `docs/10_arch_auth_proxy.md`
- API 全体概要    → `docs/30_api_overview.md`
- ローカル疎通確認    → `docs/20_smoke_checks.md`
- インフラ / デプロイ    → `docs/40_infra_deploy.md`
- ロードマップ    → `docs/90_roadmap.md`

---

## ローカル起動（最短）

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

---

# Billing: 運用契約（Single Source of Truth）

## 目的

フロント/バック/決済プロバイダ間で「課金状態の真実」を1箇所に固定し、仕様ブレを防ぐ。

## 真実（Source of Truth）

- `BILLING_PROVIDER=stub` のとき：**環境変数が真実**
    - `BILLING_STUB_PLAN` = `free` | `premium`
    - `BILLING_STUB_ACTIVE` = `0/1`（truthy文字列も可）
- `BILLING_PROVIDER=stripe` のとき：**DB(UserProfile)が真実**
    - `UserProfile.subscription_status`
    - `UserProfile.current_period_end`

## API契約

- `/api/billings/status/` は常に以下のキーを返す：
    - `plan`, `is_active`, `provider`, `current_period_end`, `trial_ends_at`, `cancel_at_period_end`
- フロントが信じるべきは **`plan` と `is_active` だけ**
    - `provider` は表示/デバッグ用（UI分岐の根拠にしない）

## 実装の入口

- 課金判定：`temples/services/billing_state.py:get_billing_status`
- 機能制限：
    - `is_premium_for_user(user)`
    - `recommend_limit_for_user(user)`（premium=6, free=3）

# 神社seedデータ投入手順

## 対象

- コマンド: `import_shrines_seed`
- 入力ファイル: `temples/data/shrines_seed_clean.json`
- 重複判定キー: `name_jp + address`

## 事前確認

- DBマイグレーション適用済み
- 対象環境で `Shrine` テーブルが存在すること
- seed JSON が配置済みであること

## dry-run

```bash
python manage.py import_shrines_seed --dry-run
```

期待:

- 初回投入前: created または updated が出る
- 既に整合済み: updated=0, skipped=100

## 本実行

```bash
python manage.py import_shrines_seed
```

## 再確認

```bash
python manage.py import_shrines_seed --dry-run
```

期待:

- created=0
- updated=0
- skipped=100

## 確認ポイント

- 神社件数が想定どおりであること
- 一覧API / 検索 / concierge で神社が利用できること
- 再実行しても重複作成されないこと

---

## ステージングで投入確認

### 実行順

```bash
python manage.py import_shrines_seed --dry-run
python manage.py import_shrines_seed
python manage.py import_shrines_seed --dry-run
```

見るポイント

- 1回目 dry-run で差分があるか
- 本実行で error が出ないか
- 2回目 dry-run で updated=0 になるか

### 追加確認

可能なら shell で件数も見る。

```bash
python manage.py shell -c "from temples.models import Shrine; print(Shrine.objects.count())"
```
