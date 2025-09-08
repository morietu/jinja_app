## ディレクトリ構成（詳細）

jinja_app/
├── backend/ # Django + DRF（APIサーバー）
│ ├── shrine_project/ # Django 設定ファイル
│ ├── temples/ # 神社 / 御朱印 / AIナビ / Ranking / Places API
│ ├── users/ # ユーザー認証・プロフィール設定（JWT）
│ ├── media/ # 御朱印画像保存（S3連携予定）
│ └── manage.py # Django 管理コマンド
│
├── apps/
│ ├── web/ # Next.js（Webフロントエンド）
│ │ ├── app/ # App Router ページ
│ │ ├── components/ # ShrineCard / GoshuinCard / MapRoute / UI
│ │ ├── lib/ # APIクライアント（axios）
│ │ ├── styles/ # Tailwind テーマ
│ │ └── public/ # 静的ファイル
│ └── mobile/ # Expo（モバイルアプリ）
│ ├── app/ # Expo Router ページ
│ ├── components/ # モバイル専用UIコンポーネント
│ ├── lib/ # APIクライアント（Webと共通化予定）
│ └── assets/ # 画像やフォントなどの静的リソース
│
├── infra/ # インフラ・環境構築
│ ├── docker-compose.yml # ローカル開発用コンテナ定義
│ ├── Dockerfile.web # Django 用 Dockerfile
│ ├── Dockerfile.frontend # Next.js 用 Dockerfile
│ ├── .env.dev # 開発用環境変数
│ └── .env.prod.example # 本番環境用サンプル env
│
├── docs/ # ドキュメント・設計資料
│ ├── architecture.md # このファイル（プロジェクト構成）
│ ├── api_endpoints.md # API エンドポイント仕様（予定）
│ ├── windows_gdal_setup.md # Windows GIS 開発環境セットアップ（予定）
│ └── todo.md # 開発TODOリスト
│
└── tests/ # E2E / API テスト

## 各モジュールの役割

### backend/
- **temples/**
  Shrine（神社）モデル、御朱印 API、AI コンシェルジュ API、ランキング、Places 検索などを担当。
- **users/**
  JWT 認証（新規登録 / ログイン）、プロフィール編集、公開設定を担当。
- **media/**
  御朱印画像ファイルの保存先（本番環境では AWS S3 と連携予定）。
- **shrine_project/**
  Django 設定ファイル群（`settings.py`, `urls.py` など）。

### apps/
- **web/**
  Next.js（App Router）を利用した Web フロントエンド。
  API クライアントは `lib/api.ts` に集約。
  UI は shadcn/ui + Tailwind を基盤に構築。
- **mobile/**
  Expo + React Native を利用したモバイルアプリ。
  `expo-location` や `expo-image-picker` を利用予定。
  Web と共通の API クライアントを導入予定。

### infra/
- Docker / AWS ECS/Fargate デプロイ関連設定。
- DB は PostgreSQL + PostGIS。
- 本番では ALB + ACM による HTTPS 化を想定。

### docs/
- プロジェクトの補足ドキュメント。
- 詳細な環境構築や API 仕様はここに整理していく。

### tests/
- pytest / pytest-django を用いた結合テスト。
- E2E（検索 → 詳細 → 御朱印投稿）テストをここにまとめる予定。

---

## 今後の追加予定
- `docs/api_endpoints.md` に API エンドポイント詳細を整理
- `docs/windows_gdal_setup.md` に Windows GIS 開発環境の手順を記録
- `docs/architecture.md` にアーキテクチャ図（Mermaid など）を追記
