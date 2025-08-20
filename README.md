# 神社参拝アプリ（MVP）

## 概要

神社参拝・御朱印管理・参拝チェックインができるアプリです。
AIコンシェルジュがユーザーの好みや現在地から最適な神社を提案し、Google Mapsでルートを表示します。

### 使用技術

- **バックエンド**: Django 5 + DRF + PostgreSQL(PostGIS)
- **フロントエンド**: React Native (Expo) + Node.js 20 LTS
- **AIレイヤー**: OpenAI Responses API（Structured Outputs）
- **外部サービス**:
  - Google Maps / Places(New) API
  - Google Routes API
  - AWS（本番環境: RDS(Postgres/PostGIS), S3, ECS/Fargate）
  - Google Play Billing / Apple StoreKit（課金対応）

## 機能一覧

- ✅ 参拝チェックイン（GPS & DB記録）
- ✅ 御朱印管理（撮影アップロード）
- ✅ Google Maps統合（近傍神社・ルート表示）
- ✅ **AIコンシェルジュ（神社提案＋ルート同梱）**
- ✅ セキュリティ強化（JWT / HTTPS / HSTS / CSP / レート制限）

## 環境構成

### 開発環境

- Docker Compose
  - Django (web)
  - PostgreSQL + PostGIS (db)
- `.env.dev` を使用（接続先は Docker サービス名 `db`）

### 本番環境

- AWS RDS (PostgreSQL + PostGIS)
- AWS ECS (Fargate) / EC2
- AWS S3 (御朱印画像アップロード先)
- Secrets: AWS SSM Parameter Store / Secrets Manager
- `.env.prod` をベースに値を SSM へ登録し、ECS タスク定義から参照

## セットアップ手順

### 1. 開発環境

```bash
# 環境設定ファイルをコピー
cp .env.example .env.dev

# Docker コンテナを起動
docker compose --env-file .env.dev up -d

# データベースマイグレーション実行
docker compose exec web python manage.py migrate

# 管理者ユーザー作成
docker compose exec web python manage.py createsuperuser
```

#### アクセス先

- 管理画面: http://localhost:8000/admin/
- API: http://localhost:8000/api/shrines/

### 2. 本番環境（AWS）

1. RDS(PostgreSQL) 作成 → `CREATE EXTENSION postgis;`
2. S3 バケット作成（画像保存用）
3. SSM Parameter Store に環境変数を登録（`.env.prod.example` を参考）
4. ECR へ Docker イメージ push
5. ECS Fargate/ECS EC2 でタスク定義を作成しデプロイ
6. ALB + ACM で HTTPS 有効化

## 環境変数管理

### 開発用 `.env.dev`

```env
# PostgreSQL設定
POSTGRES_USER=shrine_user
POSTGRES_PASSWORD=shrine_pass
POSTGRES_DB=shrine_db
POSTGRES_PORT=5432

# Django DB設定
DJANGO_DB_NAME=shrine_db
DJANGO_DB_USER=shrine_user
DJANGO_DB_PASSWORD=shrine_pass
DJANGO_DB_HOST=db
DJANGO_DB_PORT=5432

# API設定
OPENAI_API_KEY=sk-xxxx
GOOGLE_MAPS_API_KEY=AIza-xxxx
```

### 本番用 `.env.prod.example`

```env
# Django設定
DJANGO_SECRET_KEY=generate-a-strong-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.example.com

# データベース設定
DJANGO_DB_NAME=shrine_prod
DJANGO_DB_USER=shrine_prod_user
DJANGO_DB_PASSWORD=super-strong-pass
DJANGO_DB_HOST=xxxx.rds.amazonaws.com
DJANGO_DB_PORT=5432

# API設定
OPENAI_API_KEY=sk-xxxx
GOOGLE_MAPS_API_KEY=AIza-xxxx

# AWS設定
USE_S3_MEDIA=True
AWS_STORAGE_BUCKET_NAME=shrine-media
AWS_S3_REGION_NAME=ap-northeast-1
AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
```

⚠️ **注意**: 本番では `.env.prod` をそのまま置かず、**SSM Parameter Store** に登録して ECS タスクから参照してください。

## データ移行（本番切替手順）

1. 開発DBをフリーズ（新規書き込み停止）
2. `pg_dump` でバックアップ
3. `pg_restore` で RDS にリストア
4. `python manage.py migrate` を RDS で実行
5. アプリの `.env` を AWS の接続先に切替
6. ALB 経由で本番公開

## 今後の拡張予定

- 多言語対応（英語／中国語）
- Push通知（参拝リマインダー）
- SNS連携（TikTok/Instagram）
- 御朱印帳クラウド同期