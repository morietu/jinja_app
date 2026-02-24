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

- アーキテクチャ / 認証  
  → `docs/10_arch_auth_proxy.md`
- API 全体概要  
  → `docs/30_api_overview.md`
- ローカル疎通確認  
  → `docs/20_smoke_checks.md`
- インフラ / デプロイ  
  → `docs/40_infra_deploy.md`
- ロードマップ  
  → `docs/90_roadmap.md`

---

## ローカル起動（最短）

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000

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
