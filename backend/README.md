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
